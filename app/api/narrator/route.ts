// app/api/narrator/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: "Ты мрачный рассказчик (ДМ) тёмного фэнтези. Пиши кратко, кинематографично, без спама. 2–3 фразы максимум." },
          { role: "user", content: prompt ?? "Начало боя. Опиши сцену в 2–3 фразах." }
        ],
        temperature: 0.8,
      })
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? "Тьма сгущается. Враг близко.";
    return NextResponse.json({ text });
  } catch (e:any) {
    return NextResponse.json({ text: "ДМ молчит. Холодная тишина перед бурей." }, { status: 200 });
  }
}
