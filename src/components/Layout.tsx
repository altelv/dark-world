import { HeroPanel } from "./HeroPanel"
import { InventoryPanel } from "./InventoryPanel"
import { Chat } from "./Chat"
import { StatusBar } from "./StatusBar"
import { useEffect, useState, useRef } from "react"

const PANELS = ["П", "Р", "И"]

export function Layout(){
  const [idx, setIdx] = useState(1)
  const startX = useRef<number|null>(null)

  useEffect(()=>{
    const onStart = (e:TouchEvent)=>{ startX.current = e.touches[0].clientX }
    const onMove = (e:TouchEvent)=>{
      if (startX.current==null) return
      const dx = e.touches[0].clientX - startX.current
      if (Math.abs(dx) > 60){
        if (dx < 0) setIdx((p)=> (p+1)%3)
        else setIdx((p)=> (p+2)%3)
        startX.current = null
      }
    }
    window.addEventListener("touchstart", onStart, { passive:true })
    window.addEventListener("touchmove", onMove, { passive:true })
    return ()=>{
      window.removeEventListener("touchstart", onStart as any)
      window.removeEventListener("touchmove", onMove as any)
    }
  }, [])

  const label = (i:number)=>PANELS[i]

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="md:hidden pointer-events-none absolute left-0 right-0 top-2 z-40 flex items-center justify-center gap-3">
        <span className="text-[10px] opacity-60">{label((idx+2)%3)}</span>
        <span className="text-sm px-2 py-1 rounded-full bg-accent text-white border border-accent shadow">{label(idx)}</span>
        <span className="text-[10px] opacity-60">{label((idx+1)%3)}</span>
      </div>

      <div className="md:hidden w-full h-full pt-6">
        {idx===0 && <div className="w-full h-full flex flex-col gap-3 px-4">
          <div className="h-[18vh]"><StatusBar/></div>
          <div className="flex-1 overflow-hidden"><HeroPanel/></div>
        </div>}
        {idx===1 && <div className="w-full h-full flex flex-col gap-3 px-4">
          <StatusBar/>
          <div className="flex-1 bg-coal/60 rounded-xl2 p-4 border border-iron overflow-hidden"><Chat/></div>
        </div>}
        {idx===2 && <div className="w-full h-full flex flex-col gap-3 px-4">
          <div className="flex-1 overflow-hidden"><InventoryPanel/></div>
        </div>}
      </div>

      <div className="hidden md:grid w-screen h-screen grid-cols-3 gap-4 p-6 box-border">
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
