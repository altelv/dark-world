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
function d20(){ return 1 + Math.floor(Math.random()*20); }

type Archetype = "Танк" | "Лучник" | "Ловкач" | "Маг" | "Берсерк";
type Enemy = {
  id: string;
  name: string;
  kind: Archetype;
  hp: number;
  hpMax: number;
  atk: number; // бонус к атаке (для их хода)
  def: number; // защитный DC (базовый 12 + бонусы)
  pos: {x:number;y:number}; // клетка на поле
  alive: boolean;
};

const ARCH: Record<Archetype,{hp:number; atk:number; def:number; speed:number; range:number}> = {
  "Танк":   { hp: 6, atk: 2, def: 13, speed: 1, range: 1 },
  "Лучник": { hp: 2, atk: 6, def: 12, speed: 1, range: 4 },
  "Ловкач": { hp: 2, atk: 2, def: 15, speed: 2, range: 1 },
  "Маг":    { hp: 2, atk: 6, def: 12, speed: 1, range: 4 },
  "Берсерк":{ hp: 3, atk: 6, def: 12, speed: 1, range: 1 },
};

function dist(a:{x:number;y:number}, b:{x:number;y:number}){
  return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)); // Chebyshev (диагональ=1)
}

function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)); }

function d20(){ return 1 + Math.floor(Math.random()*20); }

type Archetype = "Танк" | "Лучник" | "Ловкач" | "Маг" | "Берсерк";
type Enemy = {
  id: string;
  name: string;
  kind: Archetype;
  hp: number;
  hpMax: number;
  atk: number; // бонус к атаке (для их хода)
  def: number; // защитный DC (базовый 12 + бонусы)
  pos: {x:number;y:number}; // клетка на поле
  alive: boolean;
};

const ARCH: Record<Archetype,{hp:number; atk:number; def:number; speed:number; range:number}> = {
  "Танк":   { hp: 6, atk: 2, def: 13, speed: 1, range: 1 },
  "Лучник": { hp: 2, atk: 6, def: 12, speed: 1, range: 4 },
  "Ловкач": { hp: 2, atk: 2, def: 15, speed: 2, range: 1 },
  "Маг":    { hp: 2, atk: 6, def: 12, speed: 1, range: 4 },
  "Берсерк":{ hp: 3, atk: 6, def: 12, speed: 1, range: 1 },
};

function dist(a:{x:number;y:number}, b:{x:number;y:number}){
  return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)); // Chebyshev (диагональ=1)
}

function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)); }

function BattleBlock(){
  const { hero, setHero, battle, setBattle, bus } = useGame();
  const W = 7, H = 5;

  // Состояния боя
  const [ap, setAp] = useState(1); // ОД
  const [aa, setAa] = useState(1); // ОА
  const [heroPos, setHeroPos] = useState({x:3, y:3});
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [phase, setPhase] = useState<"hero"|"enemies">("hero"); // фиксированный порядок
  const [round, setRound] = useState(1);

  // Инициализация боя
  useEffect(()=>{
    if (!battle.active) return;
    const pack: Enemy[] = [
      { id:"e1", name:"Охотник-танк", kind:"Танк",    hp:ARCH["Танк"].hp,    hpMax:ARCH["Танк"].hp,    atk:ARCH["Танк"].atk,    def:ARCH["Танк"].def,    pos:{x:1,y:1}, alive:true },
      { id:"e2", name:"Лучник в маске", kind:"Лучник", hp:ARCH["Лучник"].hp, hpMax:ARCH["Лучник"].hp, atk:ARCH["Лучник"].atk, def:ARCH["Лучник"].def, pos:{x:5,y:1}, alive:true },
      { id:"e3", name:"Ловкач-тень",   kind:"Ловкач", hp:ARCH["Ловкач"].hp, hpMax:ARCH["Ловкач"].hp, atk:ARCH["Ловкач"].atk, def:ARCH["Ловкач"].def, pos:{x:5,y:3}, alive:true },
    ];
    setEnemies(pack);
    setHeroPos({x:3,y:3});
    setPhase("hero");
    setRound(1);
    startHeroTurn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.active]);

  // Проверка конца боя/смерти героя (HOOK ДОЛЖЕН БЫТЬ ДО ЛЮБОГО RETURN)
  useEffect(()=>{
    if (!battle.active) return;
    if (enemies.length>0 && enemies.every(e => !e.alive)){
      setBattle(b => ({...b, log:[...b.log, "Все враги повержены. Победа!"]}));
    }
    if (hero.hp <= 0){
      setBattle(b => ({...b, log:[...b.log, "Вы пали. Тьма поглощает…"]}));
    }
  }, [enemies, hero.hp, battle.active, setBattle]);

  // ТОЛЬКО ПОСЛЕ ВСЕХ HOOKS — условный выход
  if (!battle.active) return null;

  // --- ЛОГИКА ГЕРОЯ И ВРАГОВ ---
  function startHeroTurn(first=false){
    setAp(1);
    setAa(1);
    const hasStress = hero.effects?.some(e => /стресс/i.test(e));
    const roll = d20();
    const mod = hero.skills?.["фокус"] ?? hero.skills?.["Фокус"] ?? 0;
    const targetDC = 12;
    const success = roll + mod >= targetDC;
    if (hasStress) {
      if (success){
        setHero(h => ({...h, effects: (h.effects||[]).filter(e => !/стресс/i.test(e))}));
        setBattle(b => ({...b, log:[...b.log, `Фокус ${roll}+${mod} ≥ ${targetDC}: Стресс снят.`]}));
        bus.say("Вы берёте себя в руки. В голове проясняется.");
      } else {
        setBattle(b => ({...b, log:[...b.log, `Фокус ${roll}+${mod} < ${targetDC}: стресс остаётся.`]}));
      }
    } else {
      if (success) {
        setAa(a => a + 1);
        setBattle(b => ({...b, log:[...b,].log}));
        setBattle(b => ({...b, log:[...b.log, `Фокус ${roll}+${mod} ≥ ${targetDC}: получено доп. ОА.`]}));
      } else {
        setBattle(b => ({...b, log:[...b.log, `Фокус ${roll}+${mod} < ${targetDC}: без бонуса.`]}));
      }
    }
    if(!first) bus.say("Ваш ход.");
  }

  function endHeroTurn(){
    setPhase("enemies");
    setBattle(b => ({...b, log:[...b.log, "Ход Героя завершён."]}));
    setTimeout(enemiesTurn, 200);
  }

  function enemiesTurn(){
    setBattle(b => ({...b, log:[...b.log, "Ход Врагов."]}));
    setEnemies(prev => {
      let arr = [...prev];
      arr.forEach((e)=>{
        if (!e.alive) return;
        const R = ARCH[e.kind].range;
        const S = ARCH[e.kind].speed;
        if (dist(e.pos, heroPos) > R){
          const dx = Math.sign(heroPos.x - e.pos.x);
          const dy = Math.sign(heroPos.y - e.pos.y);
          e.pos = { x: clamp(e.pos.x + (dx>0?1:dx<0?-1:0)*Math.min(S,abs(dx:=Math.abs(heroPos.x - e.pos.x))?1:1), y: clamp(e.pos.y + (dy>0?1:dy<0?-1:0)*Math.min(S,abs(dy:=Math.abs(heroPos.y - e.pos.y))?1:1), 0, H-1) };
        }
        if (dist(e.pos, heroPos) <= R){
          const roll = d20();
          const heroDef = 12 + (hero.skills?.["оборона"] ?? hero.skills?.["Оборона"] ?? 0) + (hero.luck ?? 0) - (hero.fatigue ?? 0);
          const total = roll + e.atk;
          const hit = total >= heroDef;
          setBattle(b => ({...b, log:[...b.log, `${e.name} атакует (${roll}+${e.atk} против ${heroDef}): ${hit?"ПОПАЛ":"мимо"}`]}));
          if (hit){
            setHero(h => ({...h, hp: Math.max(0, h.hp - 1)}));
          }
        }
      });
      return arr;
    });
    setTimeout(()=>{
      setPhase("hero");
      setRound(r => r + 1);
      setBattle(b => ({...b, log:[...b.log, "Ход Врагов завершён."]}));
      startHeroTurn();
    }, 200);
  }

  function move(dir:"up"|"down"|"left"|"right"){
    if (phase!=="hero" || ap<=0) return;
    const d = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} }[dir];
    const nx = clamp(heroPos.x + d.x, 0, W-1);
    const ny = clamp(heroPos.y + d.y, 0, H-1);
    if (nx===heroPos.x && ny===heroPos.y) return;
    setHeroPos({x:nx, y:ny});
    setAp(ap-1);
    setBattle(b => ({...b, log:[...b.log, `Герой двигается (${dir}).`]}));
  }

  function pickTarget(id:string){ setSelectedId(id); }

  function attack(kind:"Кинжал"|"Морок"){
    if (phase!=="hero" || aa<=0) return;
    const target = enemies.find(e => e.id===selectedId && e.alive);
    if (!target) { setBattle(b=>({...b, log:[...b.log, "Нет выбранной цели."]})); return; }
    const rng = kind==="Кинжал"? 1 : 4;
    if (dist(heroPos, target.pos) > rng){
      setBattle(b=>({...b, log:[...b.log, `${kind}: цель вне досягаемости.`]}));
      return;
    }
    const roll = d20();
    const skillKey = kind==="Кинжал" ? "атака" : "фокус";
    const modSkill = hero.skills?.[skillKey] ?? hero.skills?.[skillKey[0].toUpperCase()+skillKey.slice(1)] ?? 0;
    const total = roll + modSkill + (hero.luck ?? 0) - (hero.fatigue ?? 0);
    const hit = total >= target.def;
    setBattle(b => ({...b, log:[...b.log, `${kind} по ${target.name} (${roll}+${modSkill}+удача${hero.luck??0}-усталость${hero.fatigue??0} против ${target.def}): ${hit?"УДАР":"промах"}`]}));
    if (hit){
      setEnemies(arr => arr.map(e => e.id===target.id ? ({...e, hp: Math.max(0, e.hp-1), alive: e.hp-1>0}) : e));
      bus.say(kind==="Кинжал" ? "Кровь тёмным росчерком на камнях." : "Мир изгибается, и враг теряет опору.");
    }
    setAa(aa-1);
  }

  function endBattle(){ setBattle({ active:false, log:[], turn:1 }); }

  // UI
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title={`Бой • Раунд ${round}`} className="md:col-span-3">
          <div className="text-xs text-white/70">Порядок: Герой → Враги. Сейчас ход: <b>{phase==="hero"?"Героя":"Врагов"}</b>. ОД: <b>{ap}</b> • ОА: <b>{aa}</b></div>
        </Panel>
        <Panel title="Поле боя" className="md:col-span-2">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({length:W*H}).map((_,i)=>{
              const x = i % W, y = Math.floor(i/W);
              const hereEnemies = enemies.filter(e => e.alive && e.pos.x===x && e.pos.y===y);
              const isHero = heroPos.x===x && heroPos.y===y;
              return (
                <div key={i} className={`aspect-square rounded-xl border border-white/10 text-[10px] flex items-center justify-center select-none ${isHero?"bg-white/10":""}`}>
                  {isHero ? "ГЕРОЙ" : hereEnemies.length>0 ? "ВРАГ" : ""}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <button onClick={()=>move("up")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">⬆️ Движение</button>
            <button onClick={()=>move("left")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">⬅️</button>
            <button onClick={()=>move("right")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">➡️</button>
            <div />
            <button onClick={()=>move("down")} className="rounded-xl bg-white/10 py-2 hover:bg-white/20">⬇️</button>
            <div />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/70">
            <div>ОД: <b>{ap}</b> • ОА: <b>{aa}</b> • Раунд: <b>{round}</b></div>
            <div className="flex gap-2">
              <button onClick={()=>attack("Кинжал")} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20">Кинжал</button>
              <button onClick={()=>attack("Морок")} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20">Морок</button>
              <button onClick={endHeroTurn} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20" disabled={phase!=="hero"}>Конец хода</button>
            </div>
          </div>
        </Panel>
        <Panel title="Цели и лог">
          <div className="space-y-3">
            <div className="space-y-2">
              {enemies.map(e => (
                <div key={e.id} className={`rounded-xl p-2 text-sm ${!e.alive?"opacity-40":""} ${selectedId===e.id?"bg-white/10":"bg-white/5"}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{e.name} <span className="text-white/50">({e.kind})</span></div>
                    <button onClick={()=>setSelectedId(e.id)} className="rounded-xl px-2 py-1 bg-white/10 hover:bg-white/20 text-xs">Цель</button>
                  </div>
                  <div className="text-xs text-white/70 mt-1">HP {e.hp}/{e.hpMax} • DEF {e.def} • RNG {ARCH[e.kind].range}</div>
                </div>
              ))}
            </div>
            <div className="max-h-44 overflow-auto pr-1 text-sm space-y-1 border-t border-white/10 pt-2">
              {battle.log.map((l,i)=>(<div key={i} className="text-white/80">{l}</div>))}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setBattle(b=>({...b, active:false}))} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20">Завершить бой</button>
              <button onClick={()=>{ setBattle(b=>({...b, log:[]})); }} className="rounded-xl px-3 py-1 bg-white/10 hover:bg-white/20">Очистить лог</button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}


/************** 3 колонки ***************/
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
