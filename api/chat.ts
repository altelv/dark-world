export const config = { runtime: "edge" };

// POST /api/chat  → прокси на OpenRouter (ключ берётся из переменной окружения OPENROUTER_API_KEY)
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid JSON body" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: "OPENROUTER_API_KEY is missing" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Подставим реферер по домену проекта (полезно для OpenRouter аналитики)
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "vercel.app";
  const referer = `https://${host}`;

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-Title": "Dark World",
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
