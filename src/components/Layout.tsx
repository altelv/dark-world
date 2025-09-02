import { HeroPanel } from "./HeroPanel"
import { InventoryPanel } from "./InventoryPanel"
import { Chat } from "./Chat"
import { StatusBar } from "./StatusBar"
import { useRef, useState } from "react"

const PANELS = ["П", "Р", "И"] // Персонаж, Рассказ(чат), Инвентарь

export function Layout(){
  const [idx, setIdx] = useState(1) // center is chat by default
  const startX = useRef<number|null>(null)

  const onTouchStart = (e: React.TouchEvent)=>{ startX.current = e.touches[0].clientX }
  const onTouchMove = (e: React.TouchEvent)=>{
    if (startX.current==null) return
    const dx = e.touches[0].clientX - startX.current
    if (Math.abs(dx) > 60){
      if (dx < 0) setIdx((p)=> (p+1)%3)
      else setIdx((p)=> (p+2)%3)
      startX.current = null
    }
  }
  const onTouchEnd = ()=>{ startX.current = null }

  const label = (i:number)=>PANELS[i]

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* mobile indicator */}
      <div className="md:hidden mb-2 flex items-center justify-center gap-6 text-ash">
        <Badge active label={label(idx)} />
        <span className="text-xs">← {label((idx+2)%3)} | {label((idx+1)%3)} →</span>
      </div>

      {/* mobile carousel */}
      <div className="md:hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {idx===0 && <div className="space-y-3">
          <div className="h-[18vh]"><StatusBar/></div>
          <HeroPanel/>
        </div>}
        {idx===1 && <div>
          <StatusBar/>
          <div className="h-[75vh] bg-coal/60 rounded-xl2 p-4 border border-iron"><Chat/></div>
        </div>}
        {idx===2 && <InventoryPanel/>}
      </div>

      {/* desktop grid */}
      <div className="hidden md:grid max-w-7xl mx-auto grid-cols-3 gap-4">
        <div><HeroPanel/></div>
        <div>
          <StatusBar/>
          <div className="h-[75vh] bg-coal/60 rounded-xl2 p-4 border border-iron"><Chat/></div>
        </div>
        <div><InventoryPanel/></div>
      </div>
    </div>
  )
}

function Badge({active, label}:{active?:boolean, label:string}){
  return (
    <div className={"rounded-full w-8 h-8 flex items-center justify-center border " + (active ? "bg-accent text-white border-accent" : "bg-iron text-ash border-iron")}>
      {label}
    </div>
  )
}
