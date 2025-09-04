
/* Dark World — Combat Overlay (v1.3.3)
 * Fixes:
 *  - Pointer cursor for interactive buttons
 *  - Movement highlights (forward 1/2, diagonals, strafe)
 *  - Default mode = 'move'
 *  - Camera rotation by rotating <g id="cam"> instead of teleporting hero
 *  - Safe selectors (no optional chaining on LHS)
 */
(function () {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Avoid double attach
  if (window.__dwCombatOverlayAttached) return;
  window.__dwCombatOverlayAttached = true;

  const state = {
    facing: 0, // 0 up, 1 right, 2 down, 3 left
    mode: 'move',
    turnDraft: [],
    counters: { atk: 1, move: 1, simple: 1 },
    boardCenter: { x: 288, y: 526 }, // approximate center of board in the provided SVG
  };

  function idFor(x, y) { return `cell_${x}_${y}`; }
  function getSvg() { return document.querySelector('#combat-overlay svg'); }
  function getCell(x, y) {
    const svg = getSvg(); if (!svg) return null;
    return svg.querySelector(`#${CSS.escape(idFor(x,y))}`);
  }

  function withFacing(dx, dy) {
    // rotate by state.facing steps (90deg clockwise each)
    let x = dx, y = dy;
    for (let i=0;i<state.facing;i++) {
      const nx = y;
      const ny = -x;
      x = nx; y = ny;
    }
    return { dx: x, dy: y };
  }

  function clearHighlights() {
    const svg = getSvg(); if (!svg) return;
    svg.querySelectorAll('#cells rect.hl-move').forEach(n => n.classList.remove('hl-move'));
    svg.querySelectorAll('#cells rect.hl-target').forEach(n => n.classList.remove('hl-target'));
  }

  function highlightMoves() {
    clearHighlights();
    const deltas = [
      {dx:0, dy:+1},           // назад
      {dx:-1, dy:+1},{dx:+1, dy:+1},
      {dx:0, dy:-1}, {dx:0, dy:-2}, // вперёд 1/2
      {dx:-1, dy:-1},{dx:+1, dy:-1}, // вперёд диагонали
      {dx:-1, dy:0},{dx:+1, dy:0},   // влево/вправо
    ];
    deltas.forEach(d => {
      const v = withFacing(d.dx, d.dy);
      const cell = getCell(v.dx, v.dy);
      if (cell) cell.classList.add('hl-move');
    });
  }

  function highlightTargets() {
    clearHighlights();
    for (let dx=-1; dx<=1; dx++) {
      for (let dy=-1; dy<=1; dy++) {
        if (dx===0 && dy===0) continue;
        const v = withFacing(dx, dy);
        const c = getCell(v.dx, v.dy);
        if (c) c.classList.add('hl-target');
      }
    }
  }

  function updateCounters() {
    const svg = getSvg(); if (!svg) return;
    const t1 = svg.querySelector('#counter_atk text'); if (t1) t1.textContent = `АТК ${state.counters.atk}/1`;
    const t2 = svg.querySelector('#counter_move text'); if (t2) t2.textContent = `ДВИЖ ${state.counters.move}/1`;
    const t3 = svg.querySelector('#counter_simple text'); if (t3) t3.textContent = `ПРОСТ ${state.counters.simple}/1`;
  }

  function addDraft(msg) {
    const host = document.getElementById('combat-draft');
    if (msg) window.__dw_draft = (window.__dw_draft || []).concat(msg);
    const text = (window.__dw_draft || []).join(' ');
    if (host) host.textContent = text;
  }

  function setMode(m) {
    state.mode = m;
    if (m==='move') highlightMoves();
    else if (m==='attack') highlightTargets();
    else clearHighlights();
    updateCounters();
  }

  function rotateCamera(dir) {
    state.facing = (state.facing + (dir>0?1:3)) % 4;
    const svg = getSvg(); if (!svg) return;
    const cam = svg.querySelector('#cam');
    if (cam) cam.setAttribute('transform', `rotate(${state.facing*90} ${state.boardCenter.x} ${state.boardCenter.y})`);
    // Recompute highlights for current mode
    setMode(state.mode);
  }

  function bindButtons() {
    const svg = getSvg(); if (!svg) return;
    const on = (sel, fn) => { const el = svg.querySelector(sel); if (el) el.addEventListener('click', fn); };

    on('#btn_turn_left', () => rotateCamera(-1));
    on('#btn_turn_right', () => rotateCamera(+1));
    on('#btn_rollback', () => { window.__dw_draft = []; addDraft(''); setMode('move'); });

    on('#btn_ATTAK', () => { setMode('attack'); addDraft('Атакую ближайшую цель.'); });
    on('#btn_defense', () => { setMode('defense'); addDraft('Встал в оборону.'); });
    on('#btn_throw', () => { setMode('throw'); addDraft('Метнул снаряд.'); });
    on('#btn_potion', () => { setMode('potion'); addDraft('Выпил зелье.'); });
    on('#btn_bandage', () => { setMode('bandage'); addDraft('Сделал перевязку.'); });
    on('#btn_end_turn', () => {
      const ev = new CustomEvent('dw:combat:endTurn', { detail: { draft: (window.__dw_draft || []).join(' ') } });
      window.dispatchEvent(ev);
    });
  }

  function makeClickableCursor() {
    const svg = getSvg(); if (!svg) return;
    const sels = [
      '#btn_turn_left','#btn_turn_right','#btn_rollback','#btn_ATTAK','#btn_defense',
      '#btn_ranger_precise','#btn_throw','#btn_potion','#btn_bandage','#btn_end_turn'
    ];
    sels.forEach(sel => {
      const el = svg.querySelector(sel);
      if (el) el.classList.add('clickable');
    });
  }

  function injectCSS() {
    if (document.getElementById('dw-combat-css')) return;
    const css = document.createElement('style');
    css.id = 'dw-combat-css';
    css.textContent = `
      #combat-overlay svg .clickable { cursor: pointer; }
      #combat-overlay svg #cells rect.hl-move { outline: 2px solid rgba(122,87,198,0.9); outline-offset: -2px; }
      #combat-overlay svg #cells rect.hl-target { outline: 2px dashed rgba(122,87,198,0.9); outline-offset: -2px; }
    `;
    document.head.appendChild(css);
  }

  function ensureDraftHost() {
    if (!document.getElementById('combat-draft')) {
      const d = document.createElement('div');
      d.id = 'combat-draft';
      d.style.position = 'absolute';
      d.style.left = '-9999px';
      document.body.appendChild(d);
    }
  }

  function init() {
    injectCSS();
    ensureDraftHost();
    makeClickableCursor();
    bindButtons();
    setMode('move'); // default — показать подсветку движения
  }

  // When overlay exists in DOM
  function ready(cb){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb);
    } else cb();
  }
  ready(() => setTimeout(() => { if (getSvg()) init(); }, 0));
})();
