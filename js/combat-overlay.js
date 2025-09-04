(function () {
  const BOOT_NS = "DWCombatOverlay";
  if (window[BOOT_NS]) return; // singleton

  const state = {
    root: null,
    svg: null,
    cam: null,
    board: null,
    center: { x: 0, y: 0 },
    facing: 0,
    hero: { x: 0, y: 0 },
  };

  function log(...args) { console.log("[CombatOverlay]", ...args); }
  function dispatch(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

  async function loadSVGInline(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error("Failed to load SVG: " + resp.status);
    const text = await resp.text();
    const div = document.createElement("div");
    div.innerHTML = text.trim();
    const svg = div.querySelector("svg");
    if (!svg) throw new Error("SVG tag not found in file");
    svg.setAttribute("id", "dw-combat-svg");
    return svg;
  }

  function computeBoardCenter(svg) {
    const board = svg.querySelector("#board") || svg;
    const vbSrc = board.getAttribute("viewBox") || svg.getAttribute("viewBox");
    if (vbSrc) {
      const vb = vbSrc.split(/\s+/).map(Number);
      if (vb.length === 4 && vb.every(n => !isNaN(n))) {
        const [x, y, w, h] = vb;
        return { x: x + w / 2, y: y + h / 2 };
      }
    }
    const bbox = (board.getBBox && board.getBBox()) ? board.getBBox() : { x: 0, y: 0, width: 100, height: 100 };
    return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
  }

  function rotateVec(dx, dy, facing) {
    const f = ((facing % 4) + 4) % 4;
    switch (f) {
      case 0: return { dx, dy };
      case 1: return { dx: dy, dy: -dx };
      case 2: return { dx: -dx, dy: -dy };
      case 3: return { dx: -dy, dy: dx };
      default: return { dx, dy };
    }
  }

  function getCell(x, y) {
    return state.svg.querySelector(`#cells [data-x="${x}"][data-y="${y}"]`);
  }

  function clearHighlights() {
    state.svg.querySelectorAll(".hl-move").forEach(el => el.classList.remove("hl-move"));
    state.svg.querySelectorAll(".hl-target").forEach(el => el.classList.remove("hl-target"));
  }

  function highlightMoves() {
    if (!state.svg) return;
    clearHighlights();
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
    state.facing = ((state.facing + (dir > 0 ? 1 : -1)) % 4 + 4) % 4;
    const angle = state.facing * 90;
    if (state.cam) {
      const c = state.center;
      state.cam.setAttribute("transform", `rotate(${angle} ${c.x} ${c.y})`);
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

  function ensureMigrate() {
    if (window.DWSVGMigrate && typeof window.DWSVGMigrate.run === "function") {
      window.DWSVGMigrate.run(state.svg);
    }
  }

  async function init() {
    try {
      // idempotent
      if (state.root) return;

      const root = document.createElement("div");
      root.id = "dw-combat-root";
      root.style.position = "relative";
      root.style.zIndex = "10";
      document.body.appendChild(root);
      state.root = root;

      state.svg = await loadSVGInline("combat-overlay.svg");
      root.appendChild(state.svg);

      state.cam = state.svg.querySelector("#cam") || state.svg;
      state.board = state.svg.querySelector("#board") || state.svg;
      state.center = computeBoardCenter(state.svg);

      ensureMigrate();
      ensurePointerCSS();
      bindButtons();
      highlightMoves();

      window[BOOT_NS] = {
        rotateLeft: () => rotateCamera(-1),
        rotateRight: () => rotateCamera(+1),
        highlightMoves,
        getFacing: () => state.facing,
        setHeroPos: (x, y) => { state.hero.x = x|0; state.hero.y = y|0; highlightMoves(); },
        setFacing: (f) => { state.facing = (f|0)%4; const prev = state.facing; rotateCamera(0); },
      };

      log("Overlay ready");
      dispatch("dw:combat:overlayReady", {});
    } catch (err) {
      console.error("Combat overlay init failed:", err);
    }
  }

  // Run now if DOM is already ready; otherwise wait
  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();