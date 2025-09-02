import { PT_BASE, ARMOR, SHIELDS, DODGE_PB_SHIFT, partialGraze } from "./rules"
import type { Hero, Enemy, Distance } from "@types/common"

export function rollD20(rng:()=>number){ return Math.floor(rng()*20)+1 }

export function heroDodgeAvailable(hero:Hero){
  const armor = ARMOR[hero.armorId]
  return !!armor?.dodge
}

export function dodgeDCShift(hero:Hero, distance:Distance, shieldLightened:boolean){
  let shift = 0
  const armor = ARMOR[hero.armorId]
  if (!armor?.dodge) return { available:false, shift:0 }
  if (armor.id==="clothes") shift += -1
  if (distance==="melee") shift += 2
  if (hero.shieldId==="light" && shieldLightened) shift += -1
  shift += DODGE_PB_SHIFT(hero.pb)
  return { available:true, shift }
}

export function parryThreshold(hero:Hero){
  const armor = ARMOR[hero.armorId]
  const ptArmor = armor?.ptMod ?? 0
  const ptShield = hero.shieldId ? (SHIELDS[hero.shieldId]?.ptMod ?? 0) : 0
  return PT_BASE + ptArmor + ptShield
}

export function baseDamage(rank:Enemy["rank"], rnd:number){
  if (rank==="weak") return 1 + rnd%2
  if (rank==="medium") return 1 + rnd%3
  if (rank==="strong") return 2 + rnd%3
  return 3 + rnd%3 // boss
}

export function marginBonus(m:number){
  let bonus = 0
  if (m>=5) bonus += 1
  if (m>=10) bonus += 2
  return bonus
}
