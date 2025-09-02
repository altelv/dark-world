import { useMemo } from "react"
import { useGameStore } from "@store/game"

export function DebugPanel({ open }:{ open:boolean }){
  const messages = useGameStore(s=>s.messages)
  const last = useMemo(()=>{
    const m = [...messages].reverse().find(x => x.meta && (x.meta.__debug || x.meta.to_ui || x.meta.to_secretary))
    return m?.meta || null
  }, [messages])

  if (!open || !last) return null
  return (
    <div className="fixed left-4 right-4 bottom-4 bg-ink/95 border border-iron rounded-xl2 p-3 text-xs z-50 max-h-[40vh] overflow-auto">
      <div className="font-semibold mb-2">Debug</div>
      <pre className="whitespace-pre-wrap">
        {JSON.stringify(last, null, 2)}
      </pre>
    </div>
  )
}
