// Combat Overlay v1 — patch2
(()=>{
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const overlay = qs('#combatOverlay');
  const boardEl = qs('#board');
  const heroSprite = qs('#heroSprite');
  const cntAtk = qs('#cntAtk'); const cntMove = qs('#cntMove'); const cntSimple = qs('#cntSimple');
  const badgeDefense = qs('#badgeDefense');
  const inputDraft = qs('#combatInput');

  const devBtn = qs('#btnDevBattle');
  const chatSend = qs('#sendBtn');
  const chatInput = qs('#chatInput');

  const btnClose = qs('#btnCloseCombat');
  const turnL = qs('#btnTurnLeft');
  const turnR = qs('#btnTurnRight');
  const btnRollback = qs('#btnRollback');

  const X_MIN=-3, X_MAX=3, Y_MIN=-1, Y_MAX=4; // 7x6
  let facing = 0;

  const character = {
    isRanger: true,
    rangerPreciseShotAvailable: true,
    hasThrowOnBelt: true,
    canCastSimple: false,
    canCastComplex: false,
    isAktonist: false,
  };

  const state = {
    turn: 1,
    spent: { atk:0, move:0, simple:0 },
    caps:  { atk:1, move:1, simple:1 },
    hero:  { x:0, y:Y_MAX }, // start at bottom-center
    enemies: [],
    obstacles: [],
    queue: [],
    draftParts: [],
    defenseActive: false,
    startSnapshot: null, // snapshot of start-of-turn
  };

  function snapshotStart(){
    state.startSnapshot = {
      hero: { ...state.hero },
      spent: { ...state.spent },
      queue: [],
      draftParts: [],
      defenseActive: false
    };
  }
  function rollbackTurn(){
    if (!state.startSnapshot) return;
    state.hero = { ...state.startSnapshot.hero };
    state.spent = { ...state.startSnapshot.spent };
    state.queue = [];
    state.draftParts = [];
    state.defenseActive = false;
    if (badgeDefense) badgeDefense.hidden = true;
    if (inputDraft) inputDraft.value = '';
    updateCounters();
    positionHero();
    clearHighlights();
  }

  function openDevBattle(){
    state.enemies = [
      { id:'e1', name:'Разбойник', x:1, y:2, armor_ph:1, ward_mag:0, shield:false },
      { id:'e2', name:'Лучник',   x:-1, y:3, armor_ph:0, ward_mag:0, shield:true },
      { id:'e3', name:'Босс',     x:0, y:1, armor_ph:2, ward_mag:1, shield:true, boss:true }
    ];
    state.obstacles = [ { x:-2, y:2 }, { x:2, y:2 }, { x:1, y:3 } ];
    state.hero = { x:0, y:Y_MAX }; // bottom
    state.turn = 1;
    resetTurn();
    renderBoard();
    positionHero();
    showOverlay(true);
  }

  function showOverlay(v){ overlay.classList.toggle('hidden', !v); overlay.setAttribute('aria-hidden', v? 'false':'true'); }

  function resetTurn(){
    state.spent = { atk:0, move:0, simple:0 };
    state.queue = [];
    state.draftParts = [];
    state.defenseActive = false;
    updateCounters();
    if (badgeDefense) badgeDefense.hidden = true;
    if (inputDraft) inputDraft.value = "";
    clearHighlights();
    snapshotStart();
  }

  function updateCounters(){
    if (cntAtk) cntAtk.textContent = String(state.caps.atk - state.spent.atk);
    if (cntMove) cntMove.textContent = String(state.caps.move - state.spent.move);
    if (cntSimple) cntSimple.textContent = String(state.caps.simple - state.spent.simple);
  }

  function renderBoard(){
    // Wipe cells (but keep hero sprite)
    qsa('.cell', boardEl).forEach(n => n.remove());
    for(let y=Y_MIN; y<=Y_MAX; y++){
      for(let x=X_MIN; x<=X_MAX; x++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x; cell.dataset.y = y;
        // obstacle
        if (state.obstacles.some(o=>o.x===x&&o.y===y)) {
          cell.classList.add('obstacle');
          cell.appendChild(makeLabel('▧'));
          cell.addEventListener('mouseenter', ()=> highlightCoverFrom(x,y,true));
          cell.addEventListener('mouseleave', ()=> highlightCoverFrom(x,y,false));
        }
        // enemy
        const enemy = state.enemies.find(e=>e.x===x&&e.y===y);
        if (enemy){
          cell.classList.add('enemy');
          cell.appendChild(makeLabel(enemy.boss?'Босс':'Враг'));
        }
        // click hook
        cell.addEventListener('click', ()=> onCellClick(x,y));
        boardEl.appendChild(cell);
      }
    }
  }

  function makeLabel(text){ const lb=document.createElement('div'); lb.className='label'; lb.textContent=text; return lb; }
  function getCell(x,y){ return qs(`.cell[data-x="${x}"][data-y="${y}"]`, boardEl); }
  function clearHighlights(){ qsa('.cell', boardEl).forEach(c=> c.classList.remove('target','range','blocked','cover-highlight')); }

  function addDraft(text){ state.draftParts.push(text); if (inputDraft) inputDraft.value = state.draftParts.join(' '); }

  // Movement mapping: hero at bottom, forward goes UP (towards smaller y)
  const MOVE_VECTORS = {
    back:{dx:0, dy:+1},
    back_diag:{dx:+1, dy:+1},
    fwd:{dx:0, dy:-2},
    fwd_diag:{dx:+1, dy:-1},
    left:{dx:-1, dy:0},
    right:{dx:+1, dy:0},
  };

  function queueMove(kind){
    if (!canSpend('move')) return toast('Нет очков движения');
    const v = MOVE_VECTORS[kind]; if (!v) return;
    const nx = clamp(state.hero.x + v.dx, X_MIN, X_MAX);
    const ny = clamp(state.hero.y + v.dy, Y_MIN, Y_MAX);
    // prevent stepping onto obstacle
    if (state.obstacles.some(o=>o.x===nx && o.y===ny)) return toast('Дорога перекрыта укрытием');
    state.queue.push({kind:'move', data:{kind}});
    spend('move',1);
    addDraft(moveDraftText(kind));
    // apply and animate
    state.hero.x = nx; state.hero.y = ny;
    positionHero();
  }

  function positionHero(){
    if (!heroSprite) return;
    const cell = getCell(state.hero.x, state.hero.y);
    if (!cell) return;
    const boardRect = boardEl.getBoundingClientRect();
    const rect = cell.getBoundingClientRect();
    const tx = rect.left - boardRect.left;
    const ty = rect.top  - boardRect.top;
    heroSprite.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  function moveDraftText(kind){
    const map = {
      back:'Отошёл назад.', back_diag:'Отошёл назад по диагонали.',
      fwd:'Шагнул вперёд.', fwd_diag:'Шагнул вперёд по диагонали.',
      left:'Шагнул влево.', right:'Шагнул вправо.'
    };
    return map[kind] || 'Сместился.';
  }

  function queueDefense(){
    if (!canSpend('atk')) return toast('Нет очков атаки');
    state.queue.push({kind:'defense'}); spend('atk',1);
    state.defenseActive = true; if (badgeDefense) badgeDefense.hidden = false;
    addDraft('Встал в оборону.');
  }

  function queueMelee(){
    if (!canSpend('atk')) return toast('Нет очков атаки');
    const adj = targetsAdjacent();
    if (adj.length===0) return toast('Нет цели рядом');
    highlightTargets(adj);
    boardEl.onclick = (e)=>{
      const t = e.target.closest('.cell.target'); if (!t) return;
      boardEl.onclick = null; clearHighlights();
      const x=+t.dataset.x, y=+t.dataset.y;
      const enemy = findEnemy(x,y);
      state.queue.push({kind:'melee', data:{id:enemy.id}});
      spend('atk',1);
      addDraft(`Ударил по ${enemy.name}.`);
    };
  }

  function queueShoot(ignoreArmorPh=false, ignoreShield=false, precise=false){
    if (!canSpend('atk')) return toast('Нет очков атаки');
    const tgt = targetsLineOfSight();
    if (tgt.length===0) return toast('Нет цели по линии');
    highlightTargets(tgt);
    boardEl.onclick = (e)=>{
      const t = e.target.closest('.cell.target'); if (!t) return;
      boardEl.onclick = null; clearHighlights();
      const x=+t.dataset.x, y=+t.dataset.y;
      const enemy = findEnemy(x,y);
      const data = { id:enemy.id, ignoreArmorPh, ignoreShield, precise };
      state.queue.push({kind:'shoot', data}); spend('atk',1);
      if (precise){
        if (!canSpend('simple')) return toast('Нет ПРОСТ для Меткого выстрела');
        spend('simple',1); addDraft(`Меткий выстрел по ${enemy.name}.`);
      } else addDraft(`Выстрелил в ${enemy.name}.`);
    };
  }

  function queueMagic(){
    if (!(character.canCastSimple || character.canCastComplex)) return toast('Магия недоступна');
    if (!canSpend('atk')) return toast('Нет очков атаки');
    const tgt = targetsMagicRange(4);
    if (tgt.length===0) return toast('Нет цели для магии (до 4 клеток по линии)');
    highlightTargets(tgt);
    boardEl.onclick = (e)=>{
      const t = e.target.closest('.cell.target'); if (!t) return;
      boardEl.onclick = null; clearHighlights();
      const x=+t.dataset.x, y=+t.dataset.y;
      const enemy = findEnemy(x,y);
      state.queue.push({kind:'magic', data:{ id:enemy.id }});
      spend('atk',1); addDraft(`Прочитал заклинание на ${enemy.name}.`);
    };
  }

  function queueThrow(){
    if (!character.hasThrowOnBelt && !character.isAktonist) return toast('Нет метательного на Поясе');
    if (!canSpend('simple')) return toast('Нет простых действий');
    const range = character.isAktonist? 3 : 2;
    const candidates = state.enemies.map(e=> ({e,dist: chebDist(state.hero.x,state.hero.y,e.x,e.y)})).filter(o=> o.dist <= range);
    if (candidates.length===0) return toast('Нет доступных целей для метания');
    candidates.sort((a,b)=> a.dist-b.dist || a.e.y-b.e.y || a.e.x-b.e.x);
    const target = candidates[0].e;
    state.queue.push({kind:'throw', data:{ id:target.id, range }});
    spend('simple',1); addDraft(`Метнул в ${target.name}.`);
  }

  function endTurn(){
    if (state.queue.length===0) addDraft('Ждёт...');
    const log = state.queue.map(evt=>{
      switch(evt.kind){
        case 'move': return 'Перемещение.';
        case 'defense': return 'Оборона активна до следующего хода.';
        case 'melee': return `Атака в ближнем бою по ${ename(evt.data.id)}.`;
        case 'shoot': return evt.data.precise?`Меткий выстрел по ${ename(evt.data.id)} (игнор физ. брони${evt.data.ignoreShield?' и щита':''}).`:`Выстрел по ${ename(evt.data.id)}.`;
        case 'magic': return `Заклинание поражает ${ename(evt.data.id)}.`;
        case 'throw': return `Метательное попадает в ${ename(evt.data.id)}.`;
        case 'potion': return 'Выпил зелье.';
        case 'bandage': return 'Сделал перевязку.';
        default: return 'Действие.';
      }
    }).join(' ');
    toast(`Ход ${state.turn} завершён. ${log}`);
    state.turn += 1;
    resetTurn();
  }

  // Helpers
  function canSpend(type, amount=1){ return (state.spent[type] + amount) <= state.caps[type]; }
  function spend(type, amount=1){ state.spent[type]+=amount; updateCounters(); }
  function ename(id){ return (state.enemies.find(e=>e.id===id)||{}).name || 'цель'; }
  function findEnemy(x,y){ return state.enemies.find(e=>e.x===x && e.y===y); }
  function chebDist(x1,y1,x2,y2){ return Math.max(Math.abs(x1-x2), Math.abs(y1-y2)); }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function targetsAdjacent(){
    const list = [];
    for (const e of state.enemies){
      if (chebDist(e.x,e.y,state.hero.x,state.hero.y) === 1) list.push(e);
    }
    return list;
  }
  function clearLine(x1,y1,x2,y2){
    if (x1===x2){
      const [a,b] = y1<y2 ? [y1,y2] : [y2,y1];
      for (let y=a+1; y<b; y++){ if (state.obstacles.some(o=>o.x===x1 && o.y===y)) return false; }
      return true;
    }
    if (y1===y2){
      const [a,b] = x1<x2 ? [x1,x2] : [x2,x1];
      for (let x=a+1; x<b; x++){ if (state.obstacles.some(o=>o.x===x && o.y===y1)) return false; }
      return true;
    }
    return false;
  }
  function targetsLineOfSight(){
    const list = [];
    for (const e of state.enemies){
      if ((e.x===state.hero.x || e.y===state.hero.y) && clearLine(state.hero.x,state.hero.y,e.x,e.y)) list.push(e);
    }
    return list;
  }
  function targetsMagicRange(maxDist){
    const list = [];
    for (const e of state.enemies){
      if ((e.x===state.hero.x || e.y===state.hero.y) && clearLine(state.hero.x,state.hero.y,e.x,e.y)){
        if (chebDist(state.hero.x,state.hero.y,e.x,e.y) <= maxDist) list.push(e);
      }
    }
    return list;
  }
  function highlightTargets(list){
    clearHighlights();
    for (const e of list){
      const c = getCell(e.x,e.y); if (c) c.classList.add('target');
    }
  }
  function onCellClick(x,y){}

  // Cover cone oriented from obstacle towards hero vector; shown ONLY if hero is adjacent to obstacle.
  function highlightCoverFrom(ox,oy, enable){
    qsa('.cell', boardEl).forEach(c=> c.classList.remove('cover-highlight'));
    if (!enable) return;
    if (chebDist(ox,oy,state.hero.x,state.hero.y) > 1) return; // only if hero is adjacent
    const vx = state.hero.x - ox, vy = state.hero.y - oy;
    if (vx===0 && vy===0) return;
    for (let y=Y_MIN; y<=Y_MAX; y++){
      for (let x=X_MIN; x<=X_MAX; x++){
        const dx = x - ox, dy = y - oy;
        const along = dx*vx + dy*vy;           // projection (dot)
        const cross = Math.abs(dx*vy - dy*vx); // |perp| via cross-product magnitude
        if (along >= 0 && cross <= Math.abs(along)){
          const c = getCell(x,y); if (c) c.classList.add('cover-highlight');
        }
      }
    }
  }

  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, { position:'fixed', left:'50%', top:'10px', transform:'translateX(-50%)', background:'rgba(0,0,0,.7)',
      color:'#fff', padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border)', zIndex:200 });
    document.body.appendChild(t); setTimeout(()=> t.remove(), 1600);
  }

  // Bindings
  if (btnClose) btnClose.addEventListener('click', ()=> showOverlay(false));
  if (turnL) turnL.addEventListener('click', ()=> { facing=(facing+270)%360; toast('Повернулся налево'); });
  if (turnR) turnR.addEventListener('click', ()=> { facing=(facing+90)%360; toast('Повернулся направо'); });
  if (btnRollback) btnRollback.addEventListener('click', rollbackTurn);

  const bDef = qs('#actDefense'); if (bDef) bDef.addEventListener('click', queueDefense);
  const bMelee = qs('#actMelee'); if (bMelee) bMelee.addEventListener('click', queueMelee);
  const bShoot = qs('#actShoot'); if (bShoot) bShoot.addEventListener('click', ()=> queueShoot(false,false,false));
  const bMagic = qs('#actMagic'); if (bMagic) bMagic.addEventListener('click', queueMagic);
  const bThrow = qs('#actThrow'); if (bThrow) bThrow.addEventListener('click', queueThrow);
  const bPotion = qs('#actPotion'); if (bPotion) bPotion.addEventListener('click', ()=> { if(!canSpend('simple')) return toast('Нет простых'); state.queue.push({kind:'potion'}); addDraft('Выпил зелье.'); spend('simple',1); });
  const bBand = qs('#actBandage'); if (bBand) bBand.addEventListener('click', ()=> { if(!canSpend('simple')) return toast('Нет простых'); state.queue.push({kind:'bandage'}); addDraft('Перевязался.'); spend('simple',1); });

  const btnEnd = qs('#btnEndTurn'); if (btnEnd) btnEnd.addEventListener('click', endTurn);

  if (devBtn) devBtn.addEventListener('click', openDevBattle);
  if (chatSend) chatSend.addEventListener('click', ()=>{
    const v = (chatInput && chatInput.value || '').trim(); if(!v) return;
    if (v.includes('_проверка_боя')) openDevBattle();
    if (chatInput) chatInput.value='';
  });

  // export
  window.CombatOverlay = {
    open: openDevBattle, close: ()=> showOverlay(false),
    setCharacter: (data)=> Object.assign(character, data||{}),
    setCaps: (caps)=> { state.caps = Object.assign(state.caps, caps||{}); updateCounters(); },
    loadBattle: ({hero,enemies,obstacles})=>{
      if (hero) state.hero = {...hero};
      if (enemies) state.enemies = enemies.slice();
      if (obstacles) state.obstacles = obstacles.slice();
      state.turn = 1; resetTurn(); renderBoard(); positionHero(); showOverlay(true);
    }
  };
})();