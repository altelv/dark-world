export const runtime = "edge";
export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vercel.app",
        "X-Title": "DarkWorld Narrator"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages,
      })
    });
    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: txt }), { status: 500 });
    }
    const data = await r.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
