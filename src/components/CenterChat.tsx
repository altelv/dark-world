import React, { useMemo, useRef, useState } from 'react'
import type { Character, RollRequest, RollResolution } from '@/game/state/types'
import { D20RollLauncher } from '@/game/dice/D20RollLauncher'
import { computeRollResolution, formatRollBreakdown } from '@/game/state/rules'

type Props = {
  character: Character
  mode: 'Бой'|'Сюжет'
  pendingRoll: RollRequest | null
  setPendingRoll: (r:RollRequest|null)=>void
  lastRoll: RollResolution | null
  setLastRoll: (r:RollResolution)=>void
}
export function CenterChat({ character, mode, pendingRoll, setPendingRoll, lastRoll, setLastRoll }: Props){
  const [sending, setSending] = useState(false)
  const [log, setLog] = useState<string[]>([
    '— Добро пожаловать в Темный Мир, одинокая душа.'
  ])
  const taRef = useRef<HTMLTextAreaElement>(null)

  function push(msg:string){ setLog(l=>[...l, msg]) }

  function startRoll(skill?:string){
    const req: RollRequest = {
      skill: skill || 'Поиск',
      dc: 15,
      luck: character.luck,
      fatigue: character.fatigue,
      inventiveness: 0,
      mode
    }
    setPendingRoll(req)
  }

  function onRoll(decision: { d20:number }){
    if(!pendingRoll) return
    const result = computeRollResolution(character, pendingRoll, decision.d20)
    setLastRoll(result)
    setPendingRoll(null)
    const pre = result.success ? 'УСПЕХ!' : 'Провал...'
    push(`${pre} ${formatRollBreakdown(result)}`)
  }

  return (
    <div className="chat-wrap">
      <div className="dice-area">
        <D20RollLauncher
          request={pendingRoll}
          onRoll={onRoll}
        />
      </div>

      <div className="chat-log">
        {log.map((m,i)=>(<div className="chat-msg" key={i}>{m}</div>))}
      </div>

      <div className="chat-input">
        <textarea ref={taRef} placeholder="Опиши действие..."/>
        <button className="btn btn-primary" disabled={sending}>Отправить</button>
        <button className="btn btn-gold" onClick={()=>startRoll()}
          disabled={!!pendingRoll}>Бросить d20</button>
      </div>
    </div>
  )
}
