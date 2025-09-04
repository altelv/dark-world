(function () {
  const hostSelector = '#combat-overlay';
  const svgUrl = '/combat-overlay.svg';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    facing: 0,            // 0: up, 1: right, 2: down, 3: left (relative to board)
    boardCenter: {x: 0, y: 0},
    mode: 'move'
  };

  function ensureHost(){
    let host = $(hostSelector);
    if (!host) {
      host = document.createElement('div');
      host.id = hostSelector.replace('#','');
      document.body.appendChild(host);
    }
    return host;
  }

  async function inlineSvg(host){
    let svg = host.querySelector('svg[data-dw-combat]');
    if (svg) return svg;
    const res = await fetch(svgUrl + '?v=' + Date.now());
    const txt = await res.text();
    host.innerHTML = txt;
    svg = host.querySelector('svg[data-dw-combat]');
    return svg;
  }

  function getSvg(){ return document.querySelector('#combat-overlay svg[data-dw-combat]'); }
  function idFor(x,y){ return `cell_${x}_${y}`; }
  function getCell(x,y){
    const svg = getSvg();
    if (!svg) return null;
    return svg.querySelector('#'+CSS.escape(idFor(x,y)));
  }

  function rotate90CW(x,y){ return {x:y, y:-x}; } // clockwise
  function withFacing(dx,dy){
    let v = {x: dx, y: dy};
    for (let i=0;i<state.facing;i++){ v = rotate90CW(v.x, v.y); }
    return {dx: v.x, dy: v.y};
  }

  function clearHL(){
    const svg = getSvg(); if(!svg) return;
    svg.querySelectorAll('#cells rect.hl-move').forEach(n => n.classList.remove('hl-move'));
    svg.querySelectorAll('#cells rect.hl-target').forEach(n => n.classList.remove('hl-target'));
  }

  function hlMoves(){
    clearHL();
    const base = [
      {dx:0, dy:+1},   // forward 1
      {dx:0, dy:+2},   // forward 2
      {dx:-1, dy:0},   // left 1
      {dx:+1, dy:0},   // right 1
      {dx:-1, dy:+1},  // diagonals 1
      {dx:+1, dy:+1},
      {dx:-1, dy:-1},
      {dx:+1, dy:-1}
    ];
    base.map(v => withFacing(v.dx, v.dy)).forEach(v => {
      const c = getCell(v.dx, v.dy);
      if (c) c.classList.add('hl-move');
    });
  }

  function hlTargets(){
    clearHL();
    // Simple 3x3 ring around origin as placeholder target area
    for(let dx=-1; dx<=1; dx++){
      for(let dy=-1; dy<=1; dy++){
        if(dx===0 && dy===0) continue;
        const v = withFacing(dx,dy);
        const c = getCell(v.dx, v.dy);
        if (c) c.classList.add('hl-target');
      }
    }
  }

  function setMode(m){
    state.mode = m;
    if (m==='move') hlMoves();
    else if (m==='attack') hlTargets();
    else clearHL();
  }

  function computeBoardCenter(){
    const svg = getSvg(); if(!svg) return {x:0,y:0};
    const board = svg.querySelector('#board');
    if (!board || !board.getBBox) return {x:0,y:0};
    const bb = board.getBBox(); // {x,y,width,height}
    return {x: bb.x + bb.width/2, y: bb.y + bb.height/2};
  }

  function rotateCamera(sign){
    const svg = getSvg(); if(!svg) return;
    state.facing = (state.facing + (sign>0?1:3)) % 4;
    const cam = svg.querySelector('#cam');
    if (!cam) return;
    // Base transform (if any) + rotation around board center
    const cx = state.boardCenter.x, cy = state.boardCenter.y;
    cam.setAttribute('transform', `rotate(${state.facing*90} ${cx} ${cy})`);
    setMode(state.mode);
  }

  function pointerfy(){
    const svg = getSvg(); if(!svg) return;
    [
      '#btn_attack',
      '#btn_defense',
      '#btn_ranger_precise',
      '#btn_throw',
      '#btn_potion',
      '#btn_bandage',
      '#btn_end_turn',
      '#btn_turn_left',
      '#btn_turn_right',
      '#btn_rollback'
    ].forEach(sel => {
      const el = svg.querySelector(sel);
      if (el) el.classList.add('clickable');
    });
  }

  function injectCSS(){
    if (document.getElementById('dw-combat-css')) return;
    const css = document.createElement('style');
    css.id = 'dw-combat-css';
    css.textContent = `
      #combat-overlay .clickable { cursor: pointer }
      #combat-overlay #cells rect.hl-move { outline: 2px dashed rgba(0,0,0,.6); outline-offset: -2px }
      #combat-overlay #cells rect.hl-target { outline: 2px solid rgba(0,0,0,.9); outline-offset: -2px }
    `;
    document.head.appendChild(css);
  }

  function dispatchAction(kind, detail={}){
    const ev = new CustomEvent('dw:combat:action', { detail: { kind, ...detail }});
    window.dispatchEvent(ev);
  }

  function bind(){
    const svg = getSvg(); if(!svg) return;

    const on = (sel, handler) => {
      const el = svg.querySelector(sel);
      if (el) el.addEventListener('click', handler);
    };

    on('#btn_turn_left',  () => rotateCamera(-1));
    on('#btn_turn_right', () => rotateCamera(+1));

    on('#btn_attack',          () => { setMode('attack'); dispatchAction('attack'); });
    on('#btn_defense',         () => { dispatchAction('defense'); });
    on('#btn_ranger_precise',  () => { dispatchAction('ranger_precise'); });
    on('#btn_throw',           () => { dispatchAction('throw'); });
    on('#btn_potion',          () => { dispatchAction('potion'); });
    on('#btn_bandage',         () => { dispatchAction('bandage'); });
    on('#btn_rollback',        () => { dispatchAction('rollback'); });

    on('#btn_end_turn',        () => {
      dispatchAction('end_turn');
      const ev = new CustomEvent('dw:combat:endTurn', { detail: {} });
      window.dispatchEvent(ev);
      setMode('move');
    });
  }

  async function start(){
    injectCSS();
    const host = ensureHost();
    await inlineSvg(host);
    state.boardCenter = computeBoardCenter();
    pointerfy();
    bind();
    setMode('move');
  }

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
