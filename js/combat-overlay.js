(function () {
  const BOOT_NS = "DWCombatOverlay";
  if (window[BOOT_NS]) return;

  const state = {
    svg: null,
    cells: [], // [{el, x, y, bbox}]
    grid: { minX:0, maxX:0, minY:0, maxY:0, width:0, height:0 },
    facing: 0, // 0=up,1=right,2=down,3=left
    heroWindow: { x: 0, y: 0 }, // cell coords in window (center)
    heroWorld: { x: 5, y: 5 },  // world coords (10x10 default)
    worldSize: { w: 10, h: 10 },
    enemies: [], // [{id,pos:{x,y},alive:true}]
  };

  function log(...args){ console.log("[CombatOverlay]", ...args); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // --- Projection world -> window (relative to hero + facing) ---
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

  // --- SVG helpers ---
  function collectCells(){
    state.cells = [];
    const list = state.svg.querySelectorAll("#cells [data-x][data-y]");
    list.forEach(el => {
      const x = parseInt(el.getAttribute("data-x"),10);
      const y = parseInt(el.getAttribute("data-y"),10);
      if (isNaN(x) || isNaN(y)) return;
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
    // place hero roughly at center
    state.heroWindow.x = Math.round((state.grid.minX + state.grid.maxX)/2);
    state.heroWindow.y = Math.round((state.grid.minY + state.grid.maxY)/2);
    return true;
  }
  function getCell(x,y){
    return state.cells.find(c => c.x===x && c.y===y);
  }

  // --- Rendering helper layers ---
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
  function drawRect(g, bbox, opts){
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", bbox.x); r.setAttribute("y", bbox.y);
    r.setAttribute("width", bbox.width); r.setAttribute("height", bbox.height);
    if (opts.rx) r.setAttribute("rx", opts.rx);
    if (opts.fill) r.setAttribute("fill", opts.fill);
    if (opts.stroke) r.setAttribute("stroke", opts.stroke);
    if (opts.strokeWidth) r.setAttribute("stroke-width", opts.strokeWidth);
    g.appendChild(r);
  }
  function drawCircle(g, cx, cy, r, opts){
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    if (opts.fill) c.setAttribute("fill", opts.fill);
    if (opts.stroke) c.setAttribute("stroke", opts.stroke);
    if (opts.strokeWidth) c.setAttribute("stroke-width", opts.strokeWidth);
    g.appendChild(c);
  }

  // --- Highlights (moves) ---
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
        drawRect(g, cell.bbox, { fill:"rgba(255,255,255,0.12)", stroke:"rgba(255,255,255,0.85)", strokeWidth:2, rx:6 });
      }
    });
  }

  // --- Enemy markers (including off-screen edge dots) ---
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
        drawCircle(g, cx, cy, Math.min(bb.width, bb.height)*0.18, { fill:"rgba(220,40,40,0.95)" });
      }
    });
  }

  function repaint(){
    if (!state.svg) return;
    renderMoveHighlights();
    renderEnemies();
  }

  // --- Buttons ---
  function mapBtnToKind(id){
    const low = id.toLowerCase();
    if (low.includes("turn_right")) return "__turn_right";
    if (low.includes("turn_left")) return "__turn_left";
    if (low.includes("attack")) return "attack";
    if (low.includes("defence") || low.includes("defense")) return "defense";
    if (low.includes("ranger") && low.includes("precise")) return "ranger_precise";
    if (low.includes("throw") || low.includes("metnut") || low.includes("metanie")) return "throw";
    if (low.includes("potion")) return "potion";
    if (low.includes("bandage")) return "bandage";
    if (low.includes("rollback")) return "rollback";
    if (low.includes("end")) return "end_turn";
    return null;
  }
  function bindButtons(){
    state.svg.addEventListener("click", (e) => {
      const t = e.target.closest("[id^='btn_']");
      if (!t) return;
      const kind = mapBtnToKind(t.id);
      if (!kind) return;
      if (kind === "__turn_left") { state.facing = ((state.facing + 3) % 4); repaint(); return; }
      if (kind === "__turn_right"){ state.facing = ((state.facing + 1) % 4); repaint(); return; }
      window.dispatchEvent(new CustomEvent("dw:combat:action", { detail: { kind } }));
    });
  }

  // --- Sync with logic state (hero/enemies from dw:combat:state) ---
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

  // --- Init ---
  async function init(){
    let svg = document.querySelector("#dw-combat-svg");
    if (!svg) {
      try {
        const resp = await fetch("combat-overlay.svg", { cache:"no-store" });
        if (resp.ok){
          const text = await resp.text();
          const wrap = document.createElement("div"); wrap.innerHTML = text.trim();
          svg = wrap.querySelector("svg");
          if (svg) { svg.id = "dw-combat-svg"; document.body.appendChild(svg); }
        }
      } catch(e){ /* ignore */ }
    }
    if (!svg) { console.error("dw-combat-svg not found"); return; }
    state.svg = svg;

    if (window.DWSVGMigrate && typeof window.DWSVGMigrate.run === "function") {
      window.DWSVGMigrate.run(state.svg);
    }

    const ok = collectCells();
    if (!ok) { console.warn("No #cells [data-x][data-y] found for highlights."); }

    bindButtons();
    window.addEventListener("dw:combat:state", onState);

    repaint();

    window[BOOT_NS] = {
      setFacing: (f)=>{ state.facing=((f|0)%4+4)%4; repaint(); },
      getFacing: ()=> state.facing,
      setHeroWorld: (x,y)=>{ state.heroWorld.x=x|0; state.heroWorld.y=y|0; repaint(); },
      setEnemies: (arr)=>{ state.enemies = Array.isArray(arr)? arr.map(e=>({id:e.id,pos:{x:e.pos.x|0,y:e.pos.y|0},alive:e.alive!==false})) : []; repaint(); },
      getGrid: ()=> ({...state.grid}),
      getHeroWindow: ()=> ({...state.heroWindow}),
    };

    log("Overlay projection ready");
  }

  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else document.addEventListener("DOMContentLoaded", init);
})();