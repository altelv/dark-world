/**
 * Dark World — Combat Action Logic (lightweight, event-driven)
 * Implements:
 *  - Defense: +1 DR only for 'Панцирь' & 'Кирасир'; others get +1 to defense checks vs all attacks.
 *    Duration: until the start of the next player's turn.
 *  - Throw: if no explicit target given, auto-select nearest enemy.
 *  - Ranger Precise: available only if hero.class === 'Рейнджер'.
 *
 * This module listens for `dw:combat:action` from the UI and emits:
 *  - dw:combat:log { text }
 *  - dw:combat:state { state }
 *  - dw:combat:actionRejected { reason, kind }
 *  - dw:combat:actionResolved { kind, payload }
 *  - dw:combat:endTurn (pass-through if UI sends it)
 *
 * NOTE: Dice rolls / damage resolution are delegated to the game's core systems.
 */
(function(){
  const NS = "DWCombatLogic";
  if (window[NS]) return;

  const state = {
    turn: 1, // player's turn counter
    hero: {
      id: "hero",
      class: "Рейнджер", // default; change via setHeroClass
      pos: { x: 0, y: 0 },
      statuses: [], // e.g., { id:'defense', type:'dr'|'defense_check_bonus', value:1, expiresAtTurn:2 }
    },
    enemies: [
      // Example placeholders; replace from your game state adapter
      // { id:'e1', pos:{x:2,y:1}, alive:true },
      // { id:'e2', pos:{x:1,y:3}, alive:true },
    ],
  };

  function log(text) {
    window.dispatchEvent(new CustomEvent("dw:combat:log", { detail: { text } }));
    console.log("[CombatLogic]", text);
  }

  function emitState() {
    window.dispatchEvent(new CustomEvent("dw:combat:state", { detail: { state: serializeState() } }));
  }

  function serializeState() {
    return JSON.parse(JSON.stringify(state));
  }

  function isHeavyArmorClass() {
    const c = state.hero.class;
    return c === "Панцирь" || c === "Кирасир";
  }

  function applyDefense() {
    // Remove previous defense status if any
    state.hero.statuses = state.hero.statuses.filter(s => s.id !== "defense");
    if (isHeavyArmorClass()) {
      state.hero.statuses.push({ id:"defense", type:"dr", value:1, expiresAtTurn: state.turn + 1 });
      log("Оборона: +1 DR до начала следующего хода.");
    } else {
      state.hero.statuses.push({ id:"defense", type:"defense_check_bonus", value:1, expiresAtTurn: state.turn + 1 });
      log("Оборона: +1 к проверкам защиты от всех атак до начала следующего хода.");
    }
    emitState();
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", { detail: { kind:"defense" } }));
  }

  function distance(a, b) {
    const dx = (a.x - b.x);
    const dy = (a.y - b.y);
    return Math.abs(dx) + Math.abs(dy); // manhattan for grid
  }

  function selectNearestEnemy() {
    const alive = state.enemies.filter(e => e.alive !== false);
    if (alive.length === 0) return null;
    const heroPos = state.hero.pos;
    let best = alive[0], bestD = distance(best.pos, heroPos);
    for (let i=1; i<alive.length; i++) {
      const d = distance(alive[i].pos, heroPos);
      if (d < bestD) { best = alive[i]; bestD = d; }
      else if (d === bestD) {
        // tie-break: prefer lower y (closer "forward"), then lower x (left)
        if (alive[i].pos.y < best.pos.y) { best = alive[i]; bestD = d; }
        else if (alive[i].pos.y === best.pos.y && alive[i].pos.x < best.pos.x) { best = alive[i]; bestD = d; }
      }
    }
    return best;
  }

  function performThrow(detail) {
    const explicitTargetId = detail && detail.targetId;
    let target = null;
    if (explicitTargetId) {
      target = state.enemies.find(e => e.id === explicitTargetId && e.alive !== false) || null;
      if (!target) { log(`Метание: цель ${explicitTargetId} не найдена, выберу ближайшую.`); }
    }
    if (!target) target = selectNearestEnemy();

    if (!target) {
      window.dispatchEvent(new CustomEvent("dw:combat:actionRejected", { detail: { kind:"throw", reason:"Нет доступных целей" } }));
      log("Метание невозможно: нет доступных целей.");
      return;
    }
    log(`Метание: цель — ${target.id}. (Проверка «Ловкость рук», крит даёт +1 статус урона)`);

    // Defer actual roll/damage to game core; we emit intent with resolved target
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", {
      detail: {
        kind: "throw",
        payload: { targetId: target.id, rule: "sleight_of_hand_check_with_crit_status_plus_one" }
      }
    }));
    emitState();
  }

  function performRangerPrecise() {
    if (state.hero.class !== "Рейнджер") {
      window.dispatchEvent(new CustomEvent("dw:combat:actionRejected", { detail: { kind:"ranger_precise", reason:"Доступно только Рейнджеру" } }));
      log("«Меткий выстрел» доступен только Рейнджеру.");
      return;
    }
    log("Меткий выстрел: АТК+ПРОСТ, игнор физ. брони. (Детали урона/бросков — в боевом ядре)");
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", {
      detail: { kind: "ranger_precise", payload: { ignores: "physical_armor" } }
    }));
    emitState();
  }

  function performAttack() {
    log("Обычная атака: передана в боевое ядро для расчёта попадания/урона.");
    window.dispatchEvent(new CustomEvent("dw:combat:actionResolved", { detail: { kind: "attack" } }));
  }

  function startNextTurn() {
    state.turn += 1;
    // Expire statuses whose expiresAtTurn === current turn
    state.hero.statuses = state.hero.statuses.filter(s => s.expiresAtTurn > state.turn);
    emitState();
    log(`Ход игрока #${state.turn}`);
  }

  function onAction(ev) {
    const { kind } = ev.detail || {};
    if (!kind) return;
    switch (kind) {
      case "defense": return applyDefense();
      case "throw": return performThrow(ev.detail);
      case "ranger_precise": return performRangerPrecise();
      case "attack": return performAttack();
      case "end_turn":
        window.dispatchEvent(new CustomEvent("dw:combat:endTurnAck", { detail: {} }));
        startNextTurn();
        return;
      default:
        // ignore other kinds here (potion/bandage/rollback etc.), or pass-through in the future
        return;
    }
  }

  function init() {
    window.addEventListener("dw:combat:action", onAction);
    log("Логика боя подключена. Класс героя: " + state.hero.class);
    emitState();
  }

  // Public API
  window[NS] = {
    init,
    setHeroClass: (cls) => { state.hero.class = cls; emitState(); },
    setHeroPos: (x,y) => { state.hero.pos.x = x|0; state.hero.pos.y = y|0; emitState(); },
    setEnemies: (arr) => { state.enemies = Array.isArray(arr) ? arr.map(e => ({...e})) : []; emitState(); },
    getState: () => JSON.parse(JSON.stringify(state)),
  };

  document.addEventListener("DOMContentLoaded", init);
})();