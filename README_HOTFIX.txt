Внедрение хотфикса dev-команды:

1) В `src/components/Chat.tsx` найдите место, где отправляется текст игрока.
   Перед вызовом store.sendPlayer(text) добавьте перехват:

   import { useDevChatHook } from "./Chat.dev-hook"

   const { intercept } = useDevChatHook()

   const onSend = async () => {
     const t = input.trim()
     if (intercept(t)) { setInput(""); return }   // <-- откроет оверлей боя и прервёт обычную отправку
     await store.sendPlayer(t)
     setInput("")
   }

2) Если у вас нет возможности быстро править Chat.tsx — временно можно дергать
   dev-команду из адресной строки консоли браузера:
     window.__dw_dev_start_battle && window.__dw_dev_start_battle()

   Для этого в `src/main.tsx` добавьте строку:
     (window as any).__dw_dev_start_battle = () => require("@store/devBattle").devStartBattle()

3) Для Vercel-функции расчёта тика боя добавлен entry `api/combat_tick.ts`.
   Если у вас Vite, а не Next — именно эта функция подхватится.
