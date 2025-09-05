(function () {
  const BOOT_NS = "DWCombatOverlay";
  if (window[BOOT_NS]) return;

  const state = {
    root: null,       // fixed overlay element
    svg: null,
    cells: [],        // [{el, x, y, bbox}]
    grid: { minX:0, maxX:0, minY:0, maxY:0, width:0, height:0 },
    facing: 0,        // 0=up,1=right,2=down,3=left
    heroWindow: { x: 0, y: 0 },
    heroWorld: { x: 5, y: 5 },
    worldSize: { w: 10, h: 10 },
    enemies: [],
    anchor: null,     // #center node
  };

  function log(...args){ console.log("[CombatOverlay]", ...args); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // ---- CSS injection ----
  function injectCSS(){
    const css = `
      /* Fixed overlay aligned to center column rectangle */
      #dw-combat-root {
        position: fixed !important;
        pointer-events: none; /* enable selectively in svg */
        z-index: 2147483647 !important;
      }
      #dw-combat-root > svg#dw-combat-svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      /* Make buttons clickable and add a quick "press" feedback */
      #dw-combat-root [id^="btn_"] { cursor: pointer; transition: transform .06s ease, filter .06s ease; pointer-events: auto; }
      #dw-combat-root [id^="btn_"].pressed { transform: translateY(1px) scale(0.98); filter: brightness(0.92); }
      /* Ensure normal svg content still receives events if needed */
      #dw-combat-root svg * { pointer-events: auto; }

      /* Highlights & enemy markers */
      #dw-combat-root .dw-hl-move { fill: rgba(255,255,255,0.12); stroke: rgba(255,255,255,0.9); stroke-width: 2; rx: 6; }
      #dw-combat-root .dw-enemy { fill: rgba(220,40,40,0.95); }
    `;
    const style = document.createElement("style");
    style.id = "dw-combat-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- Projection world -> window ----
  function projectDelta(dx, dy, facing){
    const f = ((facing%4)+4)%4;
    switch(f){
      case 0: return { dx: dx,   dy: dy   };      // up (north)
      case 1: return { dx: dy,   dy: -dx  };      // right (east)
      case 2: return { dx: -dx,  dy: -dy  };      // down (south)
      case 3: return { dx: -dy,  dy: dx   };      // left (west)
      default: return { dx, dy };
    }
  }
  function worldToWindow(wx, wy){
    const dx = wx - state.heroWorld.x;
    const dy = wy - state.heroWorld.y;
    const p = projectDelta(dx, dy, state.facing);
    return { x: state.heroWindow.x + p.dx, y: state.heroWindow.y + p.dy };
  }

  // ---- Cells collection (new SVG structure) ----
  function collectCells(){
    state.cells = [];
    // Prefer cells inside board/cam/cells
    const list = state.svg.querySelectorAll("#board #cam #cells rect[id^='cell_']");
    if (!list.length) {
      // fallback: any rect with id pattern
      const fallback = state.svg.querySelectorAll("rect[id^='cell_']");
      fallback.forEach(el => list.push(el));
    }
    list.forEach(el => {
      const m = el.id.match(/^cell_(-?\d+)_(-?\d+)$/);
      if (!m) return;
      const x = parseInt(m[1],10);
      const y = parseInt(m[2],10);
      const bbox = el.getBBox ? el.getBBox() : null;
      state.cells.push({ el, x, y, bbox });
    });
    if (!state.cells.length) return false;
    state.grid.minX = Math.min(...state.cells.map(c => c.x));
    state.grid.maxX = Math.max(...state.cells.map(c => c.x));
    state.grid.minY = Math.min(...state.cells.map(c => c.y));
    state.grid.maxY = Math.max(...state.cells.map(c => c.y));
    state.grid.width = state.grid.maxX - state.grid.minX + 1;
    state.grid.height = state.grid.maxY - state.grid.minY + 1;
    // Hero sits at logical (0,0) of window — find its cell id cell_0_0 if present, otherwise center
    const heroCell = state.cells.find(c => c.x===0 && c.y===0);
    if (heroCell) {
      state.heroWindow.x = 0;
      state.heroWindow.y = 0;
    } else {
      state.heroWindow.x = Math.round((state.grid.minX + state.grid.maxX)/2);
      state.heroWindow.y = Math.round((state.grid.minY + state.grid.maxY)/2);
    }
    return true;
  }
  function getCell(x,y){ return state.cells.find(c => c.x===x && c.y===y); }

  // ---- Helper layers ----
  function ensureLayer(id){
    let g = state.svg.querySelector("#"+id);
    if (!g){
      g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("id", id);
      state.svg.appendChild(g);
    } else {
      while (g.firstChild) g.removeChild(g.firstChild);
    }
    return g;
  }
  function drawRectEl(bbox, cls){
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", bbox.x); r.setAttribute("y", bbox.y);
    r.setAttribute("width", bbox.width); r.setAttribute("height", bbox.height);
    r.setAttribute("rx", 6);
    r.setAttribute("class", cls);
    return r;
  }
  function drawCircleEl(cx, cy, r, cls){
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    c.setAttribute("class", cls);
    return c;
  }

  // ---- Rendering ----
  function renderMoveHighlights(){
    const g = ensureLayer("dw-highlights-move");
    const base = [
      { dx: 0, dy: +1 },
      { dx: 0, dy: +2 },
      { dx: -1, dy: 0 },
      { dx: +1, dy: 0 },
      { dx: +1, dy: +1 },
      { dx: -1, dy: +1 },
      { dx: +1, dy: -1 },
      { dx: -1, dy: -1 },
    ];
    base.forEach(v => {
      const p = projectDelta(v.dx, v.dy, state.facing);
      const cx = state.heroWindow.x + p.dx;
      const cy = state.heroWindow.y + p.dy;
      const cell = getCell(cx, cy);
      if (cell && cell.bbox){
        g.appendChild(drawRectEl(cell.bbox, "dw-hl-move"));
      }
    });
  }
  function renderEnemies(){
    const g = ensureLayer("dw-markers-enemies");
    state.enemies.forEach(e => {
      if (e.alive === false) return;
      const w = worldToWindow(e.pos.x, e.pos.y);
      const inside = (w.x>=state.grid.minX && w.x<=state.grid.maxX && w.y>=state.grid.minY && w.y<=state.grid.maxY);
      let targetCell = null;
      if (inside) {
        targetCell = getCell(w.x, w.y);
      } else {
        const cx = clamp(w.x, state.grid.minX, state.grid.maxX);
        const cy = clamp(w.y, state.grid.minY, state.grid.maxY);
        targetCell = getCell(cx, cy);
      }
      if (targetCell && targetCell.bbox){
        const bb = targetCell.bbox;
        const cx = bb.x + bb.width/2;
        const cy = bb.y + bb.height/2;
        g.appendChild(drawCircleEl(cx, cy, Math.min(bb.width, bb.height)*0.18, "dw-enemy"));
      }
    });
  }
  function repaint(){
    if (!state.svg) return;
    renderMoveHighlights();
    renderEnemies();
  }

  // ---- Buttons ----
  function mapBtnToKind(id){
    const low = id.toLowerCase();
    if (low.includes("turn_right")) return "__turn_right";
    if (low.includes("turn_left")) return "__turn_left";
    if (low.includes("attack")) return "attack";
    if (low.includes("defence") || low.includes("defense")) return "defense";
    if (low.includes("ranger") && low.includes("precise")) return "ranger_precise";
    if (low.includes("throw")) return "throw";
    if (low.includes("potion")) return "potion";
    if (low.includes("bandage")) return "bandage";
    if (low.includes("rollback")) return "rollback";
    if (low.includes("end_turn") || low.endsWith("_end")) return "end_turn";
    return null;
  }
  function quickPress(el){
    el.classList.add("pressed");
    setTimeout(()=> el.classList.remove("pressed"), 110);
  }
  function bindButtons(){
    state.svg.addEventListener("click", (e) => {
      const t = e.target.closest("[id^='btn_']");
      if (!t) return;
      quickPress(t);
      const kind = mapBtnToKind(t.id);
      if (!kind) return;
      if (kind === "__turn_left") { state.facing = ((state.facing + 3) % 4); repaint(); return; }
      if (kind === "__turn_right"){ state.facing = ((state.facing + 1) % 4); repaint(); return; }
      window.dispatchEvent(new CustomEvent("dw:combat:action", { detail: { kind } }));
    });
  }

  // ---- Sync from logic ----
  function onState(ev){
    const st = ev && ev.detail && ev.detail.state;
    if (!st) return;
    if (st.hero && st.hero.pos) {
      state.heroWorld.x = st.hero.pos.x|0;
      state.heroWorld.y = st.hero.pos.y|0;
    }
    if (Array.isArray(st.enemies)) {
      state.enemies = st.enemies.map(e => ({ id:e.id, pos:{ x:e.pos.x|0, y:e.pos.y|0 }, alive: e.alive!==false }));
    }
    repaint();
  }

  // ---- Position overlay to center column (fixed rect) ----
  function findCenterNode(){
    let node = document.querySelector("#center");
    if (node) return node;
    const cols = Array.from(document.querySelectorAll(".col"));
    if (cols.length === 3) return cols[1];
    return document.body;
  }
  function positionToAnchor(){
    if (!state.anchor || !state.root) return;
    const r = state.anchor.getBoundingClientRect();
    state.root.style.left = (r.left + window.scrollX) + "px";
    state.root.style.top = (r.top + window.scrollY) + "px";
    state.root.style.width = r.width + "px";
    state.root.style.height = r.height + "px";
  }

  // ---- Init ----
  async function init(){
    try{
      injectCSS();
      state.anchor = findCenterNode();

      // Create fixed root
      const root = document.createElement("div");
      root.id = "dw-combat-root";
      document.body.appendChild(root);
      state.root = root;
      positionToAnchor();
      window.addEventListener("resize", positionToAnchor, { passive:true });
      window.addEventListener("scroll", positionToAnchor, { passive:true });

      // Load or adopt svg
      let svg = document.querySelector("#dw-combat-svg");
      if (!svg) {
        try {
          const resp = await fetch("combat-overlay.svg", { cache:"no-store" });
          if (resp.ok){
            const text = await resp.text();
            const wrap = document.createElement("div"); wrap.innerHTML = text.trim();
            svg = wrap.querySelector("svg");
            if (svg) { svg.id = "dw-combat-svg"; }
          }
        } catch(e){ /* ignore */ }
      }
      if (!svg) { console.error("dw-combat-svg not found"); return; }
      root.appendChild(svg);
      state.svg = svg;

      // Migrate IDs (legacy fixes only)
      if (window.DWSVGMigrate && typeof window.DWSVGMigrate.run === "function") {
        window.DWSVGMigrate.run(state.svg);
      }

      const ok = collectCells();
      if (!ok) { console.warn("No cells collected — check rect ids like cell_-1_2 inside #board #cam #cells."); }

      bindButtons();
      window.addEventListener("dw:combat:state", onState);

      repaint();

      window[BOOT_NS] = {
        setFacing: (f)=>{ state.facing=((f|0)%4+4)%4; repaint(); },
        getFacing: ()=> state.facing,
        setHeroWorld: (x,y)=>{ state.heroWorld.x=x|0; state.heroWorld.y=y|0; repaint(); },
        setEnemies: (arr)=>{ state.enemies = Array.isArray(arr)? arr.map(e=>({id:e.id,pos:{x:e.pos.x|0,y:e.pos.y|0},alive:e.alive!==false})) : []; repaint(); },
      };

      log("Overlay fixed-aligned to center and ready");
    }catch(err){
      console.error("Combat overlay init failed:", err);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else document.addEventListener("DOMContentLoaded", init);
})();