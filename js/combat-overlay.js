// js/combat-overlay.js — v1.3
// Changes:
// - Forward movement now supports 1 cell AND 2 cells.
// - Robust cell map: if data-x/data-y absent, parse from id="cell_x_y".
// - Optional quick button: #btn_move_forward1 (forward 1).
// - World-camera mapping preserved; grid does not rotate; hero fixed at (0,0).
// - Minor: forward-2 highlight blocked if intermediate (0,1) occupied.

const ASSETS = {
  hero: "/assets/combat/hero.png",
  enemy: "/assets/combat/enemy.png",
  boss:  "/assets/combat/boss.png",
};

// helpers
const qs  = (r,s)=> (r||document).querySelector(s);
const qsa = (r,s)=> Array.from((r||document).querySelectorAll(s));
const svgNS = tag => document.createElementNS("http://www.w3.org/2000/svg", tag);
const dispatch = (name, detail={}) => window.dispatchEvent(new CustomEvent(name,{ detail }));
const key = (x,y)=>`${x},${y}`;

// state
const state = {
  hero: { defense:false },
  atk: 1, move: 1, simple: 1,
  turnsTotal: 0,
  draft: [],
  snapshot: null,
  enemies: [
    { id:"e1", kind:"enemy", name:"Гоблин-лучник", x:-1, y:3, pips:3 },
    { id:"b1", kind:"boss",  name:"Кровавый череп", x: 1, y:3, pips:5 },
  ],
  camera: { ox:0, oy:0, orientation:0 }, // 0/90/180/270 (cw)
  options: { rangerPrecise:false },
};

const OFFSETS = {
  hero: { dx:-16, dy:-57, w:96, h:112 },
  enemy:{ dx:-15, dy:-39, w:96, h:112 },
  boss: { dx:-16, dy:-51, w:96, h:112 },
};

let $wrap=null, $svg=null, $cells=null, $sprites=null, $hl=null;
let cellMap = new Map();
let highlighted = new Set();
let prevDocOverflow = "";

window.CombatOverlay = { open, close, finish: finishBattle };

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("open-combat") || document.getElementById("dev-open-battle");
  if(btn) btn.addEventListener("click", open);
});

function loadOverlay(){
  return fetch("/combat-overlay.svg", { cache:"no-store" })
    .then(r=>r.text())
    .then(html=>{
      const wrap = document.createElement("div");
      wrap.id = "combat-overlay-wrap";
      Object.assign(wrap.style, {
        position:"fixed", inset:"0", zIndex:9999, display:"none",
        overflow:"auto", padding:"16px", boxSizing:"border-box",
        background:"transparent", justifyContent:"center", alignItems:"flex-start",
      });
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      const svgEl = wrap.querySelector("svg");
      if(svgEl){
        Object.assign(svgEl.style, {
          display:"block", width:"920px", maxWidth:"96vw", height:"auto", maxHeight:"94vh",
          margin:"2vh auto", flexShrink:0
        });
      }
      window.addEventListener("keydown", e=>{ if(e.key==="Escape") close(true); });
      return wrap;
    });
}

function open(){
  const ensure = $wrap ? Promise.resolve($wrap) : loadOverlay();
  ensure.then(w=>{
    $wrap = w;
    $svg = qs($wrap, "svg");
    $cells = qsa($wrap, '#cells rect[id^="cell_"]');
    $sprites = qs($wrap, "#sprites");
    if(!$svg || !$cells.length || !$sprites){
      console.error("SVG anchors missing: svg/cells/sprites"); 
      $wrap.style.display="flex"; 
      return; 
    }

    buildCellMap();
    ensureHL();
    setupButtons();
    mountSprites();
    resetCounters();
    updateHighlights();

    qs($wrap, "#btn_ranger_precise")?.classList.add("hidden");

    $wrap.style.display="flex";
    $wrap.style.justifyContent="center";
    $wrap.style.alignItems="flex-start";
    prevDocOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    dispatch("combat:open", {
      camera: {...state.camera},
      enemies: state.enemies.map(e=>({id:e.id,kind:e.kind,name:e.name,x:e.x,y:e.y,pips:e.pips})),
      options: state.options
    });
  });
}

function close(byEsc=false){
  if($wrap) $wrap.style.display = "none";
  document.documentElement.style.overflow = prevDocOverflow || "";
  dispatch("combat:close", { byEsc, battle_turns_total: state.turnsTotal });
}

// ----- camera/orientation mapping -----
function rotApply(x,y,deg){
  switch(((deg%360)+360)%360){
    case 0:   return {x,y};
    case 90:  return {x:y, y:-x};
    case 180: return {x:-x, y:-y};
    case 270: return {x:-y, y:x};
    default:  return {x,y};
  }
}
function worldToScreen(wx,wy){
  const rx = wx - state.camera.ox;
  const ry = wy - state.camera.oy;
  return rotApply(rx, ry, state.camera.orientation);
}
function screenToWorld(sx,sy){
  const inv = (360 - state.camera.orientation)%360;
  const p = rotApply(sx, sy, inv);
  return { x: p.x + state.camera.ox, y: p.y + state.camera.oy };
}
// -------------------------------------

// Build map of screen cells from SVG
function buildCellMap(){
  cellMap.clear();
  for(const r of $cells){
    let x = +r.getAttribute("data-x");
    let y = +r.getAttribute("data-y");
    if(!Number.isFinite(x) || !Number.isFinite(y)){
      // Fallback: parse from id="cell_{x}_{y}"
      const m = (r.id||"").match(/^cell_(-?\d+)_(-?\d+)$/);
      if(m){ x = parseInt(m[1],10); y = parseInt(m[2],10); }
    }
    if(Number.isFinite(x) && Number.isFinite(y)){
      r.setAttribute("data-x", x);
      r.setAttribute("data-y", y);
      cellMap.set(key(x,y), {x,y,rect:r});
    }
  }
}

function ensureHL(){
  $hl = qs($wrap, "#highlights");
  if(!$hl){
    $hl = svgNS("g");
    $hl.setAttribute("id","highlights");
    const boardGroup = qs($wrap, "#cam") || qs($wrap, "#board") || $svg;
    const sprites = qs($wrap, "#sprites");
    (sprites?.parentNode || boardGroup).insertBefore($hl, sprites || null);
  }
}
function clearHL(){
  highlighted.clear();
  while($hl.firstChild) $hl.removeChild($hl.firstChild);
}
function highlightCell(sx,sy, style={fill:"#313A49", opacity:0.95, stroke:"#7A57C6", strokeWidth:0}){
  const c = cellMap.get(key(sx,sy));
  if(!c) return;
  const r = svgNS("rect");
  r.setAttribute("x", c.rect.getAttribute("x"));
  r.setAttribute("y", c.rect.getAttribute("y"));
  r.setAttribute("width", c.rect.getAttribute("width"));
  r.setAttribute("height", c.rect.getAttribute("height"));
  r.setAttribute("rx", c.rect.getAttribute("rx")||8);
  r.setAttribute("ry", c.rect.getAttribute("ry")||8);
  r.setAttribute("fill", style.fill);
  r.setAttribute("opacity", style.opacity);
  if(style.strokeWidth>0){ r.setAttribute("stroke", style.stroke); r.setAttribute("stroke-width", style.strokeWidth); }
  r.style.pointerEvents="none";
  $hl.appendChild(r);
  highlighted.add(key(sx,sy));
}

function enemyAtScreen(sx,sy){
  return state.enemies.some(e=>{
    const s = worldToScreen(e.x,e.y);
    return s && s.x===sx && s.y===sy;
  });
}

function allowedWorldMoves(){
  // Vectors defined in world coords before orientation
  return [
    {x:0, y:-1},         // back
    {x:-1, y:-1}, {x:1, y:-1}, // back diag
    {x:-1, y:0}, {x:1, y:0},   // left / right
    {x:0, y:1},          // forward 1  (NEW)
    {x:0, y:2},          // forward 2
    {x:-1, y:1}, {x:1, y:1},   // forward diag
  ];
}
function pathClearForScreenVector(sx,sy){
  // Only special-case forward-2: block if (0,1) is occupied
  if(sx===0 && sy===2){
    return !enemyAtScreen(0,1);
  }
  return true;
}
function updateHighlights(){
  clearHL();
  if(state.move<=0) return;
  for(const v of allowedWorldMoves()){
    const s = rotApply(v.x, v.y, state.camera.orientation); // vector in screen coords
    const sx = s.x; const sy = s.y;
    if(!cellMap.has(key(sx,sy))) continue;
    if(enemyAtScreen(sx,sy)) continue;
    if(!pathClearForScreenVector(sx,sy)) continue;
    highlightCell(sx,sy);
  }
}

function moveByScreenTarget(sx,sy){
  if(state.move<=0) return false;
  if(!highlighted.has(key(sx,sy))) return false;
  const w = screenToWorld(sx,sy);
  state.camera.ox += w.x;
  state.camera.oy += w.y;
  state.move -= 1;
  pushDraft(`Сместился к клетке (${sx}, ${sy})`);
  mountSprites();
  updateCounters();
  updateHighlights();
  return true;
}

function placeImageAtCell(kind, cell){
  const {rect} = cell;
  const x = +rect.getAttribute("x");
  const y = +rect.getAttribute("y");
  const off = OFFSETS[kind];
  const img = svgNS("image");
  img.setAttributeNS("http://www.w3.org/1999/xlink","href", ASSETS[kind]);
  img.setAttribute("x", x + off.dx);
  img.setAttribute("y", y + off.dy);
  img.setAttribute("width", off.w);
  img.setAttribute("height", off.h);
  img.style.pointerEvents="none";
  return img;
}

function addPipsAndNameAtScreen(group, pips, name, sx, sy){
  const cell = cellMap.get(key(sx,sy)); if(!cell) return;
  const r = cell.rect;
  const cx = +r.getAttribute("x") + 32;
  const yBase = +r.getAttribute("y") + 56;
  const row = Math.min(pips,5);
  const diam=8,gap=3,totalW=row*diam+(row-1)*gap; const start=cx-totalW/2+diam/2;
  const g = svgNS("g");
  for(let i=0;i<row;i++){
    const c = svgNS("circle");
    c.setAttribute("cx", start+i*(diam+gap)); c.setAttribute("cy", yBase);
    c.setAttribute("r", diam/2); c.setAttribute("fill","#B74141");
    c.setAttribute("stroke","#2A2E37"); c.setAttribute("stroke-width","1");
    g.appendChild(c);
  }
  group.appendChild(g);
  const t = svgNS("text"); t.textContent=name;
  t.setAttribute("x", cx); t.setAttribute("y", yBase+14);
  t.setAttribute("fill","#FFFFFF"); t.setAttribute("font-size","11");
  t.setAttribute("font-family","Arial, sans-serif"); t.setAttribute("text-anchor","middle");
  t.setAttribute("paint-order","stroke"); t.setAttribute("stroke","#171920"); t.setAttribute("stroke-width","1");
  group.appendChild(t);
}

function mountSprites(){
  while($sprites.firstChild) $sprites.removeChild($sprites.firstChild);

  // hero at screen (0,0)
  const heroCell = cellMap.get(key(0,0));
  if(heroCell){
    const gh = svgNS("g"); gh.setAttribute("id","sprite_hero");
    const hi = placeImageAtCell("hero", heroCell);
    if(hi) gh.appendChild(hi);
    $sprites.appendChild(gh);
  }

  for(const e of state.enemies){
    const s = worldToScreen(e.x, e.y);
    if(!s || !cellMap.has(key(s.x,s.y))) continue; // out of board/FOV
    const g = svgNS("g"); g.setAttribute("id", `sprite_${e.id}`);
    const ei = placeImageAtCell(e.kind, cellMap.get(key(s.x,s.y)));
    if(ei) g.appendChild(ei);
    addPipsAndNameAtScreen(g, e.pips, e.name, s.x, s.y);
    $sprites.appendChild(g);
  }
}

function resetCounters(){
  state.atk=1; state.move=1; state.simple=1;
  state.draft=[]; state.hero.defense=false;
  updateCounters();
  updateDefenseBadge();
  setDraftHint("Опишите ход... (черновик заполняется автоматически)");
  state.snapshot = JSON.parse(JSON.stringify(state));
  updateHighlights();
}
function setDraftHint(text){ const t=qs($wrap,"#input_text"); if(t) t.textContent=text; }
function pushDraft(txt){ state.draft.push(txt); setDraftHint(state.draft.join(". ")+"."); }
function updateCounters(){
  qs($wrap,"#counter_atk text")?.textContent    = `АТК ${state.atk}/1`;
  qs($wrap,"#counter_move text")?.textContent   = `ДВИЖ ${state.move}/1`;
  qs($wrap,"#counter_simple text")?.textContent = `ПРОСТ ${state.simple}/1`;
}
function updateDefenseBadge(){ const b=qs($wrap,"#badge_defense"); if(b) b.style.display = state.hero.defense? "block":"none"; }

function setupButtons(){
  // Movement by clicking highlights
  $cells.forEach(r=>{
    r.style.cursor="pointer";
    r.addEventListener("click", ()=>{
      const sx = +r.getAttribute("data-x");
      const sy = +r.getAttribute("data-y");
      moveByScreenTarget(sx,sy);
    });
  });

  // Quick move buttons (optional)
  qs($wrap,"#btn_move_left")?.addEventListener("click", ()=> moveByScreenTarget(-1,0));
  qs($wrap,"#btn_move_right")?.addEventListener("click", ()=> moveByScreenTarget(1,0));
  qs($wrap,"#btn_move_back")?.addEventListener("click", ()=> moveByScreenTarget(0,-1));
  qs($wrap,"#btn_move_forward")?.addEventListener("click", ()=> moveByScreenTarget(0,2));
  qs($wrap,"#btn_move_forward1")?.addEventListener("click", ()=> moveByScreenTarget(0,1)); // NEW

  // Rotation — change orientation (field of view)
  qs($wrap,"#btn_turn_left")?.addEventListener("click", ()=>{ state.camera.orientation = (state.camera.orientation+270)%360; mountSprites(); updateHighlights(); });
  qs($wrap,"#btn_turn_right")?.addEventListener("click", ()=>{ state.camera.orientation = (state.camera.orientation+90)%360;  mountSprites(); updateHighlights(); });

  // Combat actions
  qs($wrap,"#btn_ATTAK")?.addEventListener("click", ()=>{
    if(state.atk<=0) return; state.atk-=1; pushDraft("Атаковал ближайшую цель"); updateCounters();
  });
  qs($wrap,"#btn_defense")?.addEventListener("click", ()=>{
    if(state.atk<=0) return; state.atk-=1; state.hero.defense=true; pushDraft("Встал в оборону"); updateDefenseBadge(); updateCounters();
  });
  qs($wrap,"#btn_throw")?.addEventListener("click", ()=>{
    if(state.simple<=0) return; state.simple-=1; pushDraft("Метнул метательное в ближайшего врага"); updateCounters();
  });
  qs($wrap,"#btn_potion")?.addEventListener("click", ()=>{
    if(state.simple<=0) return; state.simple-=1; pushDraft("Выпил зелье"); updateCounters();
  });
  qs($wrap,"#btn_bandage")?.addEventListener("click", ()=>{
    if(state.simple<=0) return; state.simple-=1; pushDraft("Сделал перевязку"); updateCounters();
  });

  qs($wrap,"#btn_end_turn")?.addEventListener("click", ()=>{
    state.turnsTotal += 1;
    dispatch("combat:end", {
      turn_summary: state.draft.join(". "),
      turn_costs: { atk: 1-state.atk, move: 1-state.move, simple: 1-state.simple },
      battle_turns_total: state.turnsTotal,
      combat_flags: { defense: state.hero.defense }
    });
    resetCounters();
  });

  qs($wrap,"#btn_rollback")?.addEventListener("click", ()=>{
    if(!state.snapshot) return;
    Object.assign(state, JSON.parse(JSON.stringify(state.snapshot)));
    mountSprites(); updateCounters(); updateDefenseBadge(); setDraftHint(state.draft.join(". ")); updateHighlights();
  });
}

function finishBattle(extra={}){
  const suggested_fatigue_gain = Math.min(3, Math.floor(state.turnsTotal/5));
  dispatch("combat:finish", { battle_turns_total: state.turnsTotal, suggested_fatigue_gain, ...extra });
  close(false);
}
