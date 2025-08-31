import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { LeftPanelCharacter } from "./components/LeftPanelCharacter";
import { D20RollLauncher } from "./game/dice";
import { runHiddenChecks } from "./game/hiddenChecks/engine";
import type { Character } from "./game/state/types";
import { seedCharacter } from "./game/examples/seedCharacter";

type WorldState = { scene: string; sceneId?: string; sceneType?: "wilderness" | "settlement" | "indoors" | "dungeon"; secretarySummary: string; };
type ChatMsg = { id: string; role: "player" | "narrator" | "system"; content: string; images?: string[]; loadingKind?: "think" | "image" };
type ORMessage = { role: "system" | "user" | "assistant"; content: string };
type UICommand =
  | { cmd: "set_scene"; payload: { scene: string; scene_id?: string } }
  | { cmd: "show_image"; payload: { prompt: string; seed?: number } }
  | { cmd: "show_creature"; payload: { prompt: string; seed?: number } };
type SecretaryOut = { to_secretary?: string; to_narrator?: string; scene_changed?: boolean; scene_id?: string | null; scene_name?: string | null; scene_type?: "wilderness" | "settlement" | "indoors" | "dungeon" | null; event_type?: "travel" | "combat" | "investigation" | "dialogue" | "other"; anchor_words?: string[]; image_prompts?: { scene_en?: string | null; creature_en?: string | null }; };

const uid = () => Math.random().toString(36).slice(2);
function parseLooselyJSON<T=any>(raw: string){ try{ return { ok:true, value: JSON.parse(raw) } as any }catch{ return { ok:false, error:'bad json' } as any } }
class RateLimiter { private t:number[]=[]; constructor(private maxPerMin:number){} async limit(){ const now=Date.now(); this.t=this.t.filter(x=>now-x<60_000); if(this.t.length>=this.maxPerMin){ const wait=60_000-(now-this.t[0]); await new Promise(r=>setTimeout(r,wait)); return this.limit(); } this.t.push(now);} }

function pollinationsUrl(prompt: string) { return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`; }
const SCENE_PREFIX = "Create a Pixel art Dark fantasy scene. cinematic composition. no characters. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Scene:";
const CREATURE_PREFIX = "Create a Pixel art Dark fantasy creature. cinematic composition. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Creature:";
function buildScenePrompt(scenePrompt: string) { const ts = new Date().toISOString(); return `${SCENE_PREFIX} ${scenePrompt} | t=${ts}`; }
function buildCreaturePrompt(creaturePrompt: string) { const ts = new Date().toISOString(); return `${CREATURE_PREFIX} ${creaturePrompt} | t=${ts}`; }

async function callOpenRouter(opts: { model: string; messages: ORMessage[]; temperature?: number; max_tokens?: number; signal?: AbortSignal; }): Promise<{ text: string }> {
  const res = await fetch("/api/chat",{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(opts)});
  if(!res.ok) throw new Error('OpenRouter error '+res.status);
  const data = await res.json(); return { text: data?.choices?.[0]?.message?.content ?? "" };
}
function preloadImage(url: string, timeoutMs = 10_000): Promise<"loaded" | "timeout" | "error"> {
  return new Promise((resolve) => { let settled=false; const img=new Image(); const done=(s:any)=>{ if(!settled){ settled=true; resolve(s);} };
    img.onload=()=>done('loaded'); img.onerror=()=>done('error'); img.src=url; setTimeout(()=>done('timeout'), timeoutMs);
  });
}
const TRIGGERS={ dungeon:['подземель','катакомб','свод','склеп','крипт','факел','сырой каменн','тусклый свет'], settlement:['площад','дом','трактир','рынок','окн','фонарь'], outdoors:['лес','рощ','дорог','поле','ветер','берег','склон','туман'] };
function countTriggers(text:string, list:string[]){ const t=text.toLowerCase(); return list.reduce((a,w)=>a+(t.includes(w)?1:0),0); }

export default function App(){
  const modelNarrator="google/gemini-2.0-flash-lite-001"; const modelSecretary="qwen/qwen-2.5-72b-instruct";
  const geminiLimiter=useMemo(()=>new RateLimiter(10),[]); const qwenLimiter=useMemo(()=>new RateLimiter(8),[]);
  const [character, setCharacter] = useState<Character>(seedCharacter());
  const [world, setWorld] = useState<WorldState>({ scene:'Начало истории', secretarySummary:'', sceneId:'start', sceneType:'wilderness' });
  const [rules, setRules] = useState<string>(''); const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const [visualLock, setVisualLock] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement|null>(null); const messageRefs = useRef<Record<string, HTMLDivElement | null>>({}); const lastScrolledId = useRef<string | null>(null);
  const [rollOpen, setRollOpen] = useState(false); const [rollValue, setRollValue] = useState<number|null>(null);

  useEffect(()=>{ fetch('/rules.md').then(r=>r.text()).then(setRules).catch(()=>setRules('(нет rules.md)')) },[]);
  useEffect(()=>{
    const id=uid(); setVisualLock(true); setMessages([{id, role:'system', content:'', loadingKind:'image'}]);
    const startUrl=pollinationsUrl(buildScenePrompt("a grim pixel-art world panorama | t="+new Date().toISOString()));
    (async()=>{ await preloadImage(startUrl, 10_000); setMessages(m=>m.filter(x=>x.id!==id)); setMessages(m=>[...m,{id:uid(), role:'system', content:'', images:[startUrl]}]); setMessages(m=>[...m,{id:uid(), role:'narrator', content:'Добро пожаловать в Темный Мир, одинокая душа.'}]); setVisualLock(false); })();
  },[]);
  useEffect(()=>{ const last=[...messages].reverse().find(m=>m.role==='narrator'); if(!last||last.id===lastScrolledId.current) return;
    const el=messageRefs.current[last.id]; const c=chatScrollRef.current; if(el&&c){ lastScrolledId.current=last.id; const rect=el.getBoundingClientRect(); const crect=c.getBoundingClientRect(); const top=c.scrollTop+(rect.top-crect.top)-8; c.scrollTo({top, behavior:'smooth'}); }
  },[messages]);

  async function imageThenText(url:string, text:string){
    setVisualLock(true); const id=uid(); setMessages(m=>[...m,{id, role:'system', content:'', images:[], loadingKind:'image'}]);
    const st = await preloadImage(url, 10_000);
    if(st==='loaded'){ setMessages(m=>m.map(x=>x.id===id?{...x, images:[url], loadingKind:undefined}:x)); setMessages(m=>[...m,{id:uid(), role:'narrator', content:text}]); setVisualLock(false); }
    else { setMessages(m=>[...m,{id:uid(), role:'narrator', content:text}]); preloadImage(url, 60_000).then(s=>{ if(s==='loaded') setMessages(m=>m.map(x=>x.id===id?{...x, images:[url], loadingKind:undefined}:x)); else setMessages(m=>m.filter(x=>x.id!==id)); }).finally(()=>setVisualLock(false)); }
  }

  function applyUI(cmds: UICommand[], narratorText: string | null, sec: SecretaryOut | null){
    const sceneChanged = !!sec?.scene_changed; let sceneImageUrl: string | null=null; let creatureImageUrl: string | null=null;
    if (sec?.scene_name || sec?.scene_type || sec?.scene_id) { setWorld(w=>({...w, scene: sec!.scene_name ?? w.scene, sceneType: (sec!.scene_type ?? w.sceneType) as any, sceneId: sec!.scene_id ?? w.sceneId })); }
    for(const c of cmds){
      if(c.cmd==='set_scene') setWorld(w=>({...w, scene: c.payload.scene, sceneId: c.payload.scene_id ?? w.sceneId }));
      if(c.cmd==='show_image' && sceneChanged){ const src=sec?.image_prompts?.scene_en ?? c.payload.prompt; sceneImageUrl=pollinationsUrl(buildScenePrompt(src)); }
      if(c.cmd==='show_creature'){ const src=sec?.image_prompts?.creature_en ?? c.payload.prompt; creatureImageUrl=pollinationsUrl(buildCreaturePrompt(src)); }
    }
    if (narratorText){
      const mode = (sec?.event_type==='combat') ? 'Бой':'Сюжет';
      narratorText = runHiddenChecks(narratorText, character, { mode, lastRoll: null });
    }
    if(sceneChanged && sceneImageUrl && narratorText){ imageThenText(sceneImageUrl, narratorText); narratorText=null; }
    if(creatureImageUrl && narratorText){ imageThenText(creatureImageUrl, narratorText); narratorText=null; }
    if(narratorText) setMessages(m=>[...m,{id:uid(), role:'narrator', content:narratorText!}]);
  }

  async function sendMessage(){
    if (loading || visualLock) return;
    const text = input.trim(); if(!text) return; setInput(''); setMessages(m=>[...m,{id:uid(), role:'player', content:text}]); setLoading(true);
    try{
      await qwenLimiter.limit();
      const sec = await callOpenRouter({ model: "qwen/qwen-2.5-72b-instruct", messages: [{role:'system', content:'JSON only'}, {role:'user', content:`Персонаж: ${JSON.stringify(character)} Мир: ${JSON.stringify(world)} Сообщение игрока: ${text}`}], temperature:0.2, max_tokens:600 });
      const secParsed = parseLooselyJSON<SecretaryOut>(sec.text);
      let secObj: SecretaryOut | null = secParsed.ok ? (secParsed as any).value : null;
      await geminiLimiter.limit();
      const dm = await callOpenRouter({ model: "google/gemini-2.0-flash-lite-001", messages: [{role:'system', content:'Верни JSON {"to_player":"","to_ui":[]} только.'}, {role:'user', content:`Персонаж: ${JSON.stringify(character)} Мир: ${JSON.stringify(world)} Сообщение игрока: ${text}`}], temperature:0.75, max_tokens:700 });
      const dmParsed = parseLooselyJSON<{ to_player?: string; to_ui?: UICommand[] }>(dm.text);
      if(!dmParsed.ok){ setMessages(m=>[...m,{id:uid(), role:'narrator', content:dm.text }]); setLoading(false); return; }
      applyUI((dmParsed as any).value.to_ui||[], (dmParsed as any).value.to_player||'', secObj);
    }catch(e:any){ setMessages(m=>[...m,{id:uid(), role:'system', content:'Ошибка: '+String(e?.message||e)}]); }
    finally{ setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      <header className="p-2 px-3 bg-gradient-to-b from-zinc-950 to-zinc-900/30 border-b border-zinc-800/40">
        <div className="text-base font-semibold tracking-wide">Тёмный мир</div>
      </header>
      <div className="flex-1 overflow-hidden hidden md:grid grid-cols-[30%_30%_30%] gap-3 p-3 h-full">
        <section className="rounded-xl bg-zinc-900/20 border border-zinc-800/40"><LeftPanelCharacter character={character} onChange={setCharacter} /></section>
        <section className="rounded-xl bg-zinc-900/20 border border-zinc-800/40">
          <CenterChat messages={messages} setMessages={setMessages} chatScrollRef={chatScrollRef} messageRefs={messageRefs} />
          <div className="mt-2">
            <textarea className="w-full min-h-[56px] max-h-40 p-2 rounded-xl bg-zinc-900/70 text-sm" placeholder="Ваше действие…"
              value={input} onChange={e=>setInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter' && e.shiftKey){ e.preventDefault(); sendMessage(); }}} />
            <div className="flex gap-2 mt-2">
              <button className="px-4 py-2 rounded-lg bg-indigo-700 text-sm disabled:opacity-60" onClick={sendMessage} disabled={loading}>Отправить</button>
              <button className="px-3 py-2 rounded-lg bg-zinc-800 text-xs" onClick={()=>{ const v=Math.floor(Math.random()*20)+1; setRollValue(v); setRollOpen(true); }}>🎲</button>
            </div>
          </div>
        </section>
        <section className="rounded-xl bg-zinc-900/20 border border-zinc-800/40 p-2">
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Инвентарь</div>
          <div className="rounded-xl p-2 bg-zinc-900/40 text-xs text-zinc-400">Скоро…</div>
        </section>
      </div>

      {rollOpen && rollValue!=null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-sm border border-zinc-800/60 grid place-items-center gap-3">
            <div className="text-base font-semibold">Проверка (d20)</div>
            <D20RollLauncher value={rollValue} onDone={()=>{ setMessages(m=>[...m,{id:uid(), role:'system', content:`🎲 Проверка d20: **${rollValue}**`}]); setRollOpen(false); }} />
            <button className="px-3 py-2 rounded-xl bg-zinc-800 text-sm" onClick={()=>setRollOpen(false)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CenterChat({ messages, setMessages, chatScrollRef, messageRefs } : any){
  useEffect(()=>{
    const last=[...messages].reverse().find((m:any)=>m.role==='narrator'); if(!last) return;
    const el=messageRefs.current[last.id]; const c=chatScrollRef.current; if(el&&c){ const rect=el.getBoundingClientRect(); const crect=c.getBoundingClientRect(); const top=c.scrollTop+(rect.top-crect.top)-8; c.scrollTo({top, behavior:'smooth'}); }
  },[messages]);
  return (
    <div className="h-[calc(100%-110px)] overflow-y-auto space-y-2 pr-1" ref={chatScrollRef}>
      {messages.map((m:any)=>(<ChatBubble key={m.id} msg={m} setRef={(el:any)=>{ messageRefs.current[m.id]=el; }} />))}
    </div>
  );
}
function ChatBubble({ msg, setRef }:{ msg:any; setRef?:(el:HTMLDivElement|null)=>void }){
  const isPlayer = msg.role === 'player'; const align = isPlayer ? 'justify-end' : 'justify-start';
  const bubble = isPlayer ? 'bg-indigo-900/40 border border-indigo-700/30' : msg.role === 'narrator' ? 'bg-emerald-900/25 border border-emerald-700/20' : 'bg-zinc-900/40 border border-zinc-700/20';
  const widthClass = isPlayer ? 'max-w-[85%]' : 'w-full';
  return (
    <div className={`w-full flex ${align}`}>
      <div ref={setRef||undefined} className={`${widthClass} rounded-xl p-2 text-sm ${bubble}`} style={{scrollMarginTop:12}}>
        {msg.images && msg.images.length>0 && (<div className="mb-2"><img src={msg.images[0]} className="rounded-lg w-full object-cover" style={{clipPath:'inset(0 0 8% 0)'}} /></div>)}
        {msg.loadingKind==='image' && <div className="text-xs text-zinc-400">Рисует…</div>}
        {msg.content && <div className="whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{__html: formatHighlights(msg.content)}}/>}
      </div>
    </div>
  );
}
function formatHighlights(text: string){
  const esc=(s:string)=>s.replace(/[&<>]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[m]);
  let html=esc(text); html=html.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"); html=html.replace(/==(.+?)==/g, `<span style="background:rgba(250,204,21,.25); color:#fde68a; padding:0 .1rem; border-radius:.2rem">$1</span>`);
  return html;
}
