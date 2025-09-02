import { HeroPanel } from "./HeroPanel"
import { InventoryPanel } from "./InventoryPanel"
import { Chat } from "./Chat"
import { StatusBar } from "./StatusBar"
import { DebugPanel } from "./DebugPanel"
import { useRef, useState } from "react"

const PANELS = ["П", "Р", "И"] // Персонаж, Рассказ(чат), Инвентарь

export function Layout(){
  const [idx, setIdx] = useState(1) // chat default
  const [debug, setDebug] = useState(false)
  const startX = useRef<number|null>(null)

  const onTouchStart = (e: React.TouchEvent)=>{ startX.current = e.touches[0].clientX }
  const onTouchMove = (e: React.TouchEvent)=>{
    if (startX.current==null) return
    const dx = e.touches[0].clientX - startX.current
    if (Math.abs(dx) > 50){
      if (dx < 0) setIdx((p)=> (p+1)%3)
      else setIdx((p)=> (p+2)%3)
      startX.current = null
    }
  }
  const onTouchEnd = ()=>{ startX.current = null }

  const label = (i:number)=>PANELS[i]

  return (
    <div className="min-h-screen p-4 md:p-6 relative">
      {/* Debug toggle */}
      <button onClick={()=>setDebug(x=>!x)} className="fixed right-4 top-4 z-50 text-xs px-2 py-1 rounded border border-iron bg-coal/70 hover:bg-coal">Debug</button>
      <DebugPanel open={debug}/>

      {/* mobile overlay marker */}
      <div className="md:hidden pointer-events-none fixed left-0 right-0 top-2 z-40 flex items-center justify-center gap-3">
        <span className="text-[10px] opacity-60">{label((idx+2)%3)}</span>
        <span className="text-sm px-2 py-1 rounded-full bg-accent text-white border border-accent">{label(idx)}</span>
        <span className="text-[10px] opacity-60">{label((idx+1)%3)}</span>
      </div>

      {/* mobile carousel */}
      <div className="md:hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {idx===0 && <div className="space-y-3 pt-6">
          <div className="h-[18vh]"><StatusBar/></div>
          <HeroPanel/>
        </div>}
        {idx===1 && <div className="pt-6">
          <StatusBar/>
          <div className="h-[78vh] bg-coal/60 rounded-xl2 p-4 border border-iron"><Chat/></div>
        </div>}
        {idx===2 && <div className="pt-6"><InventoryPanel/></div>}
      </div>

      {/* desktop grid full height */}
      <div className="hidden md:grid max-w-7xl mx-auto grid-cols-3 gap-4" style={{height:"calc(100vh - 3rem)"}}>
        <div className="h-full overflow-hidden"><HeroPanel/></div>
        <div className="h-full overflow-hidden flex flex-col">
          <StatusBar/>
          <div className="flex-1 bg-coal/60 rounded-xl2 p-4 border border-iron overflow-hidden"><Chat/></div>
        </div>
        <div className="h-full overflow-hidden"><InventoryPanel/></div>
      </div>
    </div>
  )
}
