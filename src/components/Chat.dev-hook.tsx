import { useRef } from "react"
import { useGameStore } from "@store/game"
import { devStartBattle } from "@store/devBattle"

// Drop-in helper: wrap your submit handler with this checker.
export function useDevChatHook(){
  const store = useGameStore()
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
