// js/combat-overlay.js — overlay with events + highlights (v1)
// Based on the previous adaptive version. Drop-in replacement.
//
// Emits events: 'combat:open', 'combat:end', 'combat:close', 'combat:finish'
// Highlight: adjacent cells available for movement while MOVE > 0

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

// state
const state = {
  hero: { x: 0, y: 0, defense: false },
  atk: 1, move: 1, simple: 1,
  turnsTotal: 0,
  draft: [],
  snapshot: null,
  enemies: [
    { id:"e1", kind:"enemy", name:"Гоблин-лучник", x:-1, y:3, pips:3 },
    { id:"b1", kind:"boss",  name:"Кровавый череп", x: 1, y:3, pips:5 },
  ],
  options: { rangerPrecise: false } // «Меткий выстрел» скрыт
};

// asset placement offsets (relative to top-left corner of cell rect)
const OFFSETS = {
  hero: { dx:-16, dy:-57, w:96, h:112 },
  enemy:{ dx:-15, dy:-39, w:96, h:112 },
  boss: { dx:-16, dy:-51, w:96, h:112 },
};

// DOM refs
let $wrap=null, $svg=null, $cam=null, $cells=null;
let $sprites=null, $hl=null; // highlights layer
let cellMap = new Map();
let prevDocOverflow = ""; // to restore body scroll

// Public API
window.CombatOverlay = { open, close, finish: finishBattle };

// Auto-bind opener
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("open-combat") || document.getElementById("dev-open-battle");
  if(btn) btn.addEventListener("click", open);
  else addFloatingOpener();
});

function loadOverlay(){
  return fetch("/combat-overlay.svg", { cache:"no-store" })
    .then(r=>r.text())
    .then(html=>{
      const wrap = document.createElement("div");
      wrap.id = "combat-overlay-wrap";
      Object.assign(wrap.style, {
        position: "fixed",
        inset: "0",
        zIndex: "9999",
        display: "none",
        overflow: "auto",      // internal scroll if needed
        padding: "16px",
        boxSizing: "border-box",
        background: "transparent",
        justifyContent: "center",
        alignItems: "flex-start",
      });
      wrap.innerHTML = html;
      document.body.appendChild(wrap);

      // Adaptive sizing of SVG
      const svgEl = wrap.querySelector("svg");
      if (svgEl) {
        const s = svgEl.style;
        s.display    = "block";
        s.width      = "920px"; // base width of the design
        s.maxWidth   = "96vw";
        s.height     = "auto";
        s.maxHeight  = "94vh";
        s.margin     = "2vh auto";
        s.flexShrink = "0";
      }

      window.addEventListener("keydown", e => { if (e.key === "Escape") close(true); });
      return wrap;
    });
}

function open(){
  const ensure = $wrap ? Promise.resolve($wrap) : loadOverlay();
  ensure.then(w=>{
    $wrap = w;
    $svg  = qs($wrap, "svg");
    $cam  = qs($wrap, "#cam") || $svg; // fallback
    $cells = qsa($wrap, '#cells rect[id^="cell_"]');
    $sprites = qs($wrap, "#sprites");
    if(!$svg || !$cam || !$cells.length || !$sprites){
      console.error("Combat overlay: SVG anchors not found. Check combat-overlay.svg ids.");
      $wrap.style.display = "flex";
      return;
    }
    buildCellMap();
    ensureHL();
    setUpUI();
    mountSprites();
    resetCounters();
    updateHighlights(); // initial

    // hide «Меткий выстрел»
    const precise = qs($wrap, "#btn_ranger_precise");
    if(precise) precise.classList.add("hidden");

    // show and block page scroll
    $wrap.style.display = "flex";
    $wrap.style.justifyContent = "center";
    $wrap.style.alignItems = "flex-start";
    prevDocOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    // emit open
    dispatch("combat:open", {
      hero: { x: state.hero.x, y: state.hero.y },
      enemies: state.enemies.map(e=>({ id:e.id, kind:e.kind, name:e.name, x:e.x, y:e.y, pips:e.pips })),
      options: state.options
    });
  });
}

function close(byEsc=false){
  if($wrap) $wrap.style.display = "none";
  document.documentElement.style.overflow = prevDocOverflow || "";
  dispatch("combat:close", { byEsc, battle_turns_total: state.turnsTotal });
}

// useful map
function buildCellMap(){
  cellMap.clear();
  for(const r of $cells){
    const x = +r.getAttribute("data-x");
    const y = +r.getAttribute("data-y");
    if(Number.isFinite(x) && Number.isFinite(y)){
      cellMap.set(`${x},${y}`, { x, y, rect:r });
    }
  }
}

function enemyAt(x,y){
  return state.enemies.find(e=> e.x===x && e.y===y);
}

function placeImage(kind, gx, gy){
  const cell = cellMap.get(`${gx},${gy}`);
  if(!cell) return null;
  const { rect } = cell;
  const x = +rect.getAttribute("x");
  const y = +rect.getAttribute("y");
  const off = OFFSETS[kind];
  const img = svgNS("image");
  img.setAttributeNS("http://www.w3.org/1999/xlink", "href", ASSETS[kind]);
  img.setAttribute("x", x + off.dx);
  img.setAttribute("y", y + off.dy);
  img.setAttribute("width", off.w);
  img.setAttribute("height", off.h);
  img.style.pointerEvents = "none";
  return img;
}

function addPipsAndName(group, pips, name, gx, gy){
  const cell = cellMap.get(`${gx},${gy}`);
  if(!cell) return;
  const r = cell.rect;
  const cx = +r.getAttribute("x") + 32;
  const yBase = +r.getAttribute("y") + 56;

  // pips row (max 5 for now)
  const row = Math.min(pips, 5);
  const diam=8, gap=3, totalW = row*diam + (row-1)*gap;
  const start = cx - totalW/2 + diam/2;
  const g = svgNS("g");
  for(let i=0;i<row;i++){
    const c = svgNS("circle");
    c.setAttribute("cx", start + i*(diam+gap));
    c.setAttribute("cy", yBase);
    c.setAttribute("r", diam/2);
    c.setAttribute("fill", "#B74141");
    c.setAttribute("stroke", "#2A2E37");
    c.setAttribute("stroke-width", "1");
    g.appendChild(c);
  }
  group.appendChild(g);

  const t = svgNS("text");
  t.textContent = name;
  t.setAttribute("x", cx);
  t.setAttribute("y", yBase + 14);
  t.setAttribute("fill", "#FFFFFF");
  t.setAttribute("font-size", "11");
  t.setAttribute("font-family", "Arial, sans-serif");
  t.setAttribute("text-anchor", "middle");
  t.setAttribute("paint-order", "stroke");
  t.setAttribute("stroke", "#171920");
  t.setAttribute("stroke-width", "1");
  group.appendChild(t);
}

function mountSprites(){
  while($sprites.firstChild) $sprites.removeChild($sprites.firstChild);

  const gh = svgNS("g");
  gh.setAttribute("id", "sprite_hero");
  const hi = placeImage("hero", state.hero.x, state.hero.y);
  if(hi) gh.appendChild(hi);
  $sprites.appendChild(gh);

  for(const e of state.enemies){
    const g = svgNS("g");
    g.setAttribute("id", `sprite_${e.id}`);
    const img = placeImage(e.kind, e.x, e.y);
    if(img) g.appendChild(img);
    addPipsAndName(g, e.pips, e.name, e.x, e.y);
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

function setDraftHint(text){
  const t = qs($wrap, "#input_text");
  if(t) t.textContent = text;
}

function pushDraft(txt){
  state.draft.push(txt);
  setDraftHint(state.draft.join(". ") + ".");
}

function updateCounters(){
  const ta = qs($wrap, "#counter_atk text");
  const tm = qs($wrap, "#counter_move text");
  const ts = qs($wrap, "#counter_simple text");
  if(ta) ta.textContent = `АТК ${state.atk}/1`;
  if(tm) tm.textContent = `ДВИЖ ${state.move}/1`;
  if(ts) ts.textContent = `ПРОСТ ${state.simple}/1`;
}

function updateDefenseBadge(){
  const b = qs($wrap, "#badge_defense");
  if(b) b.style.display = state.hero.defense ? "block" : "none";
}

// ------- Highlights --------
function ensureHL(){
  $hl = qs($wrap, "#highlights");
  if(!$hl){
    $hl = svgNS("g");
    $hl.setAttribute("id", "highlights");
    // вставим над клетками и под спрайтами
    $sprites.parentNode.insertBefore($hl, $sprites);
  }
}

function clearHighlights(){
  if($hl) while($hl.firstChild) $hl.removeChild($hl.firstChild);
}

function highlightCellRect(cell, {fill="#3B4B60", opacity=0.85, stroke="#7A57C6", strokeWidth=0}={}){
  const r = svgNS("rect");
  r.setAttribute("x", cell.rect.getAttribute("x"));
  r.setAttribute("y", cell.rect.getAttribute("y"));
  r.setAttribute("width", cell.rect.getAttribute("width"));
  r.setAttribute("height", cell.rect.getAttribute("height"));
  r.setAttribute("rx", cell.rect.getAttribute("rx") || 8);
  r.setAttribute("ry", cell.rect.getAttribute("ry") || 8);
  r.setAttribute("fill", fill);
  r.setAttribute("opacity", opacity);
  if(strokeWidth>0){
    r.setAttribute("stroke", stroke);
    r.setAttribute("stroke-width", strokeWidth);
  }
  r.style.pointerEvents = "none";
  $hl.appendChild(r);
}

function updateHighlights(){
  clearHighlights();
  if(state.move<=0) return;
  const dirs = [
    [-1,-1],[0,-1],[1,-1],
    [-1, 0],        [1, 0],
    [-1, 1],[0, 1],[1, 1]
  ];
  for(const [dx,dy] of dirs){
    const x = state.hero.x + dx;
    const y = state.hero.y + dy;
    const key = `${x},${y}`;
    if(!cellMap.has(key)) continue;
    if(enemyAt(x,y)) continue; // не подсказываем ход на занятую клетку
    const cell = cellMap.get(key);
    highlightCellRect(cell, { fill:"#313A49", opacity:0.95, stroke:"#7A57C6", strokeWidth:0 });
  }
}
// ---------------------------

function setupButtons(){
  const bAtk = qs($wrap, "#btn_ATTAK");
  bAtk && bAtk.addEventListener("click", ()=>{
    if(state.atk<=0) return;
    state.atk -= 1;
    pushDraft("Атаковал ближайшую цель");
    updateCounters();
  });

  const bDef = qs($wrap, "#btn_defense");
  bDef && bDef.addEventListener("click", ()=>{
    if(state.atk<=0) return;
    state.atk -= 1; state.hero.defense = true;
    pushDraft("Встал в оборону");
    updateDefenseBadge();
    updateCounters();
  });

  const bThrow = qs($wrap, "#btn_throw");
  bThrow && bThrow.addEventListener("click", ()=>{
    if(state.simple<=0) return;
    state.simple -= 1;
    pushDraft("Метнул метательное в ближайшего врага");
    updateCounters();
  });

  const bPot = qs($wrap, "#btn_potion");
  bPot && bPot.addEventListener("click", ()=>{
    if(state.simple<=0) return;
    state.simple -= 1;
    pushDraft("Выпил зелье");
    updateCounters();
  });

  const bBand = qs($wrap, "#btn_bandage");
  bBand && bBand.addEventListener("click", ()=>{
    if(state.simple<=0) return;
    state.simple -= 1;
    pushDraft("Сделал перевязку");
    updateCounters();
  });

  const bEnd = qs($wrap, "#btn_end_turn");
  bEnd && bEnd.addEventListener("click", ()=>{
    state.turnsTotal += 1;
    const detail = {
      turn_summary: state.draft.join(". "),
      turn_costs: { atk: 1-state.atk, move: 1-state.move, simple: 1-state.simple },
      battle_turns_total: state.turnsTotal,
      combat_flags: { defense: state.hero.defense }
    };
    dispatch("combat:end", detail);
    resetCounters();
  });

  const bRollback = qs($wrap, "#btn_rollback");
  bRollback && bRollback.addEventListener("click", ()=>{
    if(!state.snapshot) return;
    const snap = JSON.parse(JSON.stringify(state.snapshot));
    Object.assign(state, snap);
    updateCounters();
    updateDefenseBadge();
    setDraftHint(state.draft.join(". "));
    updateHighlights();
  });

  // Camera rotation
  const boardRect = qs($wrap, "#board rect");
  if(boardRect){
    const cx = +boardRect.getAttribute("x") + (+boardRect.getAttribute("width"))/2;
    const cy = +boardRect.getAttribute("y") + (+boardRect.getAttribute("height"))/2;
    let angle = 0;
    const apply = ()=> $cam && $cam.setAttribute("transform", `rotate(${angle} ${cx} ${cy})`);
    qs($wrap, "#btn_turn_left")?.addEventListener("click", ()=>{ angle -= 90; apply(); });
    qs($wrap, "#btn_turn_right")?.addEventListener("click", ()=>{ angle += 90; apply(); });
  }
}

function setUpUI(){
  setupButtons();
  // cell clicks -> simple move (adjacent)
  $cells.forEach(r=>{
    r.style.cursor = "pointer";
    r.addEventListener("click", ()=>{
      if(state.move<=0) return;
      const x = +r.getAttribute("data-x");
      const y = +r.getAttribute("data-y");
      const dx = Math.abs(x - state.hero.x);
      const dy = Math.abs(y - state.hero.y);
      if((dx<=1 && dy<=1) && !(dx===0 && dy===0) && !enemyAt(x,y)){
        state.hero.x = x; state.hero.y = y;
        state.move -= 1;
        pushDraft(`Сместился к клетке (${x}, ${y})`);
        mountSprites();
        updateCounters();
        updateHighlights();
      }
    });
  });
}

function addFloatingOpener(){
  const fab = document.createElement("button");
  Object.assign(fab.style, {
    position:"fixed", right:"16px", bottom:"16px",
    background:"#7a57c6", color:"#fff", border:"none",
    borderRadius:"999px", padding:"10px 16px", cursor:"pointer",
    boxShadow:"0 6px 18px rgba(0,0,0,.35)", zIndex:9999
  });
  fab.textContent = "Бой";
  fab.addEventListener("click", open);
  document.body.appendChild(fab);
}

// External end-of-battle API
function finishBattle(extra={}){
  // compute suggested fatigue: +1 per 5 turns, capped at 3
  const suggested_fatigue_gain = Math.min(3, Math.floor(state.turnsTotal/5));
  dispatch("combat:finish", {
    battle_turns_total: state.turnsTotal,
    suggested_fatigue_gain,
    ...extra
  });
  close(false);
}
