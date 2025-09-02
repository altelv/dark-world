import type { VercelRequest, VercelResponse } from '@vercel/node'

function mulberry32(a:number){ return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }

export default async function handler(req:VercelRequest, res:VercelResponse){
  if (req.method !== "POST"){ res.status(405).json({ error: "Method not allowed" }); return }
  try{
    const { action, state, seed } = req.body || {}
    const rng = mulberry32(typeof seed==="number" ? seed : Math.floor(Math.random()*1e9))

    const hero = state.hero
    const board = state.board
    const enemiesArr = Object.values(board.enemies).filter((e:any)=> e.hpState!=="dead")
    const logs: string[] = []
    const updates: Record<string, any> = {}

    const d20 = (fn:()=>number)=> Math.floor(fn()*20)+1
    const heroSkill = (id:string)=> (hero.skills?.[id] ?? 0) as number
    const enemyDefenseDC = (e:any)=> e.defenseDC
    const enemyAttackDC = (e:any)=> e.attackDC
    const rankBaseDamage = (r:string)=> r==="weak"?[1,2]: r==="medium"?[1,3]: r==="strong"?[2,4]: [3,5]
    const damageCorrection = (dc:number,total:number)=> { const M=dc-total; return (M>=10)?3:(M>=5)?1:0 } - 0 //  +0 for clarity

    // Player action
    if (action?.kind && action.kind !== "none" && action.targetId){
      const target:any = enemiesArr.find((e:any)=> e.id===action.targetId)
      if (target){
        let dc = enemyDefenseDC(target)
        const roll = d20(rng)
        const luck = hero.luck ?? 0
        const fatigue = hero.fatigue ?? 0
        let skill = 0
        if (action.kind==="melee") skill = heroSkill("combat")
        if (action.kind==="shoot") skill = heroSkill("focus")
        if (action.kind==="magic") skill = heroSkill("arcana")
        if (action.kind==="throw") skill = heroSkill("athletics")
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

    // Enemies turn (сильно упрощено для универсальности)
    const armorDR = (hero.armorId==="light"?1: hero.armorId==="medium"?2: hero.armorId==="heavy"?3:0)
    const shieldDR = (hero.shieldId==="light"?1: hero.shieldId==="medium"?2: hero.shieldId==="heavy"?3:0)
    let heroHp = hero.hp

    for (const e:any of enemiesArr){
      if (updates[e.id]?.hpState === "dead" || e.hpState==="dead") continue
      const dc = enemyAttackDC(e)
      const roll = d20(rng)
      const defSkill = heroSkill("defense")
      const luck = hero.luck ?? 0
      const fatigue = hero.fatigue ?? 0
      const total = roll + defSkill + luck - (fatigue||0)
      if (roll===20){ logs.push(`Защита: d20=20 → КРИТ-успех, контратака разрешена.`); continue }
      if (total >= dc){ logs.push(`Защита: ${total} vs DC ${dc} → УСПЕХ, урон 0.`); continue }
      const [minB, maxB] = rankBaseDamage(e.rank)
      const base = Math.floor(minB + (maxB-minB+1)*rng())
      const corr = (dc - total >= 10) ? 3 : (dc - total >= 5) ? 1 : 0
      let damage = base + corr
      if (roll===1){ damage *= 2; logs.push(`Крит-провал защиты: урон ×2.`) }
      const afterDR = Math.max(0, damage - armorDR - shieldDR)
      heroHp = Math.max(0, heroHp - afterDR)
      logs.push(`Враг ${e.name} попадает: d20=${roll} + Defense(${defSkill}) = ${total} vs DC ${dc} → Урон ${afterDR} (${base}${corr?`+${corr}`:""} − DR${armorDR+shieldDR}). HP: ${heroHp}.`)
    }

    const allDead = Object.values(board.enemies).every((e:any)=> (updates[e.id]?.hpState ?? e.hpState) === "dead")
    const payload = { to_player: logs.join("\n"), battle: { enemies: updates, hero: { hp: heroHp }, log: logs }, end: allDead || heroHp<=0 }
    res.status(200).json(payload)
  }catch(e:any){
    res.status(500).json({ error: "combat engine failure", detail: String(e?.message || String(e)) })
  }
}
