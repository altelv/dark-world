"use client";
import React, { useMemo, useState, useEffect, createContext, useContext } from "react";

/**
 * ТЕМНЫЙ МИР — КАРКАС И БАЗОВЫЙ БОЙБЛОК (v0.1)
 * ПерсБлок • ИстБлок • Шкаф • БойБлок • КостиБлок
 */

type SkillMap = Record<string, number>;
type Hero = {
  name: string;
  hp: number; hpMax: number;
  luck: number; luckMax: number;
  fatigue: number; fatigueMax: number;
  skills: SkillMap;
  effects: string[];
};

type InventoryItem = { id: string; name: string; slot: string; mods: string };

type BattleState = { active: boolean; log: string[]; turn: number };
type DiceState = { show: boolean; value: number|null; rolling: boolean };

type GameCtxType = {
  hero: Hero; setHero: React.Dispatch<React.SetStateAction<Hero>>;
  inventory: InventoryItem[]; setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  story: string[]; setStory: React.Dispatch<React.SetStateAction<string[]>>;
  battle: BattleState; setBattle: React.Dispatch<React.SetStateAction<BattleState>>;
  dice: DiceState; setDice: React.Dispatch<React.SetStateAction<DiceState>>;
  bus: { say: (line: string)=>void; log: (line: string)=>void };
};

const GameCtx = createContext<GameCtxType | null>(null);
function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error("Game context missing");
  return ctx;
}

function GameProvider({ children }: { children: React.ReactNode }) {
  const [hero, setHero] = useState<Hero>({
    name: "Герой",
    hp: 10, hpMax: 10,
    luck: 3, luckMax: 3,
    fatigue: 0, fatigueMax: 5,
    skills: { "атака": 2, "оборона": 1, "фокус": 2 },
    effects: [],
  });

  const [inventory, setInventory] = useState<InventoryItem[]>([
    { id: "d1", name: "Кинжал", slot: "рука", mods: "+1 к атаке" },
    { id: "b1", name: "Плащ", slot: "торс", mods: "+1 к обороне в укрытии" },
    { id: "p1", name: "Зелье лечения", slot: "пояс", mods: "восст. 3 HP" },
  ]);

  const [story, setStory] = useState<string[]>([
    "Холодный ветер воет в разрушенной часовне.",
    "Тени шевелятся — охотник в маске приближается…",
  ]);

  const [battle, setBattle] = useState<BattleState>({ active: false, log: [], turn: 1 });
  const [dice, setDice] = useState<DiceState>({ show: false, value: null, rolling: false });

  const bus = useMemo(() => ({
    say: (line: string) => setStory(s => [...s, line]),
    log: (line: string) => setBattle(b => ({ ...b, log: [...b.log, line] })),
  }), []);

  const value: GameCtxType = { hero, setHero, inventory, setInventory, story, setStory, battle, setBattle, dice, setDice, bus };
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

/*************** Виджеты ***************/
function Bar({ label, value, max }: {label:string; value:number; max:number}){
  const pct = Math.max(0, Math.min(100, Math.round((value/max)*100)));
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-xs text-white/70">
        <span>{label}</span><span>{value}/{max}</span>
      </div>
      <div className="h-3 w-full rounded-xl bg-white/10 overflow-hidden">
        <div className="h-full bg-white/70" style={{width:`${pct}%`}} />
      </div>
    </div>
  );
}
function Panel({title, children, className=""}:{title:string; children:React.ReactNode; className?:string}){
  return (
    <div className={`rounded-2xl bg-neutral-900/60 shadow-lg p-4 ${className}`}>
      <div className="mb-3 text-sm tracking-wide text-white/80">{title}</div>
      {children}
    </div>
  );
}

/*************** ПерсБлок ***************/
function PersBlock(){
  const { hero } = useGame();
  return (
    <div className="space-y-4">
      <Panel title="Герой"><div className="text-xl font-semibold">{hero.name}</div></Panel>
      <Panel title="Шкалы">
        <div className="space-y-3">
          <Bar label="HP" value={hero.hp} max={hero.hpMax} />
          <Bar label="Удача" value={hero.luck} max={hero.luckMax} />
          <Bar label="Усталость" value={hero.fatigue} max={hero.fatigueMax} />
        </div>
        <div className="mt-3 text-xs text-white/60">Сводные эффекты от экипировки применяются здесь.</div>
      </Panel>
      <Panel title="Навыки">
        <ul className="text-sm space-y-1">
          {Object.entries(hero.skills).map(([k,v]) => (
            <li key={k} className="flex justify-between">
              <span className="text-white/70">{k}</span><span className="font-mono">+{v}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Эффекты">
        {hero.effects.length===0 ? <div className="text-sm text-white/60">Пока нет.</div> :
          <ul className="text-sm list-disc ml-5">{hero.effects.map((e,i)=>(<li key={i}>{e}</li>))}</ul>}
      </Panel>
    </div>
  );
}

/*************** Шкаф ***************/
function InventoryBlock(){
  const { inventory, setInventory, bus } = useGame();
  function usePotion(id:string){
    setInventory(items => items.filter(i=>i.id!==id));
    bus.say("Вы осушили зелье. +3 HP");
  }
  return (
    <div className="space-y-4">
      <Panel title="Инвентарь">
        <ul className="space-y-2">
          {inventory.map(it => (
            <li key={it.id} className="flex items-start justify-between rounded-xl bg-neutral-800/70 p-3">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="text-xs text-white/60">{it.slot} — {it.mods}</div>
              </div>
              {it.name.includes("Зелье") &&
                <button onClick={()=>usePotion(it.id)} className="rounded-xl px-3 py-1 text-sm bg-white/10 hover:bg-white/20">Выпить</button>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Посылка в ПерсБлок">
        <div className="text-xs text-white/60">Тут позже появятся модификаторы от снаряжения.</div>
      </Panel>
    </div>
  );
}

/*************** ИстБлок ***************/
function StoryBlock(){
  const { story, bus, setBattle, setDice } = useGame();
  const startBattle = ()=>{
    setBattle({ active: true, log: ["Бой начался."], turn: 1 });
    bus.say("Из тьмы выходят враги. Время сражаться!");
  };
  const showDice = ()=>{
    setDice({ show: true, value: null, rolling: true });
    setTimeout(()=>{
      const val = 1 + Math.floor(Math.random()*20);
      setDice({ show: true, value: val, rolling: false });
    }, 600);
  };
  return (
    <div className="space-y-4">
      <Panel title="Рассказ">
        <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
          {story.map((s,i)=>(<p key={i} className="text-white/80 leading-relaxed">{s}</p>))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={startBattle} className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20">Начать бой</button>
          <button onClick={showDice} className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20">Проверка D20</button>
        </div>
      </Panel>
      <Panel title="Лог"><div className="text-sm text-white/60">Здесь ИстРеж пишет краткую сводку предыдущего события.</div></Panel>
    </div>
  );
}

/*************** БойБлок — оверлей ***************/
function BattleBlock(){
  const { battle, setBattle, bus } = useGame();
  const [ap, setAp] = useState(1); // ОД
  const [aa, setAa] = useState(1); // ОА
  useEffect(()=>{
    if (!battle.active) return;
    setAp(1); setAa(1);
  }, [battle.active, battle.turn]);
  if (!battle.active) return null;

  const endTurn = ()=> setBattle(b => ({ ...b, turn: b.turn+1, log: [...b.log, `Ход ${b.turn} завершён.`]}));
  const move = (dir:string)=>{ if (ap<=0) return; setAp(ap-1); setBattle(b=>({...b, log:[...b.log, `Герой двигается: ${dir}.`] })); };
  const attack = (kind:string)=>{ if (aa<=0) return; setAa(aa-1); const hit = Math.random() < 0.6;
    setBattle(b=>({...b, log:[...b.log, `${kind}: ${hit? "УДАР УСПЕШЕН":"ПРОМАХ"}`]})); bus.say(hit? "Клинок находит щель в броне.":"Противник уходит в тень."); };
  const closeBattle = ()=> setBattle({ active:false, log:[], turn:1 });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="Текст БойРеж" className="md:col-span-3 max-h-40 overflow-auto">
          <p className="text-white/80">Каменные плиты скользкие от дождя. Враги окружили вас.</p>
        </Panel>
        <Panel title="Поле боя" className="md:col-span-2">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({length:35}).map((_,i)=>(
              <div key={i} className="aspect-square rounded-xl border border-white/10 text-[10px] flex items-center justify-center text-white/50 select-none">
                {i===24? "ГЕРОЙ": ""}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <button onClick={()=>move("вверх")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">⬆️ Движение</button>
            <button onClick={()=>move("влево")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">⬅️</button>
            <button onClick={()=>move("вправо")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">➡️</button>
            <div />
            <button onClick={()=>move("вниз")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">⬇️</button>
            <div />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-white/70">
            <div>ОД: <b>{ap}</b> • ОА: <b>{aa}</b> • Раунд: <b>{Math.ceil(battle.turn/2)}</b></div>
            <div className="flex gap-2">
              <button onClick={()=>attack("Атака кинжалом")} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20">Кинжал</button>
              <button onClick={()=>attack("Заклинание морока")} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20">Морок</button>
            </div>
          </div>
        </Panel>
        <Panel title="Лог боя">
          <div className="max-h-40 overflow-auto pr-1 text-sm space-y-1">
            {battle.log.map((l,i)=>(<div key={i} className="text-white/80">{l}</div>))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={endTurn} className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20">Конец хода</button>
            <button onClick={closeBattle} className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20">Завершить бой</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/*************** КостиБлок ***************/
function DiceBlock(){
  const { dice, setDice } = useGame();
  if (!dice.show) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setDice({show:false,value:null,rolling:false})}/>
      <div className="relative z-10 rounded-2xl bg-neutral-900/90 p-6 shadow-2xl text-center">
        <div className="text-sm text-white/70 mb-2">Проверка D20</div>
        <div className="text-6xl font-bold tracking-wider">{dice.rolling? "…": dice.value}</div>
        <button onClick={()=>setDice({show:false,value:null,rolling:false})} className="mt-4 rounded-xl bg-white/10 px-4 py-2 hover:bg-white/20">Ок</button>
      </div>
    </div>
  );
}

/*************** 3 колонки ***************/
function Columns(){
  const [tab, setTab] = useState(1);
  return (
    <div className="mx-auto h-screen max-w-7xl p-3 md:p-6 text-white">
      <div className="mb-3 flex gap-2 md:hidden">
        <button onClick={()=>setTab(0)} className={`rounded-xl px-3 py-2 text-sm ${tab===0?"bg-white/20":"bg-white/10"}`}>Герой</button>
        <button onClick={()=>setTab(1)} className={`rounded-xl px-3 py-2 text-sm ${tab===1?"bg-white/20":"bg-white/10"}`}>Рассказ</button>
        <button onClick={()=>setTab(2)} className={`rounded-xl px-3 py-2 text-sm ${tab===2?"bg-white/20":"bg-white/10"}`}>Инвентарь</button>
      </div>
      <div className="grid h-[calc(100vh-72px)] grid-cols-1 gap-4 md:h-[calc(100vh-48px)] md:grid-cols-3">
        <div className={`overflow-auto ${tab!==0?"hidden md:block":""}`}><PersBlock/></div>
        <div className={`overflow-auto ${tab!==1?"hidden md:block":""}`}><StoryBlock/></div>
        <div className={`overflow-auto ${tab!==2?"hidden md:block":""}`}><InventoryBlock/></div>
      </div>
      <BattleBlock/>
      <DiceBlock/>
    </div>
  );
}

export default function DarkWorldApp(){
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-neutral-950 to-black">
      <GameProvider>
        <header className="mx-auto max-w-7xl p-4 text-white/80">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-wide">ТЁМНЫЙ МИР — каркас v0.1</h1>
            <div className="text-xs opacity-70">ПерсБлок • ИстБлок • Шкаф • БойБлок • КостиБлок</div>
          </div>
        </header>
        <Columns/>
      </GameProvider>
    </div>
  );
}
