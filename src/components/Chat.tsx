import { useGameStore } from "@store/game"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { ImageBlock } from "./ImageBlock"

function Thinking(){
  return <div className="text-ash text-sm mt-1 typing">ДМ думает</div>
}

export function Chat(){
  const { messages, sendPlayer, pending } = useGameStore()
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length, pending])

  const onSubmit = () => {
    const v = text.trim()
    if (!v || pending) return
    sendPlayer(v); setText("")
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
        {messages.map(m => (
          <div key={m.id} className={clsx("max-w-[84%]", m.role==="player" ? "ml-auto" : "")}>
            <div className={clsx(
              "rounded-xl2 p-4 shadow-soft",
              m.role==="player" ? "bg-iron" : m.role==="dm" ? "bg-coal" : "bg-transparent text-ash border border-iron"
            )}>
              {Array.isArray(m.meta?.to_ui) && m.meta.to_ui.map((cmd:any, idx:number)=>{
                if (cmd?.cmd === "show_image" && cmd?.payload?.prompt){
                  return <ImageBlock key={idx} kind="scene" prompt={cmd.payload.prompt} />
                }
                if (cmd?.cmd === "show_creature" && cmd?.payload?.prompt){
                  return <ImageBlock key={idx} kind="creature" prompt={cmd.payload.prompt} />
                }
                return null
              })}
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
            </div>
          </div>
        ))}
        {pending && <Thinking/>}
        <div ref={endRef}/>
      </div>
      <div className="pt-3">
        <div className="relative">
          <textarea
            value={text}
            onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{ if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); onSubmit() } }}
            placeholder="Напишите, что делаете…"
            className="w-full bg-coal/70 border border-iron rounded-xl2 p-3 pr-16 focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none h-20"
          />
          <button
            onClick={onSubmit}
            disabled={pending}
            aria-label="Отправить"
            className={clsx(
              "absolute right-3 top-1/2 -translate-y-1/2 rounded-full w-10 h-10 flex items-center justify-center shadow-soft border",
              pending ? "bg-iron text-ash border-iron cursor-not-allowed opacity-60" : "bg-accent text-white border-accent hover:bg-accent/90"
            )}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
