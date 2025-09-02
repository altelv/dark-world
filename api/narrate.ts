import type { VercelRequest, VercelResponse } from "@vercel/node"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const OPENROUTER_BASE = process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1"
const DM_MODEL = process.env.DW_DM_MODEL || "google/gemini-2.0-flash-lite-001"
const SEC_MODEL = process.env.DW_SEC_MODEL || "qwen/qwen-2.5-72b-instruct"

type UICommand = { cmd: "set_scene"|"show_image"|"show_creature", payload: any }

function safeJSON<T=any>(s: string): T | null {
  try { return JSON.parse(s) as T } catch { return null }
}

async function openrouterChat(model:string, messages:any[]){
  const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.7 })
  })
  if (!resp.ok){
    const t = await resp.text()
    throw new Error(`OpenRouter error: ${resp.status} ${t}`)
  }
  const j = await resp.json()
  return j.choices?.[0]?.message?.content ?? ""
}

const DM_SYSTEM = `
Ты — рассказчик тёмного фэнтези (ДМ). Верни ТОЛЬКО JSON по схеме, без текста снаружи:
{
  "to_player": "<1–3 абзаца, стиль паспорта; первая сцена начинаетcя фразой 'Добро пожаловать в Темный мир…'>",
  "to_ui": [
    { "cmd":"set_scene", "payload": { "scene":"<ru>", "scene_id"?: "<id>" } } |
    { "cmd":"show_image", "payload": { "prompt":"<EN 6–14 слов>", "seed"?: number } } |
    { "cmd":"show_creature", "payload": { "prompt":"<EN 6–14 слов>", "seed"?: number } }
  ],
  "to_secretary": { "notes": "...", "hints": "..." }
}
Правила:
- НЕ предлагай вариантов действий (никаких action-меню), если игрок сам не просит.
- Если secretary.state.scene_changed=false — НЕ меняй локацию и НЕ вызывай show_image сцены; телепорт перепиши как флешбек/видение.
- Картинка (если нужна) идёт перед текстом; мы сами соблюдём порядок в UI.
- Картинки только как команды show_image/show_creature с PROMPT (EN 6–14 слов); URL НЕ присылай.
`.trim()

const SEC_SYSTEM = `
Ты — Секретарь (СКР). Веди состояние мира (JSON). Верни ТОЛЬКО JSON:
{
  "state": { "scene_id": "<id>", "scene_changed": boolean, "facts":[], "quests":[], "anchors":[], "prompts": { "scene_en"?: "<6–14 EN words>", "creature_en"?: "<6–14 EN words>" } },
  "to_narrator": { "notes": "...", "advice": "..." },
  "to_ui_additional"?: [
    { "cmd":"set_scene", "payload": { "scene":"<ru>", "scene_id"?: "<id>" } } |
    { "cmd":"show_image", "payload": { "prompt":"<EN 6–14 слов>", "seed"?: number } } |
    { "cmd":"show_creature", "payload": { "prompt":"<EN 6–14 слов>", "seed"?: number } }
  ]
}
Правила:
- Ставь scene_changed=true только при переходах из паспорта.
- Даёшь КОРОТКИЕ EN-промты (6–14 слов) без URL; кэш-соль добавит UI.
`.trim()

function validateUI(to_ui:any, scene_changed:boolean){
  const errs:string[] = []
  const out: UICommand[] = []
  if (!Array.isArray(to_ui)) return { ok:false, errs:["to_ui must be array"], out }
  for (const e of to_ui){
    if (!e || typeof e !== "object" || !("cmd" in e) || !("payload" in e)){ errs.push("to_ui item must have cmd/payload"); continue }
    if (e.cmd!=="set_scene" && e.cmd!=="show_image" && e.cmd!=="show_creature"){ errs.push(`unknown cmd ${e.cmd}`); continue }
    if (e.cmd==="show_image" && scene_changed===false){ errs.push("show_image not allowed when scene_changed=false"); continue }
    if ((e.cmd==="show_image" || e.cmd==="show_creature")){
      if (!e.payload || typeof e.payload.prompt!=="string"){ errs.push(`${e.cmd}.payload.prompt missing`); continue }
      const wc = e.payload.prompt.trim().split(/\s+/).length
      if (wc<3) errs.push(`${e.cmd} prompt too short`)
      if (wc>18) errs.push(`${e.cmd} prompt too long`)
    }
    out.push(e as UICommand)
  }
  return { ok: errs.length===0, errs, out }
}

function normalizeDM(payload:any, sec:any){
  const errs:string[] = []
  if (!payload || typeof payload!=="object"){ errs.push("DM payload not an object"); return { ok:false, errs, payload } }
  if (typeof payload.to_player!=="string") errs.push("to_player must be string")
  const sceneChanged = !!(sec?.state?.scene_changed)
  const ui = validateUI(payload.to_ui, sceneChanged)
  if (!ui.ok) errs.push(...ui.errs)
  // Fallback: if no show_image but scene_changed and we have prompts.scene_en — synthesize one
  const hasShowImage = Array.isArray(payload.to_ui) && payload.to_ui.some((x:any)=>x?.cmd==="show_image")
  const scenePrompt = sec?.state?.prompts?.scene_en
  if (sceneChanged && scenePrompt && !hasShowImage){
    payload.to_ui = Array.isArray(payload.to_ui) ? payload.to_ui : []
    payload.to_ui.unshift({ cmd:"show_image", payload:{ prompt: scenePrompt } })
  }
  if (typeof payload.to_secretary!=="object") payload.to_secretary = { notes: "", hints: "" }
  return { ok: errs.length===0, errs, payload }
}

export default async function handler(req:VercelRequest, res:VercelResponse){
  try{
    const { text, state } = req.body || {}
    if (!OPENROUTER_API_KEY){
      return res.status(200).json({ to_player: "Добро пожаловать в Темный мир… Ветер треплет плащ, дорога зовёт. — Куда теперь?", to_ui: [], to_secretary: { note:"local-stub" } })
    }
    // Secretary first
    const secRaw = await openrouterChat(SEC_MODEL, [
      { role:"system", content: SEC_SYSTEM },
      { role:"user", content: JSON.stringify({ text, state }) }
    ])
    const sec = safeJSON(secRaw) ?? { state:{ scene_changed:false }, to_narrator:{}, to_ui_additional:[] }

    // Narrator with secretary context
    const dmRaw = await openrouterChat(DM_MODEL, [
      { role:"system", content: DM_SYSTEM },
      { role:"user", content: JSON.stringify({ text, state, secretary: sec }) }
    ])

    // Try parse + validate; one repair attempt if needed
    let dm = safeJSON(dmRaw)
    let norm = normalizeDM(dm, sec)
    if (!norm.ok){
      const repairPrompt = `Верни ТОЛЬКО JSON по схеме из предыдущей инструкции. Исправь ошибки: ${norm.errs.join("; ")}.`
      const repaired = await openrouterChat(DM_MODEL, [
        { role:"system", content: DM_SYSTEM },
        { role:"user", content: repairPrompt }
      ])
      dm = safeJSON(repaired)
      norm = normalizeDM(dm, sec)
    }
    if (!norm.ok){
      dm = { to_player: typeof dm==="string" ? dm : "…", to_ui: [], to_secretary: {} }
    }
    res.status(200).json(norm.payload || dm)
  }catch(e:any){
    res.status(500).json({ error: e.message || "narrate-failed" })
  }
}
