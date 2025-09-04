/**
 * Dark World — Combat Overlay (SVG) bootstrap
 * - Auto-loads and injects combat-overlay.svg inline
 * - Computes camera center from #board BBox (no magic numbers)
 * - Highlights allowed moves per v3 + your scheme: 1↑, 2↑, 1←, 1→, 4 diagonals (±1,±1)
 * - Dispatches semantic events for actions: dw:combat:action {detail:{kind,...}}
 * - Robust to slightly different SVGs (paired with svg-migrate.js)
 */
(function () {
  const BOOT_NS = "DWCombatOverlay";
  if (window[BOOT_NS]) return; // singleton

  const state = {
    root: null,
    svg: null,
    cam: null,
    board: null,
    center: { x: 0, y: 0 },
    facing: 0, // 0: up, 1: right, 2: down, 3: left
    hero: { x: 0, y: 0 }, // logical grid pos (requires data-x/y on cells)
  };

  function log(...args) { console.log("[CombatOverlay]", ...args); }

  function dispatch(name, detail) {
    const ev = new CustomEvent(name, { detail });
    window.dispatchEvent(ev);
  }

  async function loadSVGInline(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error("Failed to load SVG: " + resp.status);
    const text = await resp.text();
    // create DOM from text
    const div = document.createElement("div");
    div.innerHTML = text.trim();
    const svg = div.querySelector("svg");
    if (!svg) throw new Error("SVG tag not found in file");
    svg.setAttribute("id", "dw-combat-svg");
    return svg;
  }

  function computeBoardCenter() {
    // Prefer #board; fallback to viewBox center; else bbox of svg
    const board = state.svg.querySelector("#board") || state.svg;
    const vb = (board.getAttribute("viewBox") || state.svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
    if (vb.length === 4 && vb.every(n => !isNaN(n))) {
      const [x, y, w, h] = vb;
      return { x: x + w / 2, y: y + h / 2 };
    }
    const bbox = (board.getBBox && board.getBBox()) ? board.getBBox() : { x: 0, y: 0, width: 100, height: 100 };
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  // Rotate a vector (dx,dy) by current facing (multiples of 90°)
  function rotateVec(dx, dy, facing) {
    const f = ((facing % 4) + 4) % 4;
    switch (f) {
      case 0: return { dx, dy };        // up
      case 1: return { dx: dy, dy: -dx };   // right
      case 2: return { dx: -dx, dy: -dy };  // down
      case 3: return { dx: -dy, dy: dx };   // left
      default: return { dx, dy };
    }
  }

  function getCell(x, y) {
    // Expect cells have data-x / data-y; else try rects in order (fallback is best-effort)
    const sel = state.svg.querySelector(`#cells [data-x="${x}"][data-y="${y}"]`);
    if (sel) return sel;
    // fallback: try to find nth child (not ideal but graceful)
    return null;
  }

  function clearHighlights() {
    state.svg.querySelectorAll(".hl-move").forEach(el => el.classList.remove("hl-move"));
    state.svg.querySelectorAll(".hl-target").forEach(el => el.classList.remove("hl-target"));
  }

  function highlightMoves() {
    clearHighlights();
    // Allowed base offsets (before rotation): up(0,+1), up2(0,+2), left(-1,0), right(+1,0), diagonals(±1,±1)
    const offs = [
      { dx: 0, dy: +1 },
      { dx: 0, dy: +2 },
      { dx: -1, dy: 0 },
      { dx: +1, dy: 0 },
      { dx: +1, dy: +1 },
      { dx: -1, dy: +1 },
      { dx: +1, dy: -1 },
      { dx: -1, dy: -1 },
    ];
    offs.forEach(o => {
      const r = rotateVec(o.dx, o.dy, state.facing);
      const cx = state.hero.x + r.dx;
      const cy = state.hero.y + r.dy;
      const cell = getCell(cx, cy);
      if (cell) cell.classList.add("hl-move");
    });
  }

  function rotateCamera(dir) {
    // dir: +1 right, -1 left
    state.facing = ((state.facing + (dir > 0 ? 1 : -1)) % 4 + 4) % 4;
    const angle = state.facing * 90;
    if (state.cam) {
      const c = state.center;
      const tr = `rotate(${angle} ${c.x} ${c.y})`;
      state.cam.setAttribute("transform", tr);
    }
    highlightMoves();
  }

  function ensurePointerCSS() {
    const css = `
      #dw-combat-svg [id^="btn_"] { cursor: pointer; pointer-events: all; }
      #dw-combat-svg .hl-move { outline: 2px solid rgba(255,255,255,0.8); outline-offset: -2px; }
      #dw-combat-svg .hl-target { outline: 2px solid rgba(255,0,0,0.8); outline-offset: -2px; }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function mapBtnToKind(id) {
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

  function bindButtons() {
    // Delegate clicks from inside SVG
    state.svg.addEventListener("click", (e) => {
      const target = e.target.closest("[id^='btn_']");
      if (!target) return;
      const kind = mapBtnToKind(target.id);
      if (!kind) return;
      if (kind === "__turn_left") { rotateCamera(-1); return; }
      if (kind === "__turn_right") { rotateCamera(+1); return; }
      dispatch("dw:combat:action", { kind });
    });
  }

  async function init() {
    try {
      // container
      const root = document.createElement("div");
      root.id = "dw-combat-root";
      root.style.position = "relative";
      root.style.zIndex = "10";
      document.body.appendChild(root);
      state.root = root;

      // load + attach svg
      state.svg = await loadSVGInline("combat-overlay.svg");
      root.appendChild(state.svg);

      // migrate on the fly (rename ids, remove duplicates, etc.)
      if (window.DWSVGMigrate && typeof window.DWSVGMigrate.run === "function") {
        window.DWSVGMigrate.run(state.svg);
      }

      // pick cam and board
      state.cam = state.svg.querySelector("#cam") || state.svg;
      state.board = state.svg.querySelector("#board") || state.svg;
      state.center = computeBoardCenter();

      ensurePointerCSS();
      bindButtons();
      highlightMoves();

      // Expose small API
      window[BOOT_NS] = {
        rotateLeft: () => rotateCamera(-1),
        rotateRight: () => rotateCamera(+1),
        highlightMoves,
        getFacing: () => state.facing,
        setHeroPos: (x, y) => { state.hero.x = x|0; state.hero.y = y|0; highlightMoves(); },
        setFacing: (f) => { state.facing = (f|0)%4; rotateCamera(0); },
      };

      log("Overlay ready");
      dispatch("dw:combat:overlayReady", {});
    } catch (err) {
      console.error("Combat overlay init failed:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();