// /blocks/combat/combat-overlay.js
// v1 — базовая интерактивность под combat-overlay.svg

const SVG_URL = '/combat-overlay.svg';

class CombatOverlay {
  constructor(root) {
    this.root = root;
    this.state = {
      rotation: 0,
      turn: { atk: 1, move: 1, simple: 1 },
      defenseActive: false,
      draft: [],
      selection: { moveTo: null, target: null, action: null },
      grid: new Map(),
    };
  }

  async init() {
    const svgText = await fetch(SVG_URL).then(r => r.text());
    this.root.innerHTML = svgText;
    this.svg = this.root.querySelector('svg');

    this.$cam = this.svg.getElementById('cam');
    this.$cells = this.svg.getElementById('cells');
    this.$dmLog = this.svg.getElementById('dm_log_text');
    this.$counterAtk = this.svg.getElementById('counter_atk');
    this.$counterMove = this.svg.getElementById('counter_move');
    this.$counterSimple = this.svg.getElementById('counter_simple');

    this.$btnEnd = this.svg.getElementById('btn_end_turn');
    this.$btnL = this.svg.getElementById('btn_turn_left');
    this.$btnR = this.svg.getElementById('btn_turn_right');
    this.$btnAttack = this.svg.getElementById('btn_attack');
    this.$btnDefense = this.svg.getElementById('btn_defense');
    this.$btnThrow = this.svg.getElementById('btn_throw');
    this.$btnPotion = this.svg.getElementById('btn_potion');

    [this.$btnEnd, this.$btnL, this.$btnR, this.$btnAttack, this.$btnDefense, this.$btnThrow, this.$btnPotion]
      .filter(Boolean).forEach(el => { el.style.cursor = 'pointer'; el.style.pointerEvents = 'all'; });

    this._indexGrid();
    this._bind();
    this._updateCounters();
    this._highlightMoveOptions();
    this._log('— Бой начался. АТК 1/1 • ДВИЖ 1/1 • ПРОСТ 1/1');
  }

  _indexGrid() {
    const cellRx = /^cell_(-?\d+)_(-?\d+)$/;
    this.$cells.querySelectorAll('[id^="cell_"]').forEach(rect => {
      const m = rect.id.match(cellRx);
      if (!m) return;
      const [ , x, y ] = m;
      const key = `${x}_${y}`;
      this.state.grid.set(key, rect);
      rect.style.cursor = 'pointer';
      rect.style.pointerEvents = 'all';
      rect.dataset.x = x; rect.dataset.y = y;
    });
  }

  _bind() {
    this.$btnL?.addEventListener('click', () => this._rotate(-90));
    this.$btnR?.addEventListener('click', () => this._rotate(+90));

    this.$cells.addEventListener('click', (e) => {
      const rect = e.target.closest('[id^="cell_"]');
      if (!rect) return;
      const x = parseInt(rect.dataset.x, 10);
      const y = parseInt(rect.dataset.y, 10);

      if (this.state.turn.move > 0 && !this.state.selection.moveTo) {
        if (this._cellIsReachable(x,y)) {
          this.state.selection.moveTo = { x, y };
          this._markSelection(rect, 'move');
          this._draftPush(`Шагнул к (${x},${y})`);
          this._log(`Выбрана клетка движения (${x},${y}).`);
          this._clearMoveHighlight();
        } else {
          this._blink(rect, '#ff6262');
          this._log('Недопустимая клетка движения.');
        }
        return;
      }

      if (!this.state.selection.target) {
        this.state.selection.target = { x, y };
        this._markSelection(rect, 'target');
        this._draftPush(`Цель: (${x},${y})`);
        this._log(`Цель выбрана (${x},${y}).`);
      }
    });

    this.$btnEnd?.addEventListener('click', () => this._endTurn());

    this.$btnDefense?.addEventListener('click', () => {
      if (this.state.turn.atk <= 0) return this._log('Нет очков АТК.');
      this.state.defenseActive = true;
      this.state.turn.atk -= 1;
      this._updateCounters();
      this._badgeDefense(true);
      this._draftPush('Встал в оборону');
      this._log('Оборона активна: DEF+2 до начала следующего хода.');
    });

    this.$btnAttack?.addEventListener('click', () => {
      if (this.state.turn.atk <= 0) return this._log('Нет очков АТК.');
      if (!this.state.selection.target) return this._log('Не выбрана цель.');
      this.state.selection.action = 'attack';
      this._draftPush('Атаковал цель.');
      this._log('Атака добавлена в очередь. Движение в этом ходу далее запрещено.');
      this.state.turn.move = 0;
      this._updateCounters();
    });

    const bindSimple = (btn, name, draft) => btn?.addEventListener('click', () => {
      if (this.state.turn.simple <= 0) return this._log('Нет простых действий.');
      this.state.selection.action = this.state.selection.action || name;
      this.state.turn.simple -= 1;
      this._updateCounters();
      this._draftPush(draft);
      this._log(`${name === 'throw' ? 'Метание' : 'Простое действие'} добавлено в очередь.`);
    });
    bindSimple(this.$btnThrow, 'throw', 'Метнул метательное');
    bindSimple(this.$btnPotion, 'potion', 'Выпил зелье');
  }

  _rotate(delta) {
    this.state.rotation = (this.state.rotation + delta + 360) % 360;
    this.$cam.setAttribute('transform', `rotate(${this.state.rotation})`);
    this._log(`Поворот камеры: ${this.state.rotation}°`);
  }

  _updateCounters() {
    const setText = (g, txt) => {
      if (!g) return;
      const t = g.querySelector('text');
      if (t) t.textContent = txt;
    };
    setText(this.$counterAtk, `АТК ${this.state.turn.atk}/1`);
    setText(this.$counterMove, `ДВИЖ ${this.state.turn.move}/1`);
    setText(this.$counterSimple, `ПРОСТ ${this.state.turn.simple}/1`);
  }

  _log(text) {
    if (!this.$dmLog) return;
    const t = this.$dmLog.querySelector('text') || this.$dmLog;
    t.textContent = text;
  }

  _draftPush(s) {
    this.state.draft.push(s);
    const $input = this.svg.getElementById('input_text');
    if ($input) {
      const t = $input.querySelector('text');
      if (t) t.textContent = this.state.draft.join('. ') + '.';
    }
  }

  _markSelection(rect, kind) {
    if (!rect) return;
    const color = kind === 'move' ? '#7a57c6' : '#ffffff';
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', 2);
    rect.setAttribute('opacity', 0.9);
  }

  _blink(el, color = '#ffffff') {
    const old = el.getAttribute('stroke') || 'none';
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', 3);
    setTimeout(() => {
      el.setAttribute('stroke', old);
      el.setAttribute('stroke-width', 0);
    }, 200);
  }

  _badgeDefense(on) {
    const $hdr = this.svg.getElementById('header') || this.$btnDefense;
    if (!$hdr) return;
    $hdr.setAttribute('filter', on ? 'url(#shadow)' : '');
    this.$btnDefense && (this.$btnDefense.style.opacity = on ? '0.85' : '1');
  }

  _endTurn() {
    const steps = [];
    if (this.state.selection.moveTo && this.state.turn.move > 0) {
      steps.push(() => {
        this._log(`Двигаемся к ${this.state.selection.moveTo.x},${this.state.selection.moveTo.y}`);
        this.state.turn.move -= 1;
      });
    }
    if (this.state.turn.simple < 1) {
      steps.push(() => this._log('Обработано простое действие.'));
    }
    if (this.state.selection.action === 'attack' && this.state.turn.atk > 0) {
      steps.push(() => {
        this._log('Атака выполнена (плейсхолдер проверки/урона).');
        this.state.turn.atk -= 1;
      });
    }
    steps.forEach(fn => fn());
    this._updateCounters();
    this.state.selection = { moveTo: null, target: null, action: null };
    this.state.draft = [];
    setTimeout(() => {
      this.state.defenseActive = false;
      this._badgeDefense(false);
      this.state.turn = { atk: 1, move: 1, simple: 1 };
      this._updateCounters();
      this._clearMoveHighlight();
      this._highlightMoveOptions();
      this._log('— Новый ход. АТК 1/1 • ДВИЖ 1/1 • ПРОСТ 1/1');
    }, 250);
  }

  _cellIsReachable(x, y) {
    const dx = Math.abs(x);
    const dy = Math.abs(y);
    const isDiag = dx === dy && dx !== 0;
    if (isDiag) return dx === 1;
    return (dx <= 2 && dy === 0) || (dy <= 2 && dx === 0);
  }

  _highlightMoveOptions() {
    this.state.grid.forEach((rect, key) => {
      const [x, y] = key.split('_').map(Number);
      if (this._cellIsReachable(x, y)) {
        rect.setAttribute('fill-opacity', 0.25);
      } else {
        rect.setAttribute('fill-opacity', 0.05);
      }
    });
  }

  _clearMoveHighlight() {
    this.state.grid.forEach(rect => rect.setAttribute('fill-opacity', 0.08));
  }
}

(async function boot() {
  const root = document.getElementById('combat-root');
  if (!root) {
    console.error('[CombatOverlay] Missing #combat-root');
    return;
  }
  const overlay = new CombatOverlay(root);
  await overlay.init();
  window.DW_Combat = overlay;
})();
