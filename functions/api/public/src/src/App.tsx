import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";

/* ===== Типы ===== */
type Character = { name: string; race: string; class: string };

type WorldState = {
  scene: string;
  sceneId?: string;
  sceneType?: "wilderness" | "settlement" | "indoors" | "dungeon";
  secretarySummary: string;
};

type ChatMsg = {
  id: string;
  role: "player" | "narrator" | "system";
  content: string;
  images?: string[];
  loadingKind?: "think" | "image";
};

type ORMessage = { role: "system" | "user" | "assistant"; content: string };

type UICommand =
  | { cmd: "set_scene"; payload: { scene: string; scene_id?: string } }
  | { cmd: "show_image"; payload: { prompt: string; seed?: number } }
  | { cmd: "show_creature"; payload: { prompt: string; seed?: number } };

type SecretaryOut = {
  to_secretary?: string;
  to_narrator?: string;
  scene_changed?: boolean;
  scene_id?: string | null;
  scene_name?: string | null;
  scene_type?: "wilderness" | "settlement" | "indoors" | "dungeon" | null;
  event_type?: "travel" | "combat" | "investigation" | "dialogue" | "other";
  anchor_words?: string[];
  image_prompts?: { scene_en?: string | null; creature_en?: string | null };
  quest?: {
    current?: {
      id?: string;
      title?: string;
      status?: "new" | "active" | "completed" | "failed" | "abandoned";
      stage?: "hook" | "investigation" | "confrontation" | "resolution";
      next_hint?: string;
    };
    plan?: any;
  };
};

/* ===== Утилиты ===== */
const uid = () => Math.random().toString(36).slice(2);

function parseLooselyJSON<T = any>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  const noFences = trimmed.replace(/^```[a-zA-Z]*\s*/i, "").replace(/```$/i, "").trim();
  candidates.push(noFences, trimmed);
  const a = trimmed.indexOf("{"); const b = trimmed.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) candidates.push(trimmed.slice(a, b + 1));
  for (const c of candidates) { try { return { ok: true, value: JSON.parse(c) as T }; } catch {} }
  return { ok: false, error: "Cannot extract JSON" };
}

class RateLimiter {
  private t: number[] = [];
  constructor(private maxPerMin: number) {}
  async limit(): Promise<void> {
    const now = Date.now();
    this.t = this.t.filter(x => now - x < 60_000);
    if (this.t.length >= this.maxPerMin) {
      const wait = 60_000 - (now - this.t[0]);
      await new Promise(r => setTimeout(r, wait));
      return this.limit();
    }
    this.t.push(now);
  }
}

// Pollinations
function pollinationsUrl(prompt: string) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
}

/** PIXEL-ART префиксы */
const SCENE_PREFIX =
  "Create a Pixel art Dark fantasy scene. cinematic composition. no characters. " +
  "muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Scene:";
const CREATURE_PREFIX =
  "Create a Pixel art Dark fantasy creature. cinematic composition. " +
  "muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Creature:";

function buildScenePrompt(scenePrompt: string) {
  const ts = new Date().toISOString(); // анти-кэш
  return `${SCENE_PREFIX} ${scenePrompt} | t=${ts}`;
}
function buildCreaturePrompt(creaturePrompt: string) {
  const ts = new Date().toISOString();
  return `${CREATURE_PREFIX} ${creaturePrompt} | t=${ts}`;
}

/* ===== Прокси OpenRouter ===== */
async function callOpenRouter(opts: {
  model: string; messages: ORMessage[]; temperature?: number; max_tokens?: number; signal?: AbortSignal;
}): Promise<{ text: string }> {
  const { model, messages, temperature = 0.8, max_tokens = 900, signal } = opts;
  const MAX = 2; let delay = 1000;
  for (let i = 0; i <= MAX; i++) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Title": "Dark World (Client)" },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
      signal,
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      return { text };
    }
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500 || /rate/i.test(body)) && i < MAX) {
      await new Promise(r => setTimeout(r, delay + Math.floor(Math.random()*400)));
      delay *= 2; continue;
    }
    throw new Error(`OpenRouter error ${res.status}: ${body}`);
  }
  throw new Error("OpenRouter: unexpected failure");
}

/* ===== Прелоад изображений ===== */
function preloadImage(url: string, timeoutMs = 10_000): Promise<"loaded" | "timeout" | "error"> {
  return new Promise((resolve) => {
    let settled = false;
    const img = new Image();
    const done = (s: "loaded" | "timeout" | "error") => { if (!settled) { settled = true; resolve(s); } };
    img.onload = () => done("loaded");
    img.onerror = () => done("error");
    img.src = url;
    setTimeout(() => done("timeout"), timeoutMs);
  });
}

/* ===== Анти-телепорт: простая проверка ===== */
const TRIGGERS = {
  dungeon: ["подземель", "катакомб", "свод", "склеп", "крипт", "факел", "факельн", "сырой каменн", "капает вода", "тусклый свет", "узкий проход", "грот", "мох", "плесен"],
  settlement: ["площад", "дом", "крыша", "трактир", "лавк", "переул", "мостов", "булыжн", "окн", "рынок", "фонарь"],
  outdoors: ["лес", "рощ", "дорог", "поле", "ветер", "берег", "склон", "гор", "туман", "закат", "камыш", "болот", "луг"],
  indoors: ["комната", "зал", "коридор", "дверь", "лестниц", "камин", "шкаф", "стол", "стены", "потолок"]
};
function countTriggers(text: string, list: string[]) {
  const t = text.toLowerCase();
  return list.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0);
}

/* ===== Главный компонент ===== */
export default function App() {
  const modelNarrator = "google/gemini-2.0-flash-lite-001";
  const modelSecretary = "qwen/qwen-2.5-72b-instruct";

  const geminiLimiter = useMemo(() => new RateLimiter(10), []);
  const qwenLimiter = useMemo(() => new RateLimiter(8), []);

  const [character, setCharacter] = useState<Character>({ name: "", race: "", class: "" });
  const [world, setWorld] = useState<WorldState>({ scene: "Начало истории", secretarySummary: "", sceneId: "start", sceneType: "wilderness" });
  const [rules, setRules] = useState<string>("Загрузка правил...");

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visualLock, setVisualLock] = useState(false); // блокировка на время загрузки картинок

  // центр-скролл
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastScrolledId = useRef<string | null>(null);

  // мобильная карусель
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState(1);

  // измерение высоты композера (mobile)
  const mobileComposerRef = useRef<HTMLDivElement | null>(null);
  const [composerH, setComposerH] = useState<number>(72);

  // d20 (механика есть; UI-кнопок нет)
  const [rollOpen, setRollOpen] = useState(false);
  const [rollValue, setRollValue] = useState<number | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);

  // правила
  useEffect(() => {
    fetch("/rules.md").then(r => r.text()).then(setRules).catch(() => setRules("(Не удалось загрузить rules.md)"));
  }, []);

  // старт: картинка → текст; на это время блокируем отправку
  useEffect(() => {
    const loaderId = uid();
    setVisualLock(true);
    setMessages([{ id: loaderId, role: "system", content: "", loadingKind: "image" }]);
    const startPrompt = buildScenePrompt("a view of the grim, dark fantasy world approaching over the horizon");
    const startUrl = pollinationsUrl(startPrompt);
    (async () => {
      await preloadImage(startUrl, 10_000);
      setMessages(m => m.filter(x => x.id !== loaderId));
      setMessages(m => [...m, { id: uid(), role: "system", content: "", images: [startUrl] }]);
      setMessages(m => [...m, { id: uid(), role: "narrator", content: "Добро пожаловать в Темный Мир, одинокая душа." }]);
      setVisualLock(false);
    })();
  }, []);

  /* ==== автопрокрутка к началу нового ответа ДМ ==== */
  useEffect(() => {
    const lastNarr = [...messages].reverse().find(m => m.role === "narrator");
    if (!lastNarr || lastNarr.id === lastScrolledId.current) return;
    const el = messageRefs.current[lastNarr.id];
    const c = chatScrollRef.current;
    if (el && c) {
      lastScrolledId.current = lastNarr.id;
      const rect = el.getBoundingClientRect();
      const crect = c.getBoundingClientRect();
      const top = c.scrollTop + (rect.top - crect.top) - 8;
      c.scrollTo({ top, behavior: "smooth" });
    }
  }, [messages]);

  /* ==== mobile: индикатор и авто-доснап ==== */
  useEffect(() => {
    const el = mobileTrackRef.current;
    if (!el) return;

    const onScroll = () => {
      const idx = Math.round(el.scrollLeft / el.clientWidth);
      setPanel(Math.max(0, Math.min(2, idx)));
    };

    let snapTimer: any = null;
    const scheduleSnap = () => {
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(() => {
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        const target = idx * el.clientWidth;
        el.scrollTo({ left: target, behavior: "smooth" });
        setPanel(Math.max(0, Math.min(2, idx)));
      }, 120);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchend", scheduleSnap, { passive: true });
    el.addEventListener("mouseup", scheduleSnap, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll as any);
      el.removeEventListener("touchend", scheduleSnap as any);
      el.removeEventListener("mouseup", scheduleSnap as any);
      if (snapTimer) clearTimeout(snapTimer);
    };
  }, []);

  /* ==== измеряем высоту композера (mobile) ==== */
  useLayoutEffect(() => {
    if (!mobileComposerRef.current) return;
    const ro = new ResizeObserver(() => {
      const h = mobileComposerRef.current?.offsetHeight ?? 72;
      setComposerH(h);
    });
    ro.observe(mobileComposerRef.current);
    return () => ro.disconnect();
  }, []);

  /* ===== картинка → текст (с блокировкой ввода) ===== */
  async function imageThenText(imageUrl: string, text: string) {
    setVisualLock(true);
    const imgId = uid();
    setMessages(m => [...m, { id: imgId, role: "system", content: "", images: [], loadingKind: "image" }]);
    const status = await preloadImage(imageUrl, 10_000);
    if (status === "loaded") {
      setMessages(m => m.map(x => x.id === imgId ? { ...x, images: [imageUrl], loadingKind: undefined } : x));
      setMessages(m => [...m, { id: uid(), role: "narrator", content: text }]);
      setVisualLock(false);
    } else {
      setMessages(m => [...m, { id: uid(), role: "narrator", content: text }]);
      preloadImage(imageUrl, 60_000).then(st => {
        if (st === "loaded") setMessages(m => m.map(x => x.id === imgId ? { ...x, images: [imageUrl], loadingKind: undefined } : x));
        else setMessages(m => m.filter(x => x.id !== imgId));
      }).finally(() => setVisualLock(false));
    }
  }

  /* ===== Анти-телепорт ===== */
  function isMismatchToScene(text: string, sec: SecretaryOut | null) {
    if (!sec || sec.scene_changed) return false;
    const type = sec.scene_type || world.sceneType;
    if (!type) return false;
    const d = countTriggers(text, TRIGGERS.dungeon);
    const s = countTriggers(text, TRIGGERS.settlement);
    const o = countTriggers(text, TRIGGERS.outdoors);
    if ((type === "settlement" || type === "wilderness") && d >= 2 && d > s && d > o) return true;
    return false;
  }

  /* ===== Применяем UI-команды ===== */
  function applyUI(cmds: UICommand[], narratorText: string | null, sec: SecretaryOut | null) {
    const sceneChanged = !!sec?.scene_changed;
    let sceneImageUrl: string | null = null;
    let creatureImageUrl: string | null = null;

    if (sec?.scene_name || sec?.scene_type || sec?.scene_id) {
      setWorld(w => ({
        ...w,
        scene: sec.scene_name ?? w.scene,
        sceneType: (sec.scene_type ?? w.sceneType) as WorldState["sceneType"],
        sceneId: sec.scene_id ?? w.sceneId
      }));
    }

    for (const c of cmds) {
      if (c.cmd === "set_scene") {
        setWorld(w => ({ ...w, scene: c.payload.scene, sceneId: c.payload.scene_id ?? w.sceneId }));
      }
      if (c.cmd === "show_image") {
        if (sceneChanged) {
          const source = sec?.image_prompts?.scene_en ?? c.payload.prompt;
          sceneImageUrl = pollinationsUrl(buildScenePrompt(source) + (c.payload.seed ? `, seed ${c.payload.seed}` : ""));
        }
      }
      if (c.cmd === "show_creature") {
        const source = sec?.image_prompts?.creature_en ?? c.payload.prompt;
        creatureImageUrl = pollinationsUrl(buildCreaturePrompt(source) + (c.payload.seed ? `, seed ${c.payload.seed}` : ""));
      }
    }

    if (sceneChanged && sceneImageUrl && narratorText) { imageThenText(sceneImageUrl, narratorText); narratorText = null; }
    if (creatureImageUrl && narratorText) { imageThenText(creatureImageUrl, narratorText); narratorText = null; }
    if (sceneChanged && !sceneImageUrl && narratorText) {
      const fallback = pollinationsUrl(buildScenePrompt(sec?.image_prompts?.scene_en ?? world.scene));
      imageThenText(fallback, narratorText); narratorText = null;
    }
    if (narratorText) setMessages(m => [...m, { id: uid(), role: "narrator", content: narratorText }]);
  }

  /* ===== Отправка ===== */
  async function sendMessage() {
    if (loading || visualLock) return;
    const text = input.trim(); if (!text) return;

    setInput("");
    setMessages(m => [...m, { id: uid(), role: "player", content: text }]);
    setLoading(true);
    const abort = new AbortController();

    try {
      // === СЕКРЕТАРЬ ===
      await qwenLimiter.limit();
      const secPrompt = `Ты — Секретарь (СКР) тёмной фэнтези-игры.
Верни ТОЛЬКО JSON без пояснений И БЕЗ markdown, ровно по схеме:
{
  "to_secretary": string,
  "to_narrator": string,
  "scene_changed": boolean,
  "scene_id": string | null,
  "scene_name": string | null,
  "scene_type": "wilderness" | "settlement" | "indoors" | "dungeon" | null,
  "event_type": "travel" | "combat" | "investigation" | "dialogue" | "other",
  "anchor_words": string[],
  "quest": {
    "current": { "id": string, "title": string, "status": "new"|"active"|"completed"|"failed"|"abandoned", "stage": "hook"|"investigation"|"confrontation"|"resolution", "next_hint": string },
    "plan": any
  },
  "image_prompts": {
    "scene_en": string | null,
    "creature_en": string | null
  }
}

Триггеры scene_changed: путешествие, дверь/портал, лестница, вход/выход из пещеры/здания, телепортация, падение, длительный переход.

Персонаж: ${JSON.stringify(character)}
Мир: ${JSON.stringify(world)}
Последний бросок d20: ${lastRoll ?? "нет"}
Сообщение игрока: ${text}

Если квестов нет — сгенерируй Квест-1. По завершении — план Квест-2. Если игрок игнорирует 2–3 хода — current="abandoned" и новый хук позже.`;

      const sec = await callOpenRouter({
        model: modelSecretary,
        messages: [
          { role: "system", content: "Верни ТОЛЬКО валидный JSON одного объекта. Никаких Markdown/```/пояснений." },
          { role: "user", content: secPrompt }
        ],
        temperature: 0.25, max_tokens: 600, signal: abort.signal,
      });

      const secParsed = parseLooselyJSON<SecretaryOut>(sec.text);
      let noteToDM = "";
      let secObj: SecretaryOut | null = null;

      if (secParsed.ok) {
        secObj = secParsed.value;
        if (secObj.to_secretary) setWorld(w => ({ ...w, secretarySummary: String(secObj!.to_secretary) }));
        if (secObj.scene_name || secObj.scene_type || secObj.scene_id) {
          setWorld(w => ({
            ...w,
            scene: secObj!.scene_name ?? w.scene,
            sceneType: secObj!.scene_type ?? w.sceneType,
            sceneId: secObj!.scene_id ?? w.sceneId
          }));
        }
        if (secObj.to_narrator) noteToDM = String(secObj!.to_narrator);
      } else {
        setMessages(m => [...m, { id: uid(), role: "system", content: "СКР вернул неправильный JSON (пропускаем часть полей)" }]);
      }

      // === ДМ ===
      await geminiLimiter.limit();
      const et = secObj?.event_type ?? "other";
      const tempByET = et === "travel" ? 0.85 : et === "combat" ? 0.65 : 0.75;
      const maxTokByET = et === "travel" ? 1200 : et === "combat" ? 500 : 700;

      const dmPrompt = `Ты — Рассказчик (ДМ) мрачного фэнтези. Говори как древний летописец, но помни о темпе сцены.
Отвечай ТОЛЬКО JSON:
{
  "to_player": "текст",
  "to_ui": [UICommand...]
}
UICommand ∈ [
  { "cmd": "set_scene", "payload": { "scene": "<русское краткое имя>", "scene_id"?: "<id>" } },
  { "cmd": "show_image", "payload": { "prompt": "<EN: 6–14 слов содержания локации>", "seed"?: number } },   // ТОЛЬКО при scene_changed=true
  { "cmd": "show_creature", "payload": { "prompt": "<EN: 6–14 слов описания врага>", "seed"?: number } }     // когда враг реально есть
]

КОНТРАКТ ЛОКАЦИИ:
- scene_changed: ${secObj?.scene_changed ?? false}
- scene_id: ${secObj?.scene_id ?? world.sceneId}
- scene_name: ${secObj?.scene_name ?? world.scene}
- scene_type: ${secObj?.scene_type ?? world.sceneType}
Если scene_changed=false — НЕ меняй локацию. show_image сцены — ТОЛЬКО при scene_changed=true.

Темп event_type="${et}":
- "combat": 1–2 абзаца, динамично.
- "travel": 2–3 абзаца, атмосфера новой локации.
- "investigation": до 2 абз., **подсказки — жирным**, критичное/враг — ==жёлтым==.
- "dialogue": средний объём, реплики через «—».

Мягко веди игрока по квесту. Якорные слова: ${(secObj?.anchor_words ?? []).join(", ") || "-"}.
Квест: ${JSON.stringify(secObj?.quest?.current ?? {})}
Hint: "${secObj?.quest?.current?.next_hint ?? ""}"

Правила мира:
${rules}

Персонаж: ${JSON.stringify(character)}
Мир: ${JSON.stringify(world)}
Последний бросок d20: ${lastRoll ?? "нет"}
Сообщение игрока: ${text}
Заметка от СКР: ${noteToDM}
`;

      const dmFirst = await callOpenRouter({
        model: modelNarrator,
        messages: [
          { role: "system", content: "Верни ТОЛЬКО JSON с полями to_player и to_ui. Никаких Markdown/```/пояснений." },
          { role: "user", content: dmPrompt }
        ],
        temperature: tempByET, max_tokens: maxTokByET, signal: abort.signal,
      });

      const dmParsed1 = parseLooselyJSON<{ to_player?: string; to_ui?: UICommand[] }>(dmFirst.text);
      if (!dmParsed1.ok) {
        setMessages(m => [...m, { id: uid(), role: "narrator", content: dmFirst.text }]);
        setLoading(false);
        return;
      }

      let narratorText = dmParsed1.value.to_player ?? "";
      let ui = Array.isArray(dmParsed1.value.to_ui) ? dmParsed1.value.to_ui : [];

      if (isMismatchToScene(narratorText, secObj)) {
        try {
          const rewritePrompt = `Перепиши кратко в рамках текущей сцены:
- scene_changed=false — остаёмся в "${secObj?.scene_name ?? world.scene}" (type=${secObj?.scene_type ?? world.sceneType})
- убрать признаки подземелий/сводов/факелов, если тип не dungeon/indoors
Отвечай ТОЛЬКО JSON {"to_player": "...", "to_ui": []}. 1–2 абзаца.`;
          const dmRetry = await callOpenRouter({
            model: modelNarrator,
            messages: [
              { role: "system", content: "Верни ТОЛЬКО JSON с полями to_player и to_ui. Никаких Markdown/```/пояснений." },
              { role: "user", content: rewritePrompt + "\n\nИсходный вариант:\n" + narratorText }
            ],
            temperature: 0.6, max_tokens: 500, signal: abort.signal,
          });
          const dmParsed2 = parseLooselyJSON<{ to_player?: string; to_ui?: UICommand[] }>(dmRetry.text);
          if (dmParsed2.ok && dmParsed2.value.to_player) {
            narratorText = dmParsed2.value.to_player!;
            ui = Array.isArray(dmParsed2.value.to_ui) ? dmParsed2.value.to_ui! : [];
          } else {
            narratorText = narratorText.replace(/[^.?!]*(подземель|катакомб|свод|крипт|факел)[^.?!]*[.?!]\s*/gi, "");
          }
        } catch {
          narratorText = narratorText.replace(/[^.?!]*(подземель|катакомб|свод|крипт|факел)[^.?!]*[.?!]\s*/gi, "");
        }
      }

      applyUI(ui, narratorText, secObj);

    } catch (e: any) {
      setMessages(m => [...m, { id: uid(), role: "system", content: `Ошибка запроса: ${String(e?.message || e)}` }]);
    } finally {
      setLoading(false);
    }
  }

  // d20 (в спрятанной механике)
  function openRollModal() {
    const v = Math.floor(Math.random() * 20) + 1;
    setRollValue(v); setRollOpen(true);
  }
  function applyRollToChat() {
    if (rollValue == null) return;
    setMessages(m => [...m, { id: uid(), role: "system", content: `🎲 Проверка d20: **${rollValue}**` }]);
    setLastRoll(rollValue); setRollOpen(false);
  }

  /* ===== Рендер ===== */

  const LeftPanelInner = (
    <div className="h-full flex flex-col gap-2 p-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">Персонаж</div>
      <Field placeholder="Имя"  value={character.name}  onChange={v => setCharacter(c => ({ ...c, name: v }))} />
      <Field placeholder="Раса" value={character.race} onChange={v => setCharacter(c => ({ ...c, race: v }))} />
      <Field placeholder="Класс" value={character.class} onChange={v => setCharacter(c => ({ ...c, class: v }))} />
      <div className="mt-1 text-[11px] text-zinc-500">Сцена: {world.scene}</div>
    </div>
  );

  const CenterPanel = (mobile?: boolean) => (
    <div className="h-full flex flex-col">
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1"
        style={mobile ? { paddingBottom: composerH + 12 } : undefined}
      >
        {messages.map(m => (
          <ChatBubble key={m.id} msg={m} setRef={(el)=>{ messageRefs.current[m.id]=el; }} />
        ))}
        {(loading || visualLock) && (
          <div className="text-xs text-zinc-400"><LoadingTicker kind={visualLock ? "image" : "think"} /></div>
        )}
      </div>

      {/* desktop composer */}
      {!mobile && (
        <div className="mt-2">
          <textarea
            className="w-full min-h-[56px] max-h-40 p-2 rounded-xl bg-zinc-900/70 text-sm"
            placeholder="Ваше действие, речь, мысль…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <div className="flex items-center gap-2 mt-2">
            <button className="px-4 py-2 rounded-lg bg-indigo-700 text-sm disabled:opacity-60"
                    onClick={sendMessage}
                    disabled={loading || visualLock}>
              {(loading || visualLock) ? "Ждём…" : "Отправить"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const RightPanelInner = (
    <div className="h-full p-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Инвентарь</div>
      <div className="rounded-xl p-2 bg-zinc-900/40 text-xs text-zinc-400">
        Скоро здесь появится инвентарь и слоты экипировки.
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <header className="p-2 px-3 bg-gradient-to-b from-zinc-950 to-zinc-900/30 border-b border-zinc-800/40">
        <div className="text-base font-semibold tracking-wide">Тёмный мир</div>
      </header>

      {/* MAIN AREA: без скролла страницы, только центр прокручивается */}
      <div className="flex-1 overflow-hidden">
        {/* DESKTOP: три статичные колонки */}
        <div className="hidden md:grid grid-cols-[30%_30%_30%] justify-center gap-3 p-3 h-full">
          <section className="col-span-1 rounded-xl bg-zinc-900/20 border border-zinc-800/40">{LeftPanelInner}</section>
          <section className="col-span-1 rounded-xl bg-zinc-900/20 border border-zinc-800/40 h-full">{CenterPanel(false)}</section>
          <section className="col-span-1 rounded-xl bg-zinc-900/20 border border-zinc-800/40">{RightPanelInner}</section>
        </div>

        {/* MOBILE: каждая колонка ровно на экран, snap-center + авто-доснап */}
        <div className="md:hidden h-full relative">
          <div
            ref={mobileTrackRef}
            className="h-full flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
            style={{ scrollSnapType: "x mandatory" }}
          >
            <section className="min-w-[100vw] w-[100vw] snap-center">{LeftPanelInner}</section>
            <section className="min-w-[100vw] w-[100vw] snap-center">{CenterPanel(true)}</section>
            <section className="min-w-[100vw] w-[100vw] snap-center">{RightPanelInner}</section>
          </div>

          {/* Индикатор карусели — над полем ввода */}
          <div className="pointer-events-none absolute left-0 right-0"
               style={{ bottom: composerH + 8 }}>
            <div className="flex justify-center gap-1">
              {[0,1,2].map(i => (
                <span key={i} className={`h-1.5 w-5 rounded-full ${panel===i?'bg-indigo-500':'bg-zinc-700'}`} />
              ))}
            </div>
          </div>

          {/* MOBILE COMPOSER */}
          <div ref={mobileComposerRef} className="fixed left-0 right-0 bottom-0 z-20" style={{ padding: "8px 10px env(safe-area-inset-bottom)" }}>
            <div className="mx-2 relative">
              <AutoGrowTextarea
                value={input}
                onChange={setInput}
                onSubmit={sendMessage}
                disabled={loading || visualLock}
              />
            </div>
          </div>
        </div>
      </div>

      {/* d20 модалка (без кнопок вызова) */}
      {rollOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-sm border border-zinc-800/60">
            <div className="text-base font-semibold mb-1">Проверка (d20)</div>
            <div className="text-3xl text-center my-3">{rollValue}</div>
            <div className="text-xs text-zinc-400 mb-2">Значение доступно моделям как lastRoll.</div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-2 rounded-xl bg-zinc-800 text-sm" onClick={() => setRollOpen(false)}>Закрыть</button>
              <button className="px-3 py-2 rounded-xl bg-indigo-700 text-sm" onClick={applyRollToChat}>Отправить в чат</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== Элементы ===== */

function LoadingTicker({ kind }: { kind: "think" | "image" }) {
  const phrasesThink = ["Размышляет", "Думает", "Советуется", "Заваривает кофе"];
  const pick = () => {
    const r = Math.random();
    if (kind === "image") return "Рисует";
    if (r < 0.6) return phrasesThink[0];
    if (r < 0.85) return phrasesThink[1];
    if (r < 0.97) return phrasesThink[2];
    return phrasesThink[3];
  };
  const [base] = useState(pick());
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setDots(v => (v % 3) + 1), 450);
    return () => clearInterval(id);
  }, []);
  return <span>{base}{ ".".repeat(dots) }</span>;
}

function ChatBubble({ msg, setRef }:{ msg: ChatMsg; setRef?: (el: HTMLDivElement|null)=>void }) {
  const isPlayer = msg.role === "player";
  const align = isPlayer ? "justify-end" : "justify-start";
  const bubble =
    isPlayer ? "bg-indigo-900/40 border border-indigo-700/30"
    : msg.role === "narrator" ? "bg-emerald-900/25 border border-emerald-700/20"
    : "bg-zinc-900/40 border border-zinc-700/20";

  const widthClass = isPlayer ? "max-w-[85%]" : "w-full";

  return (
    <div className={`w-full flex ${align}`}>
      <div ref={setRef || undefined} className={`${widthClass} rounded-xl p-2 text-sm ${bubble}`} style={{ scrollMarginTop: 12 }}>
        {msg.images && msg.images.length > 0 && (
          <div className="mb-2">
            <img src={msg.images[0]} alt="scene" className="rounded-lg w-full object-cover" style={{ clipPath: "inset(0 0 8% 0)" }}/>
          </div>
        )}
        {msg.loadingKind === "image" && <div className="text-xs text-zinc-400"><LoadingTicker kind="image" /></div>}
        {msg.content && <div className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{__html: formatHighlights(msg.content)}}/>}
      </div>
    </div>
  );
}

// **bold** и ==жёлтым==
function formatHighlights(text: string) {
  const esc = (s: string) => s.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]!));
  let html = esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/==(.+?)==/g, `<span style="background:rgba(250,204,21,.25); color:#fde68a; padding:0 .1rem; border-radius:.2rem">$1</span>`);
  return html;
}

function Field({ placeholder, value, onChange }:{
  placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <input
      className="w-full px-3 py-2 rounded-lg bg-zinc-900/70 text-sm placeholder-zinc-500"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ===== Мобильный автогроу-композер с круглой кнопкой внутри ===== */
function AutoGrowTextarea({
  value, onChange, onSubmit, disabled
}: { value: string; onChange: (v: string)=>void; onSubmit: ()=>void; disabled?: boolean }) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [h, setH] = useState(44);
  const maxH = Math.round(typeof window !== "undefined" ? window.innerHeight * 0.35 : 240);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    const newH = Math.min(el.scrollHeight, maxH);
    el.style.height = newH + "px";
    setH(newH);
  }, [value]);

  const paddingRight = 52;

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        className="w-full rounded-2xl bg-zinc-900/80 text-sm leading-6 outline-none border border-zinc-800/60 text-zinc-100 placeholder-zinc-500"
        style={{ padding: `10px ${paddingRight}px 10px 12px`, resize: "none" }}
        placeholder="Ваше действие, речь, мысль…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={1}
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="absolute right-2 rounded-full bg-indigo-600 disabled:bg-indigo-600/50 text-white"
        style={{ width: 36, height: 36, top: (10 + h/2) - 18 }}
        aria-label="Отправить"
        title="Отправить"
      >
        <span style={{ display:"block", fontSize:18, lineHeight:"36px" }}>📜</span>
      </button>
    </div>
  );
}
