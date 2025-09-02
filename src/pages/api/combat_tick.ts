
import type { NextApiRequest, NextApiResponse } from "next"
import { enemyCanShootHero, checkTargetInCoverCone } from "@game/battle/los"
import { d20, enemyAttackDC, enemyDefenseDC, rankBaseDamage, damageCorrection, heroSkill, heroParryThreshold, heroDodgeAllowed, heroDodgeBonus } from "@server/combat/engine"

function mulberry32(a:number){ return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

export default async function handler(req:NextApiRequest, res:NextApiResponse){
  if (req.method !== "POST"){ res.status(405).json({ error: "Method not allowed" }); return }
  try{
    const { action, state, seed } = req.body || {}
    const rng = mulberry32(typeof seed==="number" ? seed : Math.floor(Math.random()*1e9))

    const hero = state.hero
    const board = state.board
    const enemiesArr = Object.values(board.enemies).filter((e:any)=> e.hpState!=="dead")
    const logs: string[] = []
    const updates: Record<string, any> = {}

    // Player action
    if (action?.kind && action.kind !== "none" && action.targetId){
      const target:any = enemiesArr.find((e:any)=> e.id===action.targetId)
      if (target){
        const dcBase = enemyDefenseDC(target)
        let dc = dcBase
        if (action.kind==="shoot" || action.kind==="magic" || action.kind==="throw"){
          if (checkTargetInCoverCone(board, target.pos)){
            dc = Math.ceil(dcBase * 1.3)
          }
        }
        const roll = d20(rng)
        const luck = hero.luck ?? 0
        const fatigue = hero.fatigue ?? 0
        let skill = 0
        if (action.kind==="melee") skill = heroSkill(hero, "combat")
        if (action.kind==="shoot") skill = heroSkill(hero, "focus")
        if (action.kind==="magic") skill = heroSkill(hero, "arcana")
        if (action.kind==="throw") skill = heroSkill(hero, "athletics")
        const total = roll + skill + luck - (fatigue||0)

        let hit=false, crit=false, stages=0
        if (roll===1) { hit=false }
        else if (roll===20){ hit=true; crit=true; stages=2 }
        else { hit = total >= dc; stages = hit ? 1 : 0 }

        logs.push(`Атака: d20=${roll} + Skill(${skill}) + Luck(${luck}) - Fatigue(${fatigue||0}) = ${total} vs DC ${dc} → ${hit ? (crit?"КРИТ (−2 ступени)":"УСПЕХ (−1 ступень)") : "Промах"}.`)
        if (hit){
          const order = ["unhurt","light","heavy","near_death","dead"]
          const idx = order.indexOf(target.hpState)
          const newIdx = Math.min(order.length-1, idx + stages)
          updates[target.id] = { hpState: order[newIdx] }
        }
      }
    }else{
      logs.push("Игрок не атакует.")
    }

    // Enemies turn
    const armorDR = (state.hero.armorId==="light"?1: state.hero.armorId==="medium"?2: state.hero.armorId==="heavy"?3:0)
    const shieldDR = (state.hero.shieldId==="light"?1: state.hero.shieldId==="medium"?2: state.hero.shieldId==="heavy"?3:0)
    let heroHp = state.hero.hp

    for (const e:any of enemiesArr){
      if (updates[e.id]?.hpState === "dead" || e.hpState==="dead") continue
      const canShoot = enemyCanShootHero(board, e.pos, {x:0,y:0})
      if (!canShoot){ logs.push(`Враг ${e.name} не видит цель из-за укрытия и не атакует.`); continue }

      const dc = enemyAttackDC(e)
      const roll = d20(rng)
      const defSkill = heroSkill(state.hero, "defense")
      const luck = state.hero.luck ?? 0
      const fatigue = state.hero.fatigue ?? 0
      const total = roll + defSkill + luck - (fatigue||0)

      if (roll===20){ logs.push(`Защита: d20=20 → КРИТ-успех, контратака разрешена.`); continue }
      if (total >= dc){
        const P = heroParryThreshold(state.hero.armorId, state.hero.shieldId)
        if (P!=null && total >= (dc + P)){ logs.push(`Защита: ${total} vs DC ${dc} → ПАРИРОВАНИЕ, контратака разрешена.`); continue }
        else { logs.push(`Защита: ${total} vs DC ${dc} → УСПЕХ, урон 0.`); continue }
      }

      let dodged = false
      if (heroDodgeAllowed(state.hero.armorId, state.hero.shieldId)){
        const r2 = d20(rng)
        const total2 = r2 + heroSkill(state.hero, "acrobatics") + heroDodgeBonus(state.hero) + luck - (fatigue||0)
        if (total2 >= dc){ logs.push(`Уворот: d20=${r2} → успели уклониться, урон 0.`); dodged = true }
      }

      if (!dodged){
        const [minB, maxB] = rankBaseDamage(e.rank)
        const base = Math.floor(minB + (maxB-minB+1)*rng())
        const corr = damageCorrection(dc, total)
        let damage = base + corr
        if (roll===1){ damage *= 2; logs.push(`Крит-провал защиты: урон умножен ×2.`) }
        const afterDR = Math.max(0, damage - armorDR - shieldDR)
        heroHp = Math.max(0, heroHp - afterDR)
        logs.push(`Враг ${e.name} попадает: d20=${roll} + Defense(${defSkill}) = ${total} vs DC ${dc} → Урон ${afterDR} (${base}${corr?`+${corr}`:""} − DR${armorDR+shieldDR}). HP: ${heroHp}.`)
      }
    }

    const allDead = Object.values(board.enemies).every((e:any)=> (updates[e.id]?.hpState ?? e.hpState) === "dead")
    const to_player = logs.join("\n")
    const payload = { to_player, battle: { enemies: updates, hero: { hp: heroHp }, log: logs }, end: allDead || heroHp<=0 }
    res.status(200).json(payload)
  }catch(e:any){
    res.status(500).json({ error: "combat engine failure", detail: String(e) })
  }
}
