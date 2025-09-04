
(function () {
  const hostSelector = '#combat-overlay';
  const svgUrl = '/combat-overlay.svg';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  function ensureHost(){
    let host = $(hostSelector);
    if(!host){ host = document.createElement('div'); host.id='combat-overlay'; document.body.appendChild(host); }
    return host;
  }
  async function inlineSvg(host){
    let svg = host.querySelector('svg[data-dw-combat]');
    if(svg) return svg;
    const res = await fetch(svgUrl + '?v=' + Date.now());
    const txt = await res.text();
    host.innerHTML = txt;
    svg = host.querySelector('svg');
    if(svg) svg.setAttribute('data-dw-combat','1');
    return svg;
  }
  const state = { facing:0, mode:'move', boardCenter:{x:288,y:526} };
  function getSvg(){ return document.querySelector('#combat-overlay svg[data-dw-combat]'); }
  function idFor(x,y){ return `cell_${x}_${y}`; }
  function getCell(x,y){ const svg=getSvg(); if(!svg) return null; return svg.querySelector('#'+CSS.escape(idFor(x,y))); }
  function withFacing(dx,dy){ let x=dx,y=dy; for(let i=0;i<state.facing;i++){ const nx=y, ny=-x; x=nx; y=ny; } return {dx:x,dy:y}; }
  function clearHL(){ const svg=getSvg(); if(!svg) return; svg.querySelectorAll('#cells rect.hl-move').forEach(n=>n.classList.remove('hl-move')); svg.querySelectorAll('#cells rect.hl-target').forEach(n=>n.classList.remove('hl-target')); }
  function hlMoves(){ clearHL(); const deltas=[{dx:0,dy:+1},{dx:-1,dy:+1},{dx:+1,dy:+1},{dx:0,dy:-1},{dx:0,dy:-2},{dx:-1,dy:-1},{dx:+1,dy:-1},{dx:-1,dy:0},{dx:+1,dy:0}]; deltas.forEach(d=>{ const v=withFacing(d.dx,d.dy); const c=getCell(v.dx,v.dy); if(c) c.classList.add('hl-move'); }); }
  function hlTargets(){ clearHL(); for(let dx=-1;dx<=1;dx++){ for(let dy=-1;dy<=1;dy++){ if(dx===0&&dy===0) continue; const v=withFacing(dx,dy); const c=getCell(v.dx,v.dy); if(c) c.classList.add('hl-target'); } } }
  function setMode(m){ state.mode=m; if(m==='move') hlMoves(); else if(m==='attack') hlTargets(); else clearHL(); }
  function rotateCamera(sign){ state.facing=(state.facing+(sign>0?1:3))%4; const svg=getSvg(); if(!svg) return; const cam=svg.querySelector('#cam'); if(cam) cam.setAttribute('transform', `rotate(${state.facing*90} ${state.boardCenter.x} ${state.boardCenter.y})`); setMode(state.mode); }
  function pointerfy(){ const svg=getSvg(); if(!svg) return; ['#btn_turn_left','#btn_turn_right','#btn_rollback','#btn_ATTAK','#btn_defense','#btn_ranger_precise','#btn_throw','#btn_potion','#btn_bandage','#btn_end_turn'].forEach(sel=>{ const el=svg.querySelector(sel); if(el) el.classList.add('clickable'); }); }
  function injectCSS(){ if(document.getElementById('dw-combat-css')) return; const css=document.createElement('style'); css.id='dw-combat-css'; css.textContent=`#combat-overlay svg .clickable{cursor:pointer} #combat-overlay svg #cells rect.hl-move{outline:2px solid rgba(122,87,198,.9);outline-offset:-2px} #combat-overlay svg #cells rect.hl-target{outline:2px dashed rgba(122,87,198,.9);outline-offset:-2px}`; document.head.appendChild(css); }
  function bind(){ const svg=getSvg(); if(!svg) return; const on=(sel,fn)=>{ const el=svg.querySelector(sel); if(el) el.addEventListener('click',fn); }; on('#btn_turn_left',()=>rotateCamera(-1)); on('#btn_turn_right',()=>rotateCamera(+1)); on('#btn_rollback',()=>{ setMode('move'); }); on('#btn_ATTAK',()=>setMode('attack')); on('#btn_defense',()=>setMode('defense')); on('#btn_throw',()=>setMode('throw')); on('#btn_potion',()=>setMode('potion')); on('#btn_bandage',()=>setMode('bandage')); on('#btn_end_turn',()=>{ const ev=new CustomEvent('dw:combat:endTurn',{detail:{}}); window.dispatchEvent(ev); }); }
  async function start(){ injectCSS(); const host=ensureHost(); await inlineSvg(host); pointerfy(); bind(); setMode('move'); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', start); } else start();
})();