
import React, { useRef, useState } from 'react'
import type { Character, RollRequest, RollResolution } from '../game/state/types'
import { D20RollLauncher } from '../game/dice'
import { computeRollResolution, formatRollBreakdown } from '../game/state/rules'
import { runHiddenChecks, HiddenCheckResult } from '../game/hiddenChecks/engine'

type Enemy = { name:string, state:'Не ранены'|'Легко ранены'|'Тяжело ранены'|'При смерти'|'Мёртв' }

type Props = {
  character: Character
  setCharacter: (c:Character)=>void
  mode: 'Бой'|'Сюжет'
  enemies: Enemy[]
  setEnemies: (e:Enemy[])=>void
  pendingRoll: RollRequest | null
  setPendingRoll: (r:RollRequest|null)=>void
  lastRoll: RollResolution | null
  setLastRoll: (r:RollResolution)=>void
}

export function CenterChat({ character, setCharacter, mode, enemies, setEnemies, pendingRoll, setPendingRoll, lastRoll, setLastRoll }: Props){
  const [sending, setSending] = useState(false)
  const [log, setLog] = useState<string[]>([ '— Добро пожаловать в Темный Мир, одинокая душа.' ])
  const taRef = useRef<HTMLTextAreaElement>(null)
  function push(msg:string){ setLog(l=>[...l, msg]) }

  function startRoll(skill?:string){
    const req: RollRequest = { skill:(skill as any)||'Поиск', dc:15, luck:character.luck, fatigue:character.fatigue, inventiveness:0, mode }
    setPendingRoll(req)
  }
  function onRoll(decision: { d20:number }){
    if(!pendingRoll) return
    const result = computeRollResolution(character, pendingRoll, decision.d20)
    setLastRoll(result); setPendingRoll(null)
    const pre = result.success ? 'УСПЕХ!' : 'Провал...'
    push(`${pre} ${formatRollBreakdown(result)}`)
  }

  async function onSend(){
    if(sending) return
    setSending(true)
    const txt = (taRef.current?.value||'').trim()
    taRef.current!.value = ''
    const hidden: HiddenCheckResult[] = await runHiddenChecks(mode, character)
    if(hidden.length){
      hidden.forEach(h=>{
        push(`**${h.title} — успех!**`)
        push(`— ${h.textHighlighted}`)
      })
    }else{
      push('— …')
    }
    if(mode==='Бой' && enemies.length){
      const line = '==Статус врагов:== ' + enemies.map(e=>{
        const ico = e.state==='Не ранены'?'⬜':e.state==='Легко ранены'?'🟨':e.state==='Тяжело ранены'?'🟧':e.state==='При смерти'?'🟥':'☠'
        return `${e.name} ${ico}`
      }).join('  |  ')
      push(line)
    }
    setSending(false)
  }

  return (
    <div className="chat-wrap">
      <div className="dice-area"><D20RollLauncher request={pendingRoll} onRoll={onRoll} /></div>
      <div className="chat-log">
        {log.map((m,i)=>(<div className="chat-msg" key={i} dangerouslySetInnerHTML={{__html: m.replace(/==(.+?)==/g,'<span class="hl-yellow">$1</span>')}}/>))}
      </div>
      <div className="chat-input">
        <textarea ref={taRef} placeholder="Опиши действие..."/>
        <button className="btn btn-primary" disabled={sending} onClick={onSend}>Отправить</button>
        <button className="btn btn-gold" onClick={()=>startRoll()} disabled={!!pendingRoll}>Бросить d20</button>
      </div>
    </div>
  )
}
