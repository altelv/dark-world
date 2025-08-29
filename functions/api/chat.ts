// Cloudflare Pages Function: POST /api/chat
export const onRequestPost: PagesFunction<{ OPENROUTER_API_KEY: string }> = async (ctx) => {
  const { request, env } = ctx;

  // Пробуем прочитать тело запроса (то, что шлёт фронтенд: model, messages и т.д.)
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: "Invalid JSON body" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Прокси-запрос к OpenRouter
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // ВАЖНО: ключ берём из секретов Cloudflare (а не из браузера)
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      // Эти заголовки — рекомендуется OpenRouter для идентификации источника:
      "HTTP-Referer": "https://your-project.pages.dev", // можно поменять на свой домен позже
      "X-Title": "Dark World",
    },
    body: JSON.stringify(payload),
  });

  // Отдаём ответ как есть (текстом), с нужным статусом
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
};

// Для всех остальных методов (GET/OPTIONS) — 405
export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // onRequestPost перехватит POST
  return new Response("OK");
};
