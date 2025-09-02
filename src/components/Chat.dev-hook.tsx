import { useGameStore } from "@store/game"
import type { Board, BoardEnemy } from "@types/battle"

export function useDevChatHook(){
  const store = useGameStore()

  const devStartBattle = () => {
    const board: Board = {
      origin: {x:0,y:0},
      facing: 0,
      tiles: { "0,1":"cover", "2,2":"block" } as any,
      enemies: {} as any,
      rangeRules: { throw:2, magic:4, bow:999 }
    }
    const e1: BoardEnemy = { id:"e1", name:"Разбойник-ловкач", rank:"medium", archetype:"trickster", pos:{x:1,y:2}, defenseDC:16, attackDC:14, hpState:"unhurt" }
    const e2: BoardEnemy = { id:"e2", name:"Тяжёлый грабитель", rank:"strong", archetype:"tank", pos:{x:-2,y:3}, defenseDC:16, attackDC:14, hpState:"unhurt" }
    const e3: BoardEnemy = { id:"e3", name:"Лучник", rank:"medium", archetype:"trickster", pos:{x:0,y:4}, defenseDC:14, attackDC:14, hpState:"unhurt" }
    board.enemies = { e1, e2, e3 }
    store.startBattle(board)
    useGameStore.setState({ messages: [ ...useGameStore.getState().messages, { id: crypto.randomUUID(), role:"system", text:"Dev: Бой начат (тест)." } ] })
  }

  const intercept = (raw: string): boolean => {
    const t = raw.trim().toLowerCase()
    if (t === "_проверка_боя"){
      devStartBattle()
      return true
    }
    return false
  }

  return { intercept }
}
