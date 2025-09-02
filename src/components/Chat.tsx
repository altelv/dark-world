import { useGameStore } from "@store/game"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"

export function Chat(){
  const { messages, sendPlayer } = useGameStore()
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}) }, [messages.length])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
        {messages.map(m => (
          <div key={m.id} className={clsx("max-w-[84%]", m.role==="player" ? "ml-auto" : "")}>
            <div className={clsx("rounded-xl2 p-4 shadow-soft",
              m.role==="player" ? "bg-iron" : m.role==="dm" ? "bg-coal" : "bg-transparent text-ash border border-iron")}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
            </div>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
      <div className="pt-3">
        <div className="relative">
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{ if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); if (text.trim().length){ sendPlayer(text.trim()); setText("") } } }}
            placeholder="Напишите, что делаете…"
            className="w-full bg-coal/70 border border-iron rounded-xl2 p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none h-20"
          />
          <button onClick={()=>{ if(text.trim().length){ sendPlayer(text.trim()); setText("") } }}
            className="absolute right-2 bottom-2 bg-accent hover:bg-accent/90 text-white rounded-xl2 px-3 py-2 shadow-soft">
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
