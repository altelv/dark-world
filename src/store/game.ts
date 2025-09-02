import { create } from "zustand"
import type { Hero, Message, Enemy, Status } from "@types/common"
import { mulberry32, seedFromString } from "@utils/prng"

type Phase = "thinking"|"typing"|null

export interface GameState {
  seed:number; rng:()=>number; hero:Hero; enemies:Enemy[]; messages:Message[]; statuses:Status[];
  scene:{id:string, name:string}; distance:"melee"|"near"|"far"|"very_far";
  pendingPhase: Phase;
  bootstrap:()=>void; sendPlayer:(text:string)=>Promise<void>;
}

const defaultHero: Hero = {
  name:"Герой", race:"Человек", gender:"male", bank:46,
  skills: { acrobatics:12, defense:8, combat:8, athletics:8, endurance:6, medicine:4, focus:6, awareness:6, stealth:6, sleight:4, trade:0, insight:0, performance:0, arcana:0, msense:0, science:0, history:0, nature:0, crafting:6, tactics:6 },
  caps: {}, pb:4, hp_max:16, hp:16, fatigue:0, luck:0, armorId:"light", shieldId:"light", perks:{}
}

async function typewriterAppend(get:any, set:any, id:string, full:string){
  const CPS = 50
  const STEP = Math.max(1, Math.floor(full.length / Math.max(1, Math.ceil(full.length / CPS))))
  let shown = 0
  return new Promise<void>((resolve)=>{
    const interval = setInterval(()=>{
      shown = Math.min(full.length, shown + STEP)
      set((state:any)=>{
        const msgs = state.messages.map((m:any)=> m.id===id ? { ...m, text: full.slice(0, shown) } : m)
        return { messages: msgs }
      })
      if (shown >= full.length){
        clearInterval(interval)
        resolve()
      }
    }, 1000 / CPS * STEP)
  })
}

export const useGameStore = create<GameState>((set, get)=>({
  seed: seedFromString("dark-world-seed"),
  rng: mulberry32(seedFromString("dark-world-seed")),
  hero: defaultHero,
  enemies: [],
  messages: [],
  statuses: [],
  scene: { id:"start", name:"Пустошь у тракта" },
  distance: "near",
  pendingPhase: null,
  bootstrap: ()=>{
    const s = get()
    if (!s.messages.length){
      set({ messages: [
        { id: crypto.randomUUID(), role:"dm", text:"Добро пожаловать в Темный мир… Сырая дорога уходит между холмами, запах мокрой листвы звенит в воздухе. Что ты делаешь?" }
      ] })
    }
  },
  sendPlayer: async (text:string)=>{
    if (text.startsWith("_")){
      const cmd = text.trim().toLowerCase()
      if (cmd === "_бросок_20" || cmd === "_roll20"){
        const n = Math.floor(get().rng()*20)+1
        set({ messages: [...get().messages, { id: crypto.randomUUID(), role:"system", text: `Dev: d20 = ${n}` }] })
        return
      }
      if (cmd === "_запусти_бой" || cmd === "_start_combat"){
        set({ enemies: [{ id:"e1", name:"Разбойник-ловкач", rank:"medium", archetype:"trickster", attackDC:14, defenseDC:16, state:"unhurt" } as any] })
        set({ messages: [...get().messages, { id: crypto.randomUUID(), role:"system", text: "Dev: Бой начат (заглушка). Враг: Разбойник-ловкач." }] })
        return
      }
    }

    const before = get().messages
    const id = crypto.randomUUID()
    set({ messages: [...before, { id, role:"player", text }] })
    set({ pendingPhase: "thinking" })

    try{
      const res = await fetch("/api/narrate", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ text, state: { hero: get().hero, scene: get().scene, enemies: get().enemies } })
      })
      const data = await res.json()
      const toPlayer = data?.to_player || "…"

      const dmId = crypto.randomUUID()
      set({ messages: [...get().messages, { id: dmId, role:"dm", text: "", meta: data } ] , pendingPhase: "typing" })
      await typewriterAppend(get, set, dmId, toPlayer)
      set({ pendingPhase: null })
    }catch(e:any){
      set({ messages: [...get().messages, { id: crypto.randomUUID(), role:"system", text: "Сбой рассказчика. Попробуйте ещё раз." }], pendingPhase: null })
    }
  }
}))
