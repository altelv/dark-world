import { useGameStore } from '@store/game'

/**
 * Dev-хук: перехватывает спец-команды из ввода, чтобы не дёргать ИИ.
 * Возвращает true, если команда обработана локально.
 */
export function useDevChatHook(){
  const store = useGameStore()
  return {
    intercept(text: string){
      const t = text.trim().toLowerCase()
      if (t === '_проверка_боя'){
        store.pushSystem('Dev: Бой начат (заглушка). Враги: 2.')
        return true
      }
      if (t === '_бросок_20'){
        const roll = Math.floor(Math.random()*20)+1
        store.pushSystem(`Dev: d20 = ${roll}`)
        return true
      }
      return false
    }
  }
}
