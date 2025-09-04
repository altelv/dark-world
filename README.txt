
Root-based variant (без /public).
Скопируйте папки/файлы в корень репозитория:
- combat-overlay.svg
- js/combat-overlay.js
- assets/combat/{hero.png,enemy.png,boss.png}

В index.html добавьте внизу перед </body>:
  <script type="module" src="/js/combat-overlay.js"></script>

Добавьте id на кнопку открытия боя (или появится плавающая кнопка «Бой»):
  <button id="open-combat">DEV: открыть бой</button>

Уберите старый <script src="combat.js?...">, чтобы не конфликтовал.
