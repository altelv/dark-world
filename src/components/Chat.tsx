import React, { useEffect, useRef, useState } from "react"
import { useGameStore } from "@store/game"
import clsx from "clsx"
import { useDevChatHook } from "./Chat.dev-hook"

export function Chat(){
  const store = useGameStore()
  const { intercept } = useDevChatHook()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const pending = store.pendingPhase // "thinking" | "typing" | null | undefined

  useEffect(()=>{
    const el = scrollRef.current
    if (!el) return
    const onScroll = ()=>{
      const delta = el.scrollHeight - el.scrollTop - el.clientHeight
      setAtBottom(delta < 80)
    }
    el.addEventListener("scroll", onScroll, { passive:true } as any)
    onScroll()
    return ()=> el.removeEventListener("scroll", onScroll as any)
  }, [])

  useEffect(()=>{
    if (atBottom){
      const el = scrollRef.current
      if (el) el.scrollTo({ top: el.scrollHeight })
    }
  }, [store.messages, atBottom])

  const scrollToBottom = ()=>{
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }

  // FIX: блокируем кнопку только во время обработки ответа ИИ
  const disabled = pending === "thinking" || pending === "typing"

  const onSend = async ()=>{
    const text = input.trim()
    if (!text) return
    if (intercept(text)){ setInput(""); return }
    await store.sendPlayer(text)
    setInput("")
  }

  // Используем типизированный обработчик вместо дженерика внутри сигнатуры — так надёжнее для esbuild.
  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey){
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3">
        {store.messages.map(m=>{
          const isPlayer = m.role === "player"
          const isSystem = m.role === "system"
          const align = isPlayer ? "items-end" : "items-start"
          return (
            <div key={m.id} className={clsx("flex w-full", align)}>
              <div className={clsx(
                "rounded-xl2 px-3 py-2 max-w-[95%] md:max-w-[80%] leading-relaxed",
                isSystem && "bg-transparent text-ash/60 text-xs",
                !isSystem && (isPlayer ? "bg-accent/80 text-white" : "bg-iron/70 text-ash border border-iron"),
                !isSystem && !isPlayer && "w-full"
              )}>
                {m.text}
              </div>
            </div>
          )
        })}
        {pending && (
          <div className="flex w-full items-start">
            <div className="rounded-xl2 px-3 py-2 bg-iron/70 text-ash border border-iron text-sm">
              {pending === "thinking" ? "Рассказчик думает" : "Рассказчик печатает"}<span className="inline-block animate-pulse">…</span>
            </div>
          </div>
        )}
      </div>

      {!atBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute left-1/2 -translate-x-1/2 bottom-[88px] md:bottom-[96px] z-30 bg-iron text-ash border border-iron px-3 py-1 rounded-full shadow hover:bg-iron/80 transition"
          title="К новому сообщению"
        >
          ↓ В самый низ
        </button>
      )}

      <form onSubmit={(e)=>{ e.preventDefault(); onSend() }} className="relative mt-2">
        <div className="rounded-full bg-iron/70 border border-iron px-4 pr-12 py-2">
          <textarea
            className="w-full bg-transparent outline-none resize-none max-h-40 placeholder:text-ash/50 text-ash"
            placeholder="Напишите действие…"
            rows={1}
            value={input}
            onChange={(e)=>{
              setInput(e.target.value)
              const ta = e.target as HTMLTextAreaElement
              ta.style.height = "auto"
              ta.style.height = Math.min(160, ta.scrollHeight) + "px"
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          className={clsx(
            "absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border flex items-center justify-center",
            "bg-accent text-white border-accent shadow",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={disabled ? "Ждём ответ рассказчика" : "Отправить"}
        >
          →
        </button>
      </form>
    </div> 
  )
}
export default Chat;
