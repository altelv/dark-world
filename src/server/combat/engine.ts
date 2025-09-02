import type { Board, BoardEnemy, EnemyRank } from "@types/battle"
import type { Hero } from "@types/common"
import { checkTargetInCoverCone, enemyCanShootHero } from "@game/battle/los"
export type AttackResult = { hit:boolean; crit:boolean; roll:number; total:number; dc:number; stages:number; note?:string }
export function d20(rng:()=>number){ return Math.floor(rng()*20)+1 }
export function rankBaseDamage(rank:EnemyRank): [number,number] {
  switch(rank){ case "weak": return [1,2]; case "medium": return [1,3]; case "strong": return [2,4]; case "boss": return [3,5] }
}
export function stagesByRank(rank:EnemyRank): number {
  switch(rank){ case "weak": return 2; case "medium": return 3; case "strong": return 4; case "boss": return 5 }
}
export function damageCorrection(dc:number, total:number){ const M = dc - total; let corr = 0; if (M>=5) corr+=1; if (M>=10) corr+=2; return corr }
export function enemyDefenseDC(e:BoardEnemy){ return e.defenseDC }
export function enemyAttackDC(e:BoardEnemy){ return e.attackDC }
export function heroSkill(hero:Hero, id:keyof Hero["skills"]): number { return (hero.skills as any)[id] ?? 0 }
export function heroParryThreshold(armorId:string, shieldId?:string): number | null {
  let P = 10; if (armorId==="clothes") P-=3; if (armorId==="light") P-=2; if (armorId==="heavy") return null; if (shieldId==="heavy") return null; return P
}
export function heroDodgeAllowed(armorId:string, shieldId?:string): boolean { if (armorId==="heavy") return false; if (shieldId==="medium"||shieldId==="heavy") return false; return true }
export function heroDodgeBonus(hero:Hero): number { const acro = hero.skills.acrobatics ?? 0; const pb = hero.pb ?? 0; return Math.floor(acro/5)+Math.floor(pb/2) }
export function applyDR(base:number, armorDR:number, shieldDR:number): number { const dmg = base - armorDR - shieldDR; return Math.max(0, dmg) }
export function coverPenalty(board:Board, targetPos:{x:number,y:number}): number { return checkTargetInCoverCone(board, targetPos) ? 1.3 : 1.0 }
