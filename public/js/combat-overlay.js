
// public/js/combat-overlay.js
// Minimal, dependency-free overlay integration for the "Темный Мир" combat block.
// Loads inline SVG overlay, mounts hero+enemies, handles basic actions and counters.
//
// Usage: add this tag to your page footer:
//   <script type="module" src="/js/combat-overlay.js"></script>
// It will add a floating "Бой" button if no opener is found.
// Or you can call: window.CombatOverlay.open()
//
const ASSETS = {
  hero: "/assets/combat/hero.png",
  enemy: "/assets/combat/enemy.png",
  boss: "/assets/combat/boss.png",
  
};

const state = {
  // hero stays at (0,0) by default for v1
  hero: { x: 0, y: 0, defense: false },
  atk: 1, move: 1, simple: 1,
  turnsTotal: 0,
  draft: [],
  snapshot: null,
  enemies: [
    { id: "e1", kind: "enemy", name: "Гоблин-лучник", x: -1, y: 3, pips: 3 },
    { id: "b1", kind: "boss", name: "Кровавый череп", x: 1, y: 3, pips: 5 },
  ],
  options: {
    showRangerPrecise: false, // per user: Меткий выстрел — нет
  }
};

function qs(root, sel){ return (root||document).querySelector(sel); }
function qsa(root, sel){ return Array.from((root||document).querySelectorAll(sel)); }
function svgNS(tag){ return document.createElementNS("http://www.w3.org/2000/svg", tag); }

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

const OFFSETS = {
  hero: { dx: -16, dy: -57, w: 96, h: 112 },
  enemy:{ dx: -15, dy: -39, w: 96, h: 112 },
  boss: { dx: -16, dy: -51, w: 96, h: 112 },
};

function loadOverlay() {
  return fetch("/combat-overlay.svg", { cache: "no-store" })
    .then(r => r.text())
    .then(html => {
      // Wrap as a container to keep it positioned/fixed over the app
      const wrap = document.createElement("div");
      wrap.id = "combat-overlay-wrap";
      wrap.style.position = "fixed";
      wrap.style.inset = "0";
      wrap.style.zIndex = "9999";
      wrap.style.display = "none"; // initially hidden
      wrap.innerHTML = html;
      document.body.appendChild(wrap);
      // Close by pressing Escape
      window.addEventListener("keydown", (e)=>{
        if(e.key === "Escape") close();
      });
      return wrap;
    });
}

let $wrap = null;
let $svg  = null;
let $cam  = null;
let $cells = null;
let cellMap = new Map(); // key "x,y" -> {x,y,rect}

function open() {
  if(!$wrap){ /* lazy load first time */
    loadOverlay().then(w => {
      $wrap = w;
      $svg  = qs($wrap, "svg");
      $cam  = qs($wrap, "#cam");
      $cells = qsa($wrap, '#cells rect[id^="cell_"]');
      buildCellMap();
      setUpUI();
      mountSprites();
      resetCounters();
      // hide "Меткий выстрел" per spec
      const precise = qs($wrap, "#btn_ranger_precise");
      if(precise) precise.classList.add("hidden");
      // show
      $wrap.style.display = "block";
    });
  } else {
    resetCounters();
    $wrap.style.display = "block";
  }
}

function close(){
  if($wrap) $wrap.style.display = "none";
}

function buildCellMap() {
  cellMap.clear();
  $cells.forEach(r => {
    const xid = r.getAttribute("data-x");
    const yid = r.getAttribute("data-y");
    if(xid==null || yid==null) return;
    const key = `${xid},${yid}`;
    cellMap.set(key, { x: +xid, y: +yid, rect: r });
  });
}

function placeImage(kind, gridX, gridY){
  const key = `${gridX},${gridY}`;
  const cell = cellMap.get(key);
  if(!cell) return null;
  const { rect } = cell;
  const x = +rect.getAttribute("x");
  const y = +rect.getAttribute("y");
  const off = OFFSETS[kind];
  const img = svgNS("image");
  img.setAttributeNS("http://www.w3.org/1999/xlink", "href", ASSETS[kind] );
  img.setAttribute("x", x + off.dx);
  img.setAttribute("y", y + off.dy);
  img.setAttribute("width", off.w);
  img.setAttribute("height", off.h);
  img.style.pointerEvents = "none";
  return img;
}

function addPipsAndName(group, pips, name, gridX, gridY){
  const cell = cellMap.get(`${gridX},${gridY}`);
  if(!cell) return;
  const r = cell.rect;
  const cx = +r.getAttribute("x") + 32; // center of cell
  const yBase = +r.getAttribute("y") + 56; // floor line

  // pips group
  const g = svgNS("g");
  const row = Math.min(pips, 5);
  const diam = 8, gap = 3;
  const totalW = row*diam + (row-1)*gap;
  let startX = cx - totalW/2 + diam/2;
  for(let i=0;i<row;i++){
    const c = svgNS("circle");
    c.setAttribute("cx", startX + i*(diam+gap));
    c.setAttribute("cy", yBase);
    c.setAttribute("r", diam/2);
    c.setAttribute("fill", "#B74141");
    c.setAttribute("stroke", "#2A2E37");
    c.setAttribute("stroke-width", "1");
    g.appendChild(c);
  }
  group.appendChild(g);

  // name
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
  const $sprites = qs($wrap, "#sprites");
  // clear previous
  while($sprites.firstChild) $sprites.removeChild($sprites.firstChild);

  // hero
  const heroG = svgNS("g");
  heroG.setAttribute("id", "sprite_hero");
  const heroImg = placeImage("hero", state.hero.x, state.hero.y);
  if(heroImg) heroG.appendChild(heroImg);
  $sprites.appendChild(heroG);

  // enemies
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
  state.atk = 1; state.move = 1; state.simple = 1;
  state.draft = [];
  state.hero.defense = false;
  updateCounters();
  updateDefenseBadge();
  setDraftHint("Опишите ход... (черновик заполняется автоматически)");
  // snapshot for rollback
  state.snapshot = JSON.parse(JSON.stringify(state));
}

function setDraftHint(text){
  const t = qs($wrap, "#input_text");
  if(t){ t.textContent = text; }
}

function pushDraft(snippet){
  state.draft.push(snippet);
  setDraftHint(state.draft.join(". ") + ".");
}

function updateCounters(){
  const map = {
    atk: qs($wrap, "#counter_atk text"),
    move: qs($wrap, "#counter_move text"),
    simple: qs($wrap, "#counter_simple text"),
  };
  if(map.atk) map.atk.textContent = `АТК ${1-state.atk?0:state.atk}/1`;
  if(map.move) map.move.textContent = `ДВИЖ ${1-state.move?0:state.move}/1`;
  if(map.simple) map.simple.textContent = `ПРОСТ ${1-state.simple?0:state.simple}/1`;
}

function updateDefenseBadge(){
  const badge = qs($wrap, "#badge_defense");
  if(!badge) return;
  badge.style.display = state.hero.defense ? "block" : "none";
}

function setButtonDisabled(sel, disabled){
  const g = qs($wrap, sel);
  if(!g) return;
  if(disabled) g.classList.add("is-disabled");
  else g.classList.remove("is-disabled");
}

function setupButtons(){
  // Attack
  qs($wrap, "#btn_ATTAK")?.addEventListener("click", () => {
    if(state.atk <= 0) return;
    state.atk -= 1;
    pushDraft("Атаковал ближайшую цель");
    updateCounters();
  });
  // Defense (spends ATK)
  qs($wrap, "#btn_defense")?.addEventListener("click", () => {
    if(state.atk <= 0) return;
    state.atk -= 1;
    state.hero.defense = true;
    pushDraft("Встал в оборону");
    updateDefenseBadge();
    updateCounters();
  });
  // Throw / Potion / Bandage
  qs($wrap, "#btn_throw")?.addEventListener("click", () => {
    if(state.simple <= 0) return;
    state.simple -= 1;
    pushDraft("Метнул метательное в ближайшего врага");
    updateCounters();
  });
  qs($wrap, "#btn_potion")?.addEventListener("click", () => {
    if(state.simple <= 0) return;
    state.simple -= 1;
    pushDraft("Выпил зелье");
    updateCounters();
  });
  qs($wrap, "#btn_bandage")?.addEventListener("click", () => {
    if(state.simple <= 0) return;
    state.simple -= 1;
    pushDraft("Сделал перевязку");
    updateCounters();
  });

  // End turn
  qs($wrap, "#btn_end_turn")?.addEventListener("click", () => {
    state.turnsTotal += 1;
    const detail = {
      turn_summary: state.draft.join(". ") || "",
      turn_costs: { atk: 1-state.atk, move: 1-state.move, simple: 1-state.simple },
      battle_turns_total: state.turnsTotal,
      combat_flags: { defense: state.hero.defense }
    };
    window.dispatchEvent(new CustomEvent("combat:end", { detail }));
    resetCounters();
  });

  // Rollback
  qs($wrap, "#btn_rollback")?.addEventListener("click", () => {
    if(!state.snapshot) return;
    const snap = JSON.parse(JSON.stringify(state.snapshot));
    Object.assign(state, snap);
    updateCounters();
    updateDefenseBadge();
    setDraftHint(state.draft.join(". "));
  });

  // Camera rotate
  const boardRect = qs($wrap, "#board rect");
  const cx = +boardRect.getAttribute("x") + (+boardRect.getAttribute("width"))/2;
  const cy = +boardRect.getAttribute("y") + (+boardRect.getAttribute("height"))/2;
  let angle = 0;
  function applyRotation(){
    $cam.setAttribute("transform", `rotate(${angle} ${cx} ${cy})`);
  }
  qs($wrap, "#btn_turn_left")?.addEventListener("click", ()=>{ angle -= 90; applyRotation(); });
  qs($wrap, "#btn_turn_right")?.addEventListener("click", ()=>{ angle += 90; applyRotation(); });
}

function setUpUI(){
  setupButtons();
  // Clicking on adjacent cells spends MOVE and updates draft (MVP: hero sprite actually moves)
  $cells.forEach(r => {
    r.style.cursor = "pointer";
    r.addEventListener("click", () => {
      if(state.move <= 0) return;
      const x = +r.getAttribute("data-x");
      const y = +r.getAttribute("data-y");
      const dx = Math.abs(x - state.hero.x);
      const dy = Math.abs(y - state.hero.y);
      if((dx<=1 && dy<=1) && !(dx===0 && dy===0)){
        // move hero
        state.hero.x = x; state.hero.y = y;
        state.move -= 1;
        pushDraft(`Сместился к клетке (${x}, ${y})`);
        mountSprites();
        updateCounters();
      }
    });
  });
}

function addFloatingOpener(){
  // If user doesn't have a dedicated button, add a small floating FAB bottom-right
  const fab = document.createElement("button");
  Object.assign(fab.style, {
    position: "fixed", right: "16px", bottom: "16px",
    background: "#7a57c6", color: "#fff", border: "none",
    borderRadius: "999px", padding: "10px 16px", cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,.35)", zIndex: 9999
  });
  fab.textContent = "Бой";
  fab.addEventListener("click", open);
  document.body.appendChild(fab);
}

// Public API
window.CombatOverlay = { open, close };

// Auto-init: bind to a button if exists, else add floating FAB
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("open-combat") || document.getElementById("dev-open-battle");
  if(btn) btn.addEventListener("click", open);
  else addFloatingOpener();
});
