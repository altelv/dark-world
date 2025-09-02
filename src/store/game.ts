import { create } from "zustand"
import type { Hero, Message, Enemy, Status } from "@types/common"
import { mulberry32, seedFromString } from "@utils/prng"

export interface GameState {
  seed:number; rng:()=>number; hero:Hero; enemies:Enemy[]; messages:Message[]; statuses:Status[];
  scene:{id:string, name:string}; distance:"melee"|"near"|"far"|"very_far";
  bootstrap:()=>void; sendPlayer:(text:string)=>Promise<void>;
}

const defaultHero: Hero = {
  name:"Герой", race:"Человек", gender:"male", bank:46,
  skills: { acrobatics:12, defense:8, combat:8, athletics:8, endurance:6, medicine:4, focus:6, awareness:6, stealth:6, sleight:4, trade:0, insight:0, performance:0, arcana:0, msense:0, science:0, history:0, nature:0, crafting:6, tactics:6 },
  caps: {}, pb:4, hp_max:16, hp:16, fatigue:0, luck:0, armorId:"light", shieldId:"light", perks:{}
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
  bootstrap: ()=>{
    const s = get()
    if (!s.messages.length){
      set({ messages: [
        { id: crypto.randomUUID(), role:"dm", text:"Добро пожаловать в Темный мир… Сырая дорога уходит между холмами, запах мокрой листвы звенит в воздухе. Что ты делаешь?" }
      ] })
    }
  },
  sendPlayer: async (text:string)=>{
    const before = get().messages
    const id = crypto.randomUUID()
    set({ messages: [...before, { id, role:"player", text }] })
    try{
      const res = await fetch("/api/narrate", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ text, state: { hero: get().hero, scene: get().scene, enemies: get().enemies } }) })
      const data = await res.json()
      const toPlayer = data?.to_player || "…"
      set({ messages: [...get().messages, { id: crypto.randomUUID(), role:"dm", text: toPlayer, meta: data }] })
    }catch(e:any){
      set({ messages: [...get().messages, { id: crypto.randomUUID(), role:"system", text: "Сбой рассказчика. Попробуйте ещё раз." }] })
    }
  }
}))
