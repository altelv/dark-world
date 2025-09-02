# Patch 2: Явные алиасы для Vite

Проблема с `@store/*` не исчезла — добавляем **прямые alias** в `vite.config.ts` (плюс оставляем `vite-tsconfig-paths` на будущее).

Шаги:
1) Замените файл `vite.config.ts` в корне на этот.
2) В Vercel нажмите: Deployments → три точки у последнего билда → **Redeploy** → **Clear Build Cache** = ON.
3) Дождитесь сборки. Ошибка `Rollup failed to resolve import "@store/game"` должна исчезнуть.

P.S. Очистка кеша важна: Vercel иногда держит старый `node_modules`.
