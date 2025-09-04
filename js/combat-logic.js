(function(){
  const NS = "DWCombatLogic";
  if (window[NS]) return;

  const state = {
    turn: 1,
    hero: { id: "hero", class: "Рейнджер", pos: { x: 0, y: 0 }, statuses: [] },
    enemies: [],
  };

  function log(text) {
    window.dispatchEvent(new CustomEvent("dw:combat:log", { detail: { text } }));
    console.log("[CombatLogic]", text);
  }
  function emitState() {
    window.dispatchEvent(new CustomEvent("dw:combat:state", { detail: { state: JSON.parse(JSON.stringify(state)) } }));
  }
  function isHeavyArmorClass() {
    return state.hero.class === "Панцирь" || state.hero.class === "Кирасир";
  }
  function applyDefense() {
    state.hero.statuses = state.hero.statuses.filter(s => s.id !== "defense");
    if (isHeavyArmorClass()) {
      state.hero.statuses.push({ id:"defense", type:"dr", value:1, expiresAtTurn: state.turn + 1 });
      log("Оборона: +1 DR до начала следующего хода.");
    } else {
      state.hero.statuses.push({ id:"defense", type:"defense_check_bonus", value:1, expiresAtTurn: state.turn + 1 });
      log("Оборона: +1 к проверкам защиты от всех атак до начала следующего хода.");
    }
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", { detail: { kind:"defense" } }));
    emitState();
  }
  function distance(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
  function selectNearestEnemy() {
    const alive = state.enemies.filter(e => e.alive !== false);
    if (alive.length === 0) return null;
    const heroPos = state.hero.pos;
    let best = alive[0], bestD = distance(best.pos, heroPos);
    for (let i=1;i<alive.length;i++){
      const d = distance(alive[i].pos, heroPos);
      if (d < bestD || (d===bestD && (alive[i].pos.y < best.pos.y || (alive[i].pos.y===best.pos.y && alive[i].pos.x < best.pos.x)))) {
        best = alive[i]; bestD = d;
      }
    }
    return best;
  }
  function performThrow(detail) {
    let target = null;
    if (detail && detail.targetId) {
      target = state.enemies.find(e => e.id === detail.targetId && e.alive !== false) || null;
      if (!target) log(`Метание: цель ${detail.targetId} не найдена, выберу ближайшую.`);
    }
    if (!target) target = selectNearestEnemy();
    if (!target) {
      window.dispatchEvent(new CustomEvent("dw:combat:actionRejected", { detail: { kind:"throw", reason:"Нет доступных целей" } }));
      log("Метание невозможно: нет доступных целей.");
      return;
    }
    log(`Метание: цель — ${target.id}. (Проверка «Ловкость рук», крит даёт +1 статус урона)`);
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", { detail: { kind:"throw", payload: { targetId: target.id, rule:"sleight_of_hand_with_crit_status_plus_one" } } }));
    emitState();
  }
  function performRangerPrecise() {
    if (state.hero.class !== "Рейнджер") {
      window.dispatchEvent(new CustomEvent("dw:combat:actionRejected", { detail: { kind:"ranger_precise", reason:"Доступно только Рейнджеру" } }));
      log("«Меткий выстрел» доступен только Рейнджеру.");
      return;
    }
    log("Меткий выстрел: АТК+ПРОСТ, игнор физ. брони.");
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", { detail: { kind:"ranger_precise", payload: { ignores:"physical_armor" } } }));
    emitState();
  }
  function performAttack() {
    log("Обычная атака: передана в боевое ядро.");
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", { detail: { kind:"attack" } }));
  }
  function startNextTurn() {
    state.turn += 1;
    state.hero.statuses = state.hero.statuses.filter(s => s.expiresAtTurn > state.turn);
    emitState();
    log(`Ход игрока #${state.turn}`);
  }
  function onAction(ev) {
    const kind = ev && ev.detail && ev.detail.kind;
    if (!kind) return;
    switch (kind) {
      case "defense": return applyDefense();
      case "throw": return performThrow(ev.detail);
      case "ranger_precise": return performRangerPrecise();
      case "attack": return performAttack();
      case "end_turn": window.dispatchEvent(new CustomEvent("dw:combat:endTurnAck")); startNextTurn(); return;
      default: return;
    }
  }
  function init(){ window.addEventListener("dw:combat:action", onAction); log("Логика боя подключена. Класс героя: "+state.hero.class); emitState(); }
  window[NS] = {
    init,
    setHeroClass: (cls)=>{ state.hero.class = cls; emitState(); },
    setHeroPos: (x,y)=>{ state.hero.pos.x=x|0; state.hero.pos.y=y|0; emitState(); },
    setEnemies: (arr)=>{ state.enemies = Array.isArray(arr) ? arr.map(e=>({...e})) : []; emitState(); },
    getState: ()=> JSON.parse(JSON.stringify(state)),
  };
  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else document.addEventListener("DOMContentLoaded", init);
})();