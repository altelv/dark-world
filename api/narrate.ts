import type { VercelRequest, VercelResponse } from "@vercel/node"

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ""
const OPENROUTER_BASE = process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1"
const DM_MODEL = process.env.DW_DM_MODEL || "google/gemini-2.0-flash-lite-001"
const SEC_MODEL = process.env.DW_SEC_MODEL || "qwen/qwen-2.5-72b-instruct"

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

const DM_SYSTEM = `Ты — рассказчик тёмного фэнтези. Соблюдай жёсткий контракт: возвращай JSON с полями to_player (1–3 абз., диалоги длинным тире, стиль паспорта), to_ui (set_scene/show_image/show_creature строго по правилам), to_secretary (заметки). Не меняй локацию если scene_changed=false. Картинка — затем текст. 600–800 символов.`
const SEC_SYSTEM = `Ты — Секретарь. Веди состояние мира (JSON): сцена/локация, факты, квесты, якорные слова, подсказки ДМ, EN-промты для сцен/врагов, флаг scene_changed. Соблюдай паспорт. Верни JSON: {state, to_narrator, to_ui_additional?}`

export default async function handler(req:VercelRequest, res:VercelResponse){
  try{
    const { text, state } = req.body || {}
    if (!OPENROUTER_API_KEY){
      return res.status(200).json({ to_player: "Ветер треплет плащ. Дорога зовёт. — Куда теперь?", to_ui: [], to_secretary: { note:"local-stub" } })
    }
    const sec = await openrouterChat(SEC_MODEL, [
      { role:"system", content: SEC_SYSTEM },
      { role:"user", content: JSON.stringify({ text, state }) }
    ])
    const dm = await openrouterChat(DM_MODEL, [
      { role:"system", content: DM_SYSTEM },
      { role:"user", content: JSON.stringify({ text, state, secretary: sec }) }
    ])
    let payload:any = {}
    try { payload = JSON.parse(dm) } catch { payload = { to_player: dm, to_ui: [], to_secretary: {} } }
    res.status(200).json(payload)
  }catch(e:any){
    res.status(500).json({ error: e.message || "narrate-failed" })
  }
}
