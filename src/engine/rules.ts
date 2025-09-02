import type { Rank, Archetype } from "@types/common"
export const PT_BASE = 11
export const ARMOR = {
  clothes: { id:"clothes", name:"Одежда", dr:0, magic:0, acro:0, stealth:0, dodge:true, ptMod:-3 },
  light:   { id:"light",   name:"Лёгкая", dr:1, magic:0, acro:0, stealth:0, dodge:true, ptMod:-2 },
  medium:  { id:"medium",  name:"Средняя", dr:2, magic:-4, acro:-6, stealth:-6, dodge:false, ptMod:0, req:"kirosir|pancier" },
  heavy:   { id:"heavy",   name:"Тяжёлая", dr:3, magic:-6, acro:-8, stealth:-8, dodge:false, ptMod:0, req:"pancier" }
} as const
export const SHIELDS = {
  light: { id:"light", name:"Лёгкий щит", drBase:1, allowDodge:true, allowParry:true, ptMod:-2,
           craft:{ lighten:true }, penalties:{ sleight:-4 } },
  medium:{ id:"medium", name:"Средний щит", drBase:2, allowDodge:false, allowParry:true, ptMod:-1,
           craft:{ drPlusOne:true }, penalties:{ stealth:-4, sleight:-4 } },
  heavy: { id:"heavy", name:"Тяжёлый щит", drBase:3, allowDodge:false, allowParry:false,
           craft:{ drPlusOne:true }, penalties:{ stealth:-6, sleight:-6, awareness:-4 } }
} as const
export function shieldDRWithMastery(base:number, masteryDefenseMax:boolean){ return masteryDefenseMax ? base*2 : base }
export const RANK_DC: Record<Rank, {attack:number, defense:number}> = {
  weak:{attack:11, defense:11}, medium:{attack:14, defense:14}, strong:{attack:16, defense:16}, boss:{attack:18, defense:18}
}
export function applyArchetype(dc:{attack:number, defense:number}, arche:Archetype){
  const out={...dc}
  if (arche==="tank"){ out.attack-=2; out.defense+=2 }
  else if (arche==="avalanche"){ out.attack+=2; out.defense-=2 }
  else if (arche==="trickster"){ out.attack+=1; out.defense+=2 }
  return out
}
export function pbFromSkill(raw:number){
  if (raw>=25) return 8; if (raw>=21) return 7; if (raw>=17) return 6;
  if (raw>=13) return 5; if (raw>=9) return 4; if (raw>=5) return 3; if (raw>=1) return 2; return 2;
}
export const DODGE_PB_SHIFT = (pb:number)=>{ if (pb>=8) return -4; if (pb>=6) return -2; if (pb>=4) return -1; return 0 }
export function partialGraze(pb:number, failMargin:number){
  if (pb>=8 && failMargin<=4) return -2
  if (pb>=6 && failMargin<=3) return -2
  if (pb>=4 && failMargin<=2) return -1
  return 0
}
