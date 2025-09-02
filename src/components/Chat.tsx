import { useGameStore } from "@store/game"
import { useEffect, useRef, useState } from "react"
import clsx from "clsx"
import { ImageBlock } from "./ImageBlock"

function StatusLine({ phase }:{ phase:"thinking"|"typing"|null }){
  if (!phase) return null
  return (
    <div className="text-ash text-xs mt-1 flex items-center gap-2">
      <span>{phase==="thinking" ? "Рассказчик думает" : "Рассказчик печатает"}</span>
      <span className="typing-dots"><i></i><i></i><i></i></span>
    </div>
  )
}

export function Chat(){
  const { messages, pendingPhase, sendPlayer } = useGameStore()
  const [text, setText] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length, pendingPhase])

  useEffect(()=>{
    const el = listRef.current
    if (!el) return
    const onScroll = ()=>{
      const diff = el.scrollHeight - el.clientHeight - el.scrollTop
      setAtBottom(diff < 12)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return ()=> el.removeEventListener("scroll", onScroll)
  }, [])

  const onSubmit = () => {
    const v = text.trim()
    if (!v) return
    sendPlayer(v)
    setText("")
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
        {messages.map(m => (
          <div key={m.id} className={clsx(m.role==="dm" ? "w-full" : "max-w-[84%] ml-auto")}>
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
        <StatusLine phase={pendingPhase}/>
        <div ref={endRef}/>
      </div>

      {!atBottom && (
        <button
          onClick={()=> endRef.current?.scrollIntoView({ behavior:"smooth" })}
          className="absolute right-6 bottom-28 md:bottom-8 z-30 rounded-full w-10 h-10 bg-iron text-ash border border-iron hover:bg-iron/80"
          aria-label="В самый низ"
        >▼</button>
      )}

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
            disabled={!!pendingPhase}
            aria-label="Отправить"
            className={clsx(
              "absolute right-3 top-1/2 -translate-y-1/2 rounded-full w-10 h-10 flex items-center justify-center shadow-soft border",
              pendingPhase ? "bg-iron text-ash border-iron cursor-not-allowed opacity-60" : "bg-accent text-white border-accent hover:bg-accent/90"
            )}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
