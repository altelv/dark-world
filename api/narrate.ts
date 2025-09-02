import type { VercelRequest, VercelResponse } from "@vercel/node"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const OPENROUTER_BASE = process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1"
const DM_MODEL = process.env.DW_DM_MODEL || "google/gemini-2.0-flash-lite-001"
const SEC_MODEL = process.env.DW_SEC_MODEL || "qwen/qwen-2.5-72b-instruct"

type UICommand = { cmd: "set_scene"|"show_image"|"show_creature", payload: any }

function stripCodeFences(s:string){
  return s.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "")
}
function extractFirstJsonObject(s:string): string | null {
  let depth = 0, start = -1
  for (let i=0;i<s.length;i++){
    const ch = s[i]
    if (ch === "{"){
      if (depth===0) start = i
      depth++
    } else if (ch === "}"){
      depth--
      if (depth===0 && start>=0){
        return s.slice(start, i+1)
      }
    }
  }
  return null
}
function safeJSON<T=any>(s: string): T | null {
  try { return JSON.parse(s) as T } catch { return null }
}
function parseJsonLoose(s:string){
  if (!s) return null
  const stripped = stripCodeFences(s.trim())
  const direct = safeJSON(stripped)
  if (direct) return direct
  const only = extractFirstJsonObject(stripped)
  if (only){
    const obj = safeJSON(only)
    if (obj) return obj
  }
  return null
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
Ты — рассказчик тёмного фэнтези (ДМ). Верни ТОЛЬКО JSON по схеме, без текста снаружи и без тройных кавычек:
{
  "to_player": "<1–3 абзаца, стиль паспорта; первая сцена начинается фразой 'Добро пожаловать в Темный мир…'>",
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
- Картинки только как команды show_image/show_creature с PROMPT (EN 6–14 слов); URL НЕ присылай.
- Верни чистый JSON-объект. Никаких пояснений, преамбул, \`\`\`, HTML, Markdown.
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
- Верни чистый JSON-объект без \`\`\`.
`.trim()

function validateUI(to_ui:any, scene_changed:boolean){
  const errs:string[] = []
  const out: UICommand[] = []
  if (to_ui == null) return { ok:true, errs, out } // пустой массив допустим
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
      if (/^https?:\/\//i.test(e.payload.prompt)) errs.push(`${e.cmd} prompt must be EN words, not URL`)
    }
    out.push(e as UICommand)
  }
  return { ok: errs.length===0, errs, out }
}

function normalizeDM(payload:any, sec:any){
  const errs:string[] = []
  if (!payload || typeof payload!=="object"){ errs.push("DM payload not an object"); return { ok:false, errs, payload } }
  if (typeof payload.to_player!=="string" || !payload.to_player.trim()) errs.push("to_player must be non-empty string")
  const sceneChanged = !!(sec?.state?.scene_changed)
  const ui = validateUI(payload.to_ui, sceneChanged)
  if (!ui.ok) errs.push(...ui.errs)
  // Fallback: synthesize show_image if scene changed and prompt exists
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
      return res.status(200).json({ to_player: "Добро пожаловать в Темный мир… Ветер треплет плащ, дорога зовёт. — Куда теперь?", to_ui: [], to_secretary: { note:"local-stub" }, __debug:{ stub:true } })
    }
    // Secretary
    const secRaw = await openrouterChat(SEC_MODEL, [
      { role:"system", content: SEC_SYSTEM },
      { role:"user", content: JSON.stringify({ text, state }) }
    ])
    const sec = parseJsonLoose(secRaw) ?? { state:{ scene_changed:false }, to_narrator:{}, to_ui_additional:[] }

    // Narrator
    const dmRaw = await openrouterChat(DM_MODEL, [
      { role:"system", content: DM_SYSTEM },
      { role:"user", content: JSON.stringify({ text, state, secretary: sec }) }
    ])

    // Parse & validate
    let dm = parseJsonLoose(dmRaw)
    let norm = normalizeDM(dm, sec)
    let violations = norm.ok ? [] : norm.errs

    // Up to 2 repair attempts
    let attempts = 0
    while (!norm.ok && attempts < 2){
      attempts++
      const repairPrompt = `Верни ТОЛЬКО JSON-объект по схеме из предыдущей инструкции. Исправь ошибки: ${violations.join("; ")}. Никаких пояснений, \`\`\` или URL. Исходный ответ: ${dmRaw.slice(0, 4000)}`
      const repairedRaw = await openrouterChat(DM_MODEL, [
        { role:"system", content: DM_SYSTEM },
        { role:"user", content: repairPrompt }
      ])
      dm = parseJsonLoose(repairedRaw)
      norm = normalizeDM(dm, sec)
      violations = norm.ok ? [] : norm.errs
    }

    if (!norm.ok){
      const safe = {
        to_player: "Тишина тянется, как холодный туман. — Продолжай. Я слушаю.",
        to_ui: [],
        to_secretary: {}
      }
      return res.status(200).json({ ...safe, __debug:{ secRaw: secRaw.slice(0,4000), dmRaw: dmRaw.slice(0,4000), violations } })
    }

    return res.status(200).json({ ...(norm.payload || dm), __debug:{ secRaw: secRaw.slice(0,4000), dmRaw: dmRaw.slice(0,4000), violations } })
  }catch(e:any){
    return res.status(500).json({ error: e.message || "narrate-failed" })
  }
}
