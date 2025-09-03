// Vercel serverless function to call OpenRouter and return {to_player,to_ui,to_secretary}
export default async function handler(req: any, res: any){
  if (req.method === 'OPTIONS'){
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try{
    const { text, world } = req.body || {}
    const base = process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1'
    const model = process.env.DW_DM_MODEL || 'google/gemini-2.0-flash-lite-001'
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Missing OPENROUTER_API_KEY' })

    const system = `You are the Narrator (DM) of a dark fantasy text RPG. 
You MUST reply as a strict JSON object with keys: to_player (string), to_ui (array of commands), to_secretary (string).
Never include any other text. 
Avoid repeating the phrase "Добро пожаловать в Темный мир…" after the very first turn.
Use 1–3 short paragraphs, rich and moody, Tolkien-like but darker.
If showing an image, add to_ui: [{ "cmd": "show_image", "payload": { "url": "<direct image url if you have it>" } }].
If changing scene add: { "cmd":"set_scene", "payload": { "scene": "<ru>", "scene_id":"<id>" } }.
Keep to the contract exactly.`

    const user = JSON.stringify({
      world,
      player_text: text
    })

    const r = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vercel.app',
        'X-Title': 'Dark World'
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    })

    const data = await r.json()
    if (!r.ok){
      return res.status(r.status).json({ error: 'OpenRouter error', details: data })
    }
    const content = data?.choices?.[0]?.message?.content || '{}'
    let parsed: any
    try { parsed = JSON.parse(content) } catch(e){ parsed = { to_player: content, to_ui: [], to_secretary: "" } }

    // Safety: ensure array
    if (!Array.isArray(parsed.to_ui)) parsed.to_ui = []

    return res.status(200).json(parsed)
  }catch(e:any){
    return res.status(500).json({ error: String(e?.message || e) })
  }
}
