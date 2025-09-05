
(function () {
  const BOOT_NS = "DWCombatOverlay";
  if (window[BOOT_NS]) return;

  const state = {
    root: null,
    svg: null,
    cells: [],
    grid: { minX:0, maxX:0, minY:0, maxY:0, width:0, height:0 },
    facing: 0,
    heroWindow: { x: 0, y: 0 },
    heroWorld: { x: 5, y: 5 },
    worldSize: { w: 10, h: 10 },
    enemies: [],
    covers: [],
    anchor: null,
    pan: { g:null, clipId:null, cellW:0, cellH:0, offX:0, offY:0, animId:0 },
  };

  function log(...args){ console.log("[CombatOverlay]", ...args); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function num(v, fallback){ const n = parseFloat(v); return isFinite(n)? n : fallback; }

  // ---- CSS ----
  function injectCSS(){
    const css = `
      #dw-combat-root { position: fixed !important; z-index: 2147483647 !important; }
      #dw-combat-root > svg#dw-combat-svg { width:100%; height:100%; display:block; }

      /* Buttons */
      #dw-combat-root [id^="btn_"] { cursor: pointer; transition: transform .06s ease, filter .06s ease; }
      #dw-combat-root [id^="btn_"].pressed { transform: translateY(1px) scale(0.98); filter: brightness(0.92); }

      /* Highlights: filled tiles, без обводки (чуть светлее поля) */
      .dw-hl-move { fill: rgba(255,255,255,0.26); pointer-events: auto; }

      /* Cover (укрытия) */
      .dw-cover { fill: rgba(140,140,160,0.22); }

      /* Tokens */
      .dw-enemy { fill: rgba(220,40,40,0.95); }
      .dw-hero  { fill: rgba(120,140,255,0.95); }
    `;
    const style = document.createElement("style");
    style.id = "dw-combat-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---- Projection world <-> window ----
  function projectDelta(dx, dy, facing){
    const f = ((facing%4)+4)%4;
    switch(f){
      case 0: return { dx: dx,   dy: dy   };
      case 1: return { dx: dy,   dy: -dx  };
      case 2: return { dx: -dx,  dy: -dy  };
      case 3: return { dx: -dy,  dy: dx   };
      default: return { dx, dy };
    }
  }
  function unprojectDelta(dx, dy, facing){
    const f = ((facing%4)+4)%4;
    switch(f){
      case 0: return { dx: dx,   dy: dy   };
      case 1: return { dx: -dy,  dy: dx   };
      case 2: return { dx: -dx,  dy: -dy  };
      case 3: return { dx: dy,   dy: -dx  };
      default: return { dx, dy };
    }
  }
  function worldToWindow(wx, wy){
    const dx = wx - state.heroWorld.x;
    const dy = wy - state.heroWorld.y;
    const p = projectDelta(dx, dy, state.facing);
    return { x: state.heroWindow.x + p.dx, y: state.heroWindow.y + p.dy };
  }

  // ---- Cells ----
  function collectCells(){
    state.cells = [];
    const list = state.svg.querySelectorAll("#board #cam #cells rect[id^='cell_']");
    list.forEach(el => {
      const m = el.id.match(/^cell_(-?\d+)_(-?\d+)$/);
      if (!m) return;
      const x = parseInt(m[1],10);
      const y = parseInt(m[2],10);
      const bbox = el.getBBox ? el.getBBox() : null;
      const rx = num(el.getAttribute("x"), bbox?bbox.x:0);
      const ry = num(el.getAttribute("y"), bbox?bbox.y:0);
      const rw = num(el.getAttribute("width"), bbox?bbox.width:48);
      const rh = num(el.getAttribute("height"), bbox?bbox.height:48);
      state.cells.push({ el, x, y, bbox, rx, ry, rw, rh });
    });
    if (!state.cells.length) return false;
    state.grid.minX = Math.min(...state.cells.map(c => c.x));
    state.grid.maxX = Math.max(...state.cells.map(c => c.x));
    state.grid.minY = Math.min(...state.cells.map(c => c.y));
    state.grid.maxY = Math.max(...state.cells.map(c => c.y));
    state.grid.width = state.grid.maxX - state.grid.minX + 1;
    state.grid.height = state.grid.maxY - state.grid.minY + 1;
    state.heroWindow.x = 0;
    state.heroWindow.y = 0;
    const heroCell = state.cells.find(c => c.x===0 && c.y===0) || state.cells[0];
    state.pan.cellW = heroCell ? heroCell.rw : 48;
    state.pan.cellH = heroCell ? heroCell.rh : 48;
    return true;
  }
  function getCell(x,y){ return state.cells.find(c => c.x===x && c.y===y); }

  // ---- Pan layer with clip to board ----
  function ensurePanLayer(){
    if (!state.pan.g){
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("id", "dw-pan");
      // clip to board bbox
      const board = state.svg.querySelector("#board");
      if (board && board.getBBox){
        const bb = board.getBBox();
        const defs = state.svg.querySelector("defs") || (function(){ const d=document.createElementNS("http://www.w3.org/2000/svg","defs"); state.svg.insertBefore(d, state.svg.firstChild); return d; })();
        const clip = document.createElementNS("http://www.w3.org/2000/svg","clipPath");
        const clipId = "dw-board-clip";
        clip.setAttribute("id", clipId);
        const r = document.createElementNS("http://www.w3.org/2000/svg","rect");
        r.setAttribute("x", bb.x); r.setAttribute("y", bb.y); r.setAttribute("width", bb.width); r.setAttribute("height", bb.height);
        clip.appendChild(r); defs.appendChild(clip);
        g.setAttribute("clip-path", "url(#"+clipId+")");
        state.pan.clipId = clipId;
      }
      const afterBoard = state.svg.querySelector("#board");
      if (afterBoard && afterBoard.parentNode){
        afterBoard.parentNode.insertBefore(g, afterBoard.nextSibling);
      } else {
        state.svg.appendChild(g);
      }
      state.pan.g = g;
    }
    // IMPORTANT: do NOT clear children here; each layer will clear itself.
    const px = state.pan.offX * state.pan.cellW;
    const py = state.pan.offY * state.pan.cellH;
    state.pan.g.setAttribute("transform", `translate(${px} ${py})`);
    return state.pan.g;
  }
  function ensureLayer(id){
    const pan = ensurePanLayer();
    let g = state.svg.querySelector("#"+id);
    if (!g){
      g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("id", id);
      pan.appendChild(g);
    } else if (g.parentNode !== pan) {
      g.parentNode.removeChild(g);
      pan.appendChild(g);
    }
    while (g.firstChild) g.removeChild(g.firstChild);
    return g;
  }
  function rectFromCell(cell, cls, data){
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", cell.rx); r.setAttribute("y", cell.ry);
    r.setAttribute("width", cell.rw); r.setAttribute("height", cell.rh);
    r.setAttribute("rx", 6);
    if (cls) r.setAttribute("class", cls);
    if (data) Object.assign(r.dataset, data);
    return r;
  }
  function circleAtCellCenter(cell, radiusK, cls){
    const cx = cell.rx + cell.rw/2;
    const cy = cell.ry + cell.rh/2;
    const r = Math.min(cell.rw, cell.rh) * radiusK;
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    if (cls) c.setAttribute("class", cls);
    return c;
  }

  // ---- Highlights ----
  function renderMoveHighlights(){
    const g = ensureLayer("dw-highlights-move");
    const offs = [
      // axial ±1
      {dx:0,dy:+1},{dx:0,dy:-1},{dx:+1,dy:0},{dx:-1,dy:0},
      // axial ±2
      {dx:0,dy:+2},{dx:0,dy:-2},{dx:+2,dy:0},{dx:-2,dy:0},
      // diagonals ±1
      {dx:+1,dy:+1},{dx:+1,dy:-1},{dx:-1,dy:+1},{dx:-1,dy:-1},
    ];
    offs.forEach(v => {
      const cx = state.heroWindow.x + v.dx;
      const cy = state.heroWindow.y + v.dy;
      const cell = getCell(cx, cy);
      if (cell){
        g.appendChild(rectFromCell(cell, "dw-hl-move", { cellx:String(cx), celly:String(cy) }));
      }
    });
  }

  // ---- Cover (debug) ----
  function renderCovers(){
    const g = ensureLayer("dw-tiles-cover");
    state.covers.forEach(pos => {
      const w = worldToWindow(pos.x, pos.y);
      const cell = getCell(w.x, w.y);
      if (cell) g.appendChild(rectFromCell(cell, "dw-cover"));
    });
  }

  // ---- Enemies ----
  function renderEnemies(){
    const g = ensureLayer("dw-markers-enemies");
    state.enemies.forEach(e => {
      if (e.alive === false) return;
      const w = worldToWindow(e.pos.x, e.pos.y);
      const inside = (w.x>=state.grid.minX && w.x<=state.grid.maxX && w.y>=state.grid.minY && w.y<=state.grid.maxY);
      let targetCell = null;
      if (inside) targetCell = getCell(w.x, w.y);
      else targetCell = getCell(clamp(w.x, state.grid.minX, state.grid.maxX), clamp(w.y, state.grid.minY, state.grid.maxY));
      if (targetCell) g.appendChild(circleAtCellCenter(targetCell, 0.18, "dw-enemy"));
    });
  }

  // ---- Hero token (always at window 0,0) ----
  function renderHero(){
    const g = ensureLayer("dw-hero");
    const cell = getCell(state.heroWindow.x, state.heroWindow.y);
    if (cell) g.appendChild(circleAtCellCenter(cell, 0.22, "dw-hero"));
  }

  function repaint(){
    if (!state.svg) return;
    renderCovers();
    renderMoveHighlights();
    renderEnemies();
    renderHero();
  }

  // ---- Movement ----
  function isAllowedMove(dxWin, dyWin){
    const ax = Math.abs(dxWin), ay = Math.abs(dyWin);
    if ((ax===0 && (ay===1 || ay===2)) || (ay===0 && (ax===1 || ax===2))) return true;
    if (ax===1 && ay===1) return true;
    return false;
  }
  function animatePan(dxWin, dyWin){
    state.pan.offX = dxWin;
    state.pan.offY = dyWin;
    const start = performance.now();
    const dur = 160;
    cancelAnimationFrame(state.pan.animId);
    const step = (t)=>{
      const k = Math.min(1, (t-start)/dur);
      const ease = k<0.5 ? 2*k*k : -1+(4-2*k)*k;
      state.pan.offX = (1-ease)*dxWin;
      state.pan.offY = (1-ease)*dyWin;
      ensurePanLayer();
      if (k<1) state.pan.animId = requestAnimationFrame(step);
      else { state.pan.offX=0; state.pan.offY=0; ensurePanLayer(); repaint(); }
    };
    state.pan.animId = requestAnimationFrame(step);
  }
  function performMoveToWindowCell(wx, wy){
    const dxWin = wx - state.heroWindow.x;
    const dyWin = wy - state.heroWindow.y;
    if (!isAllowedMove(dxWin, dyWin)) return false;
    const d = unprojectDelta(dxWin, dyWin, state.facing);
    const newX = clamp(state.heroWorld.x + d.dx, 0, state.worldSize.w-1);
    const newY = clamp(state.heroWorld.y + d.dy, 0, state.worldSize.h-1);
    if (window.DWCombatLogic && typeof window.DWCombatLogic.setHeroPos === "function"){
      window.DWCombatLogic.setHeroPos(newX, newY);
    } else {
      state.heroWorld.x = newX; state.heroWorld.y = newY;
    }
    animatePan(dxWin, dyWin);
    return true;
  }

  // ---- Click handling ----
  function onClick(e){
    const btn = e.target.closest("[id^='btn_']");
    if (btn){
      btn.classList.add("pressed"); setTimeout(()=> btn.classList.remove("pressed"), 110);
      const id = btn.id.toLowerCase();
      if (id.includes("turn_left")) { state.facing = (state.facing + 3) % 4; repaint(); return; }
      if (id.includes("turn_right")){ state.facing = (state.facing + 1) % 4; repaint(); return; }
      let kind = null;
      if (id.includes("attack")) kind="attack";
      else if (id.includes("defence")||id.includes("defense")) kind="defense";
      else if (id.includes("ranger") && id.includes("precise")) kind="ranger_precise";
      else if (id.includes("throw")) kind="throw";
      else if (id.includes("potion")) kind="potion";
      else if (id.includes("bandage")) kind="bandage";
      else if (id.includes("rollback")) kind="rollback";
      else if (id.includes("end_turn") || id.endsWith("_end")) kind="end_turn";
      if (kind) window.dispatchEvent(new CustomEvent("dw:combat:action", { detail: { kind } }));
      return;
    }
    const hl = e.target.closest(".dw-hl-move");
    if (hl && hl.dataset){
      const wx = parseInt(hl.dataset.cellx,10);
      const wy = parseInt(hl.dataset.celly,10);
      if (performMoveToWindowCell(wx, wy)) return;
    }
    const rect = e.target.closest("#board #cam #cells rect[id^='cell_']");
    if (rect){
      const m = /^cell_(-?\d+)_(-?\d+)$/.exec(rect.id);
      if (m) performMoveToWindowCell(parseInt(m[1],10), parseInt(m[2],10));
    }
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

  // ---- Anchor to center ----
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
    injectCSS();
    state.anchor = findCenterNode();
    const root = document.createElement("div");
    root.id = "dw-combat-root";
    document.body.appendChild(root);
    state.root = root;
    positionToAnchor();
    window.addEventListener("resize", positionToAnchor, { passive:true });
    window.addEventListener("scroll", positionToAnchor, { passive:true });

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

    if (window.DWSVGMigrate && typeof window.DWSVGMigrate.run === "function") {
      window.DWSVGMigrate.run(state.svg);
    }

    const ok = collectCells();
    if (!ok) { console.warn("No cells collected — expect rect ids like cell_-1_2 inside #board #cam #cells."); }

    // DEBUG SEED: enemies + covers if logic/overlay don't provide
    if (window.DWCombatLogic && typeof window.DWCombatLogic.getState === "function"){
      const st = window.DWCombatLogic.getState();
      state.enemies = st.enemies || [];
    }
    if (!state.enemies || state.enemies.length === 0){
      state.enemies = [
        { id:"nearTop", pos:{ x: state.heroWorld.x, y: state.heroWorld.y-2 }, alive:true },
        { id:"far",     pos:{ x: Math.min(state.worldSize.w-1, state.heroWorld.x+3), y: Math.min(state.worldSize.h-1, state.heroWorld.y+3) }, alive:true },
      ];
      if (window.DWCombatLogic && typeof window.DWCombatLogic.setEnemies === "function"){
        window.DWCombatLogic.setEnemies(state.enemies);
      }
    }
    // seed 3 cover tiles around hero
    state.covers = [
      { x: state.heroWorld.x-1, y: state.heroWorld.y-1 },
      { x: state.heroWorld.x+1, y: state.heroWorld.y   },
      { x: state.heroWorld.x,   y: state.heroWorld.y+2 },
    ].filter(p => p.x>=0 && p.y>=0 && p.x<state.worldSize.w && p.y<state.worldSize.h);

    state.svg.addEventListener("click", onClick);
    window.addEventListener("dw:combat:state", onState);

    repaint();

    window[BOOT_NS] = {
      setFacing: (f)=>{ state.facing=((f|0)%4+4)%4; repaint(); },
      getFacing: ()=> state.facing,
      setHeroWorld: (x,y)=>{ state.heroWorld.x=x|0; state.heroWorld.y=y|0; repaint(); },
      setEnemies: (arr)=>{ state.enemies = Array.isArray(arr)? arr.map(e=>({id:e.id,pos:{x:e.pos.x|0,y:e.pos.y|0},alive:e.alive!==false})) : []; repaint(); },
      setCovers: (arr)=>{ state.covers = Array.isArray(arr)? arr.map(p=>({x:p.x|0, y:p.y|0})) : []; repaint(); },
      getGrid: ()=> ({...state.grid}),
    };

    log("Overlay v3.8 ready");
  }

  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
