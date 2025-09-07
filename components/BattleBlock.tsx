// components/BattleBlock.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { useGame } from "./DarkWorldApp"; // useGame должен быть экспортирован именованно из DarkWorldApp.tsx

// ==== DEV переключатели ====
const DEV_AUTOSTART = true;              // ⇦ включить бой автоматически при монтировании (потом выключишь)
const DEV_HTML_BUTTONS_FALLBACK = true;  // ⇦ добавить HTML‑кнопки, если в SVG нет нужных id

// ==== типы и утилиты ====
type GPos = { gx:number; gy:number };
type Archetype = "Танк"|"Лучник"|"Ловкач"|"Маг"|"Берсерк";
type Enemy = {
  id: string;
  name: string;
  kind: Archetype;
  hp: number; hpMax:number;
  atk: number; def:number; speed:number; range:number;
  g: GPos;
  skipNextAttack?: boolean;
  alive: boolean;
};

const ARCH: Record<Archetype,{hp:number; atk:number; def:number; speed:number; range:number}> = {
  "Танк":   { hp:6, atk:2, def:13, speed:1, range:1 },
  "Лучник": { hp:2, atk:6, def:12, speed:1, range:4 },
  "Ловкач": { hp:2, atk:2, def:15, speed:2, range:1 },
  "Маг":    { hp:2, atk:6, def:12, speed:1, range:4 },
  "Берсерк":{ hp:3, atk:6, def:12, speed:1, range:1 },
};

function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)); }
function clampGrid(gx:number, gy:number){ return { gx: clamp(gx,-3,3), gy: clamp(gy,-2,2) }; }
function cheb(a:GPos, b:GPos){ return Math.max(Math.abs(a.gx-b.gx), Math.abs(a.gy-b.gy)); }
function d20(){ return 1 + Math.floor(Math.random()*20); }

export default function BattleBlock(){
  const { hero, setHero, battle, setBattle } = useGame();
  const [phase, setPhase] = useState<"hero"|"enemies">("hero");
  const [ap, setAp] = useState(1); // ОД
  const [aa, setAa] = useState(1); // ОА (бонус от Фокуса)
  const [overlaySvg, setOverlaySvg] = useState<string | null>(null);
  const [enemies, setEnemies] = useState<Enemy[]>([]);

  // контейнер и параметры проекции
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const proj = useRef({ stepX: 90, stepY: 90, heroPx: {x: 300, y: 400} });

  // === (0) DEV автозапуск боя (чтобы сразу увидеть всё) ===
  useEffect(()=>{
    if (!DEV_AUTOSTART) return;
    setBattle(b => b.active ? b : ({ ...b, active: true }));
  }, [setBattle]);

  // === (1) Подгон под центральную колонку: занимаем среднюю треть экрана ===
  const [hostStyle, setHostStyle] = useState<React.CSSProperties>({});
  useEffect(()=>{
    const calc = ()=>{
      const w = typeof window !== "undefined" ? window.innerWidth : 0;
      const isMobile = w < 768;
      if (isMobile){
        setHostStyle({ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:30, pointerEvents:"none" });
      } else {
        const colW = w/3;
        setHostStyle({ position:"fixed", top:0, left:colW, width:colW, height:"100vh", zIndex:30, pointerEvents:"none" });
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return ()=>window.removeEventListener("resize", calc);
  }, []);

  // === (2) Грузим SVG оверлей из public/ui ===
  useEffect(()=>{
    if (!battle.active) return;
    const tryPaths = [
      "/ui/darkworld_battle_overlay_vertical.svg",
      "/ui/battle_overlay_vertical.svg",
      "/ui/battle_overlay.svg",
      "/battle_overlay_vertical.svg",
      "/battle_overlay.svg",
    ];
    (async ()=>{
      for (const p of tryPaths){
        try{
          const r = await fetch(p);
          if (r.ok){
            setOverlaySvg(await r.text());
            return;
          }
        }catch{}
      }
      setBattle(b=>({...b, log:[...b.log, "SVG оверлей не найден (ищу в /public/ui)."]}));
    })();
  }, [battle.active, setBattle]);

  // === (3) Рендерим SVG, находим якоря, готовим врагов ===
  useEffect(()=>{
    if (!overlaySvg || !overlayRef.current || !battle.active) return;
    const root = overlayRef.current;
    root.innerHTML = overlaySvg;

    // заставим <svg> растянуться на контейнер
    const svg = root.querySelector("svg") as SVGSVGElement | null;
    if (svg){
      svg.setAttribute("width","100%");
      svg.setAttribute("height","100%");
      svg.setAttribute("preserveAspectRatio","xMidYMid meet");
      svg.removeAttribute("style");
      (svg as any).style.pointerEvents = "auto";
    }

    // центр героя
    const heroG = root.querySelector("#hero") as SVGGElement | null;
    let heroPx = { x: 360, y: 480 };
    if (heroG){
      const t = heroG.getAttribute("transform")??"";
      const m = t.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);
      if (m) heroPx = { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    }

    // спавны
    const spawns = Array.from(root.querySelectorAll('[id^="spawn-e"]')) as SVGGElement[];
    let localSpawns: Array<SVGGElement | {gx:number; gy:number}> = spawns;
    if (!localSpawns.length){
      // фолбэк: три логические точки перед героем
      localSpawns = [{gx:0,gy:2},{gx:-1,gy:2},{gx:1,gy:2}];
    }

    // оценим шаг сетки по спавнам (если спавны логические — используем дефолт)
    const dxs:number[] = [], dys:number[] = [];
    spawns.forEach(s=>{
      const t = s.getAttribute("transform")||"";
      const m = t.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);
      if (m){ dxs.push(Math.abs(parseFloat(m[1])-heroPx.x)); dys.push(Math.abs(parseFloat(m[2])-heroPx.y)); }
    });
    const median = (a:number[], fb:number)=>{ const v=a.filter(x=>x>0).sort((a,b)=>a-b); if(!v.length)return fb; const k=Math.floor(v.length/2); return v.length%2?v[k]:(v[k-1]+v[k])/2; };
    const stepX = Math.max(48, Math.round(median(dxs,96)));
    const stepY = Math.max(48, Math.round(median(dys,96)));
    proj.current = { stepX, stepY, heroPx };

    // собрать список врагов
    let initial: Enemy[] = [];
    const setup:any = (battle as any).setup;
    if (Array.isArray(setup?.enemies) && setup.enemies.length){
      initial = setup.enemies.map((e:any, idx:number)=>{
        const kind:Archetype = (e.kind ?? e.archetype ?? "Танк");
        const base = ARCH[kind];
        let gx=0, gy=0;
        const ss = typeof e.spawnId === "string" ? (root.querySelector(`#${e.spawnId}`) as SVGGElement | null) : null;
        const s = ss ?? (spawns[idx] || null);
        if (s){
          const t = s.getAttribute("transform")||"";
          const m = t.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);
          if (m){
            const px = { x: parseFloat(m[1]), y: parseFloat(m[2]) };
            gx = Math.round((px.x-heroPx.x)/stepX);
            gy = Math.round((px.y-heroPx.y)/stepY);
          }
        }
        gx = clamp(gx,-3,3); gy = clamp(gy,-2,2);
        return { id:e.id??`e${idx+1}`, name:e.name??`${kind} #${idx+1}`, kind,
          hp:e.hp??base.hp, hpMax:base.hp, atk:base.atk, def:base.def, speed:base.speed, range:base.range,
          g:{gx,gy}, alive:true };
      });
    } else {
      const kinds:Archetype[] = ["Танк","Лучник","Маг"];
      initial = localSpawns.slice(0,3).map((s:any, i:number)=>{
        const kind = kinds[i%kinds.length];
        const base = ARCH[kind];
        if (s instanceof SVGGElement){
          const t = s.getAttribute("transform")||"";
          const m = t.match(/translate\(([-0-9.]+),\s*([-0-9.]+)\)/);
          let gx=0,gy=0;
          if (m){
            const px = { x: parseFloat(m[1]), y: parseFloat(m[2]) };
            gx = Math.round((px.x-heroPx.x)/stepX);
            gy = Math.round((px.y-heroPx.y)/stepY);
          }
          gx = clamp(gx,-3,3); gy = clamp(gy,-2,2);
          return { id:`e${i+1}`, name:`${kind} #${i+1}`, kind,
            hp:base.hp, hpMax:base.hp, atk:base.atk, def:base.def, speed:base.speed, range:base.range,
            g:{gx,gy}, alive:true };
        } else {
          const gx = clamp(s.gx, -3,3);
          const gy = clamp(s.gy, -2,2);
          return { id:`e${i+1}`, name:`${kind} #${i+1}`, kind,
            hp:base.hp, hpMax:base.hp, atk:base.atk, def:base.def, speed:base.speed, range:base.range,
            g:{gx,gy}, alive:true };
        }
      });
    }
    setEnemies(initial);

    // Подцепим кнопки
    const btnF = root.querySelector("#btn-move-forward");
    const btnB = root.querySelector("#btn-move-back");
    const btnE = root.querySelector("#btn-end-turn");
    const onF = (e:any)=>{ e.preventDefault(); shiftAll(+1); };
    const onB = (e:any)=>{ e.preventDefault(); shiftAll(-1); };
    const onE = (e:any)=>{ e.preventDefault(); endHeroTurn(); };
    btnF?.addEventListener("click", onF);
    btnB?.addEventListener("click", onB);
    btnE?.addEventListener("click", onE);

    // если кнопок нет в svg — временная HTML‑панель
    let panel: HTMLDivElement | null = null;
    if (DEV_HTML_BUTTONS_FALLBACK && !btnF && !btnB && !btnE){
      panel = document.createElement("div");
      panel.className = "pointer-events-auto absolute left-2 right-2 bottom-3 flex gap-2 justify-center";
      const mk = (label:string, onClick:()=>void)=>{
        const b = document.createElement("button");
        b.textContent = label;
        b.className = "px-3 py-2 rounded bg-black/60 text-white border border-white/20 hover:bg-white/20";
        b.addEventListener("click", (e)=>{ e.preventDefault(); onClick(); });
        panel!.appendChild(b);
      };
      mk("Назад", ()=>shiftAll(-1));
      mk("Конец хода", ()=>endHeroTurn());
      mk("Вперёд", ()=>shiftAll(+1));
      overlayRef.current!.appendChild(panel);
    }

    // ДМ — единоразовое приветствие при старте
    if (!(battle as any).dmStarted){
      fetch("/api/narrator", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ prompt: "Начало боя. Опиши мрачную сцену в 2–3 фразах." }) })
        .then(r=>r.json()).then(({text})=>{
          setBattle(b=>({...b, dmStarted:true, log:[...b.log, `ДМ: ${text}`]}));
        }).catch(()=>{
          setBattle(b=>({...b, dmStarted:true, log:[...b.log, "ДМ: тишина перед бурей."]}));
        });
    }

    return ()=>{
      btnF?.removeEventListener("click", onF);
      btnB?.removeEventListener("click", onB);
      btnE?.removeEventListener("click", onE);
      if (panel && overlayRef.current && panel.parentElement === overlayRef.current){
        overlayRef.current.removeChild(panel);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaySvg, battle.active]);

  // === (4) Рендер простых маркеров врагов поверх SVG (временная заглушка) ===
  useEffect(()=>{
    if (!overlayRef.current) return;
    const root = overlayRef.current;
    // очистим старый слой
    Array.from(root.querySelectorAll("#npc-layer")).forEach(n=>n.parentElement?.removeChild(n));
    const layer = document.createElementNS("http://www.w3.org/2000/svg","g");
    layer.setAttribute("id","npc-layer");
    const svg = root.querySelector("svg");
    svg?.appendChild(layer);
    const { stepX, stepY, heroPx } = proj.current;
    enemies.forEach(e=>{
      if (!e.alive) return;
      const g = document.createElementNS("http://www.w3.org/2000/svg","g");
      g.setAttribute("id",`enemy-${e.id}`);
      const px = { x: heroPx.x + e.g.gx*stepX, y: heroPx.y + e.g.gy*stepY };
      g.setAttribute("transform",`translate(${px.x},${px.y})`);
      const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
      r.setAttribute("x","-18"); r.setAttribute("y","-18"); r.setAttribute("width","36"); r.setAttribute("height","36");
      r.setAttribute("fill", (e.kind==="Лучник"||e.kind==="Маг") ? "#6aa7ff" : "#ff7a7a");
      r.setAttribute("opacity","0.9"); g.appendChild(r);
      const t = document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("text-anchor","middle"); t.setAttribute("y","5"); t.setAttribute("fill","#fff"); t.setAttribute("font-size","10");
      t.textContent = e.kind[0]; g.appendChild(t);
      layer.appendChild(g);
    });
  }, [enemies]);

  // === (5) Начало хода героя: ОД/ОА, авто‑Фокус (DC12) ===
  useEffect(()=>{
    if (!battle.active || phase!=="hero") return;
    setAp(1); setAa(1);
    const modFocus = (hero as any).skills?.["Фокус"] ?? (hero as any).skills?.["фокус"] ?? 0;
    const roll = d20();
    if (roll + modFocus >= 12){
      setAa(a=>a+1);
      setBattle(b=>({...b, log:[...b.log, `D=${roll} + Фокус(${modFocus}) ≥ 12 → +1 ОА`]}));
    } else {
      setBattle(b=>({...b, log:[...b.log, `D=${roll} + Фокус(${modFocus}) < 12 → без бонуса`]}));
    }
  }, [phase, battle.active]);

  // === (6) Действия героя ===
  function endHeroTurn(){
    if (!battle.active) return;
    setBattle(b=>({...b, log:[...b.log, "Ход героя завершён."]}));
    setPhase("enemies");
    setTimeout(enemiesTurn, 120);
  }

  function shiftAll(dir:1|-1){
    if (phase!=="hero") return;
    if (ap<=0){ setBattle(b=>({...b, log:[...b.log, "Нет ОД для сдвига."]})); return; }
    // запрет: если клетка прямо спереди/сзади занята
    const front = dir===1 ? {gx:0,gy:+1} : {gx:0,gy:-1};
    if (enemies.some(e=>e.alive && e.g.gx===front.gx && e.g.gy===front.gy)){
      setBattle(b=>({...b, log:[...b.log, dir===1?"Вперёд нельзя — враг спереди.":"Назад нельзя — враг сзади."]})); return;
    }
    const occ = new Set(enemies.filter(e=>e.alive).map(e=>`${e.g.gx},${e.g.gy}`));
    const next = enemies.map(e=>{
      if (!e.alive) return e;
      function free(p:GPos){ return !occ.has(`${p.gx},${p.gy}`) && !(p.gx===0&&p.gy===0); }
      let tgt = clampGrid(e.g.gx, e.g.gy + dir);
      if (free(tgt)){ occ.delete(`${e.g.gx},${e.g.gy}`); occ.add(`${tgt.gx},${tgt.gy}`); return {...e, g:tgt}; }
      const diags = dir===1 ? [{gx:e.g.gx+1, gy:e.g.gy+1}, {gx:e.g.gx-1, gy:e.g.gy+1}]
                            : [{gx:e.g.gx+1, gy:e.g.gy-1}, {gx:e.g.gx-1, gy:e.g.gy-1}];
      for (const d of diags){
        const dd = clampGrid(d.gx, d.gy);
        if (free(dd)){ occ.delete(`${e.g.gx},${e.g.gy}`); occ.add(`${dd.gx},${dd.gy}`); return {...e, g:dd}; }
      }
      const far = clampGrid(e.g.gx, e.g.gy + dir*2);
      if (free(far)){ occ.delete(`${e.g.gx},${e.g.gy}`); occ.add(`${far.gx},${far.gy}`); return {...e, g:far}; }
      return e;
    });
    setEnemies(next);
    setAp(v=>v-1);
    setBattle(b=>({...b, log:[...b.log, dir===1?"Сдвиг вперёд: враги вниз":"Сдвиг назад: враги вверх"]}));
  }

  // === (7) Фаза врагов: дальние первыми, укрытие = иммунитет к дальним ===
  function enemiesTurn(){
    if (!battle.active) return;
    const heroG = { gx:0, gy:0 };
    const nearAny = enemies.some(e=>e.alive && cheb(e.g, heroG)<=1);
    const cover = !nearAny;
    if (cover) setBattle(b=>({...b, log:[...b.log, "Укрытие: иммунитет к дальним атакам на фазу врагов."]}));

    const rangedKinds = new Set<Archetype>(["Лучник","Маг"]);
    let arr = [...enemies];
    const ranged = arr.filter(e=>e.alive && rangedKinds.has(e.kind));
    const melee  = arr.filter(e=>e.alive && !rangedKinds.has(e.kind));

    function enemyAttack(idx:number){
      const e = arr[idx];
      const roll = d20();
      const heroDefBase = 12 + ((hero as any).skills?.["Оборона"] ?? (hero as any).skills?.["оборона"] ?? 0) + ((hero as any).luck ?? 0) - ((hero as any).fatigue ?? 0);
      const heroDef = (hero as any).effects?.some((s:string)=>/оглуш/i.test(s)) ? heroDefBase - 2 : heroDefBase;
      const hit = roll + e.atk >= heroDef;
      const line = `D=${roll} + ATK(${e.atk}) ≥ DEF(${heroDef}) → ${hit?"ХИТ":"мимо"} от ${e.name}`;
      setBattle(b=>({...b, log:[...b.log, line]}));
      if (hit){ setHero(h=>({...h, hp: Math.max(0, h.hp-1)})); }
    }

    // дальние
    ranged.forEach(e=>{
      const idx = arr.findIndex(x=>x.id===e.id);
      if (idx<0) return;
      const d = cheb(arr[idx].g, heroG);
      if (d<=1){
        // отступ
        const dx = arr[idx].g.gx===0 ? 0 : (arr[idx].g.gx>0? 1 : -1);
        const dy = arr[idx].g.gy===0 ? 0 : (arr[idx].g.gy>0? 1 : -1);
        const tryCells = [{gx:arr[idx].g.gx+dx, gy:arr[idx].g.gy+dy},{gx:arr[idx].g.gx+dx, gy:arr[idx].g.gy},{gx:arr[idx].g.gx, gy:arr[idx].g.gy+dy}]
          .map(c=>clampGrid(c.gx,c.gy));
        const occ = new Set(arr.filter((x,ii)=>x.alive && ii!==idx).map(x=>`${x.g.gx},${x.g.gy}`));
        const found = tryCells.find(c=>!occ.has(`${c.gx},${c.gy}`) && !(c.gx===0&&c.gy===0));
        if (found){ arr[idx] = {...arr[idx], g:found}; setBattle(b=>({...b, log:[...b.log, `${e.name} отступает.`]})); }
      } else {
        if ((arr[idx] as any).skipNextAttack){ setBattle(b=>({...b, log:[...b.log, `${e.name} пытается атаковать, но действие отменено.`]})); (arr[idx] as any).skipNextAttack=false; }
        else if (cover){ setBattle(b=>({...b, log:[...b.log, `${e.name} стреляет, но укрытие защищает героя.`]})); }
        else { enemyAttack(idx); }
      }
    });

    // ближние
    melee.forEach(e=>{
      const idx = arr.findIndex(x=>x.id===e.id);
      if (idx<0) return;
      let steps = arr[idx].speed;
      while (steps>0 && cheb(arr[idx].g, heroG)>1){
        const gx = arr[idx].g.gx, gy = arr[idx].g.gy;
        const toward = { gx: gx + (gx===0? 0 : (gx>0? -1 : 1)), gy: gy + (gy===0? 0 : (gy>0? -1 : 1)) };
        const cand = clampGrid(toward.gx, toward.gy);
        const occ = new Set(arr.filter((x,ii)=>x.alive && ii!==idx).map(x=>`${x.g.gx},${x.g.gy}`));
        if (!occ.has(`${cand.gx},${cand.gy}`)) arr[idx] = {...arr[idx], g:cand}; else break;
        steps--;
      }
      if (cheb(arr[idx].g, heroG)<=1){
        if ((arr[idx] as any).skipNextAttack){ setBattle(b=>({...b, log:[...b.log, `${e.name} замахивается, но действие отменено.`]})); (arr[idx] as any).skipNextAttack=false; }
        else enemyAttack(idx);
      }
    });

    setEnemies(arr);
    setBattle(b=>({...b, log:[...b.log, "Ход врагов завершён."]}));
    setPhase("hero");
  }

  if (!battle.active) return null;

  return (
    <div ref={hostRef} style={hostStyle} className="pointer-events-none">
      <div ref={overlayRef} className="w-full h-full pointer-events-auto" />
    </div>
  );
}
