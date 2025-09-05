
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
    anchor: null,
    pan: { g:null, clipId:null, cellW:0, cellH:0, offX:0, offY:0, animId:0 },
  };

  function log(...args){ console.log("[CombatOverlay]", ...args); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function injectCSS(){
    const css = `
      #dw-combat-root { position: fixed !important; pointer-events: none; z-index: 2147483647 !important; }
      #dw-combat-root > svg#dw-combat-svg { width:100%; height:100%; display:block; }
      #dw-combat-root [id^="btn_"] { cursor: pointer; transition: transform .06s ease, filter .06s ease; pointer-events: auto; }
      #dw-combat-root [id^="btn_"].pressed { transform: translateY(1px) scale(0.98); filter: brightness(0.92); }
      #dw-combat-root svg * { pointer-events: auto; }
      .dw-hl-move { fill: rgba(255,255,255,0.12); stroke: rgba(255,255,255,0.9); stroke-width: 2; rx:6; }
      .dw-enemy { fill: rgba(220,40,40,0.95); }
      #dw-combat-root #board #cam #cells rect[id^="cell_"] { cursor: pointer; }
    `;
    const style = document.createElement("style");
    style.id = "dw-combat-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

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

  function collectCells(){
    state.cells = [];
    const list = state.svg.querySelectorAll("#board #cam #cells rect[id^='cell_']");
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
    state.heroWindow.x = 0;
    state.heroWindow.y = 0;
    const heroCell = state.cells.find(c => c.x===0 && c.y===0) || state.cells[0];
    state.pan.cellW = heroCell && heroCell.bbox ? heroCell.bbox.width : 48;
    state.pan.cellH = heroCell && heroCell.bbox ? heroCell.bbox.height : 48;
    return true;
  }
  function getCell(x,y){ return state.cells.find(c => c.x===x && c.y===y); }

  function ensurePanLayer(){
    if (!state.pan.g){
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("id", "dw-pan");
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
    } else {
      while (state.pan.g.firstChild) state.pan.g.removeChild(state.pan.g.firstChild);
    }
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

  function renderMoveHighlights(){
    const g = ensureLayer("dw-highlights-move");
    const offs = [
      {dx:0,dy:+1},{dx:0,dy:-1},{dx:+1,dy:0},{dx:-1,dy:0},
      {dx:0,dy:+2},{dx:0,dy:-2},{dx:+2,dy:0},{dx:-2,dy:0},
      {dx:+1,dy:+1},{dx:+1,dy:-1},{dx:-1,dy:+1},{dx:-1,dy:-1},
    ];
    offs.forEach(v => {
      const cx = state.heroWindow.x + v.dx;
      const cy = state.heroWindow.y + v.dy;
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

  function isAllowedMove(dxWin, dyWin){
    const ax = Math.abs(dxWin), ay = Math.abs(dyWin);
    if ((ax===0 && (ay===1 || ay===2)) || (ay===0 && (ax===1 || ax===2))) return true;
    if (ax===1 && ay===1) return true;
    return false;
  }
  function parseCellId(id){
    const m = /^cell_(-?\d+)_(-?\d+)$/.exec(id);
    return m ? { x: parseInt(m[1],10), y: parseInt(m[2],10) } : null;
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
  function onCellClick(e){
    const rect = e.target.closest("rect[id^='cell_']");
    if (!rect) return;
    const p = parseCellId(rect.id);
    if (!p) return;
    const dxWin = p.x - state.heroWindow.x;
    const dyWin = p.y - state.heroWindow.y;
    if (!isAllowedMove(dxWin, dyWin)) return;

    const d = unprojectDelta(dxWin, dyWin, state.facing);
    const newX = clamp(state.heroWorld.x + d.dx, 0, state.worldSize.w-1);
    const newY = clamp(state.heroWorld.y + d.dy, 0, state.worldSize.h-1);

    if (window.DWCombatLogic && typeof window.DWCombatLogic.setHeroPos === "function"){
      window.DWCombatLogic.setHeroPos(newX, newY);
    } else {
      state.heroWorld.x = newX; state.heroWorld.y = newY;
    }
    animatePan(dxWin, dyWin);
  }

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
  function quickPress(el){ el.classList.add("pressed"); setTimeout(()=> el.classList.remove("pressed"), 110); }
  function bindButtons(){
    state.svg.addEventListener("click", (e) => {
      const t = e.target.closest("[id^='btn_']");
      if (t){
        quickPress(t);
        const kind = mapBtnToKind(t.id);
        if (!kind) return;
        if (kind === "__turn_left") { state.facing = ((state.facing + 3) % 4); repaint(); return; }
        if (kind === "__turn_right"){ state.facing = ((state.facing + 1) % 4); repaint(); return; }
        window.dispatchEvent(new CustomEvent("dw:combat:action", { detail: { kind } }));
        return;
      }
      onCellClick(e);
    });
  }

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

    bindButtons();
    window.addEventListener("dw:combat:state", onState);

    repaint();

    window[BOOT_NS] = {
      setFacing: (f)=>{ state.facing=((f|0)%4+4)%4; repaint(); },
      getFacing: ()=> state.facing,
      setHeroWorld: (x,y)=>{ state.heroWorld.x=x|0; state.heroWorld.y=y|0; repaint(); },
      setEnemies: (arr)=>{ state.enemies = Array.isArray(arr)? arr.map(e=>({id:e.id,pos:{x:e.pos.x|0,y:e.pos.y|0},alive:e.alive!==false})) : []; repaint(); },
      getGrid: ()=> ({...state.grid}),
    };

    log("Overlay move/click ready");
  }

  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
