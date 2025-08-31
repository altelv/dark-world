import type { Character, RollRequest, RollResolution } from './types'

// ladder: 1–4 +2; 5–8 +3; 9–12 +4; 13–16 +5; 17–19 +6; 20 +7; 21–24 +7; 25+ +8
export function masteryBonus(level:number): number {
  if (level >= 25) return 8
  if (level >= 20) return 7
  if (level >= 17) return 6
  if (level >= 13) return 5
  if (level >= 9) return 4
  if (level >= 5) return 3
  if (level >= 1) return 2
  return 0
}

export function computeRollResolution(char:Character, req:RollRequest, d20:number): RollResolution {
  const lvl = (char.skills as any)[req.skill] || 0
  const mastery = masteryBonus(lvl)
  // Лаки: добавляется к «чистому» d20, затем может обнулиться
  let luckApplied = Math.min(req.luck, Math.max(0, 20 - d20))
  const base = d20 + luckApplied
  const fatiguePenalty = Math.min(20, req.fatigue) // 1 к 1
  const total = base + mastery + req.inventiveness - fatiguePenalty
  const success = (d20 === 20) || (d20 !== 1 && total >= req.dc)
  return {
    d20,
    total,
    success,
    detail: {
      luckUsed: luckApplied,
      fatiguePenalty,
      inventiveness: req.inventiveness,
      masteryBonus: mastery,
      skillLevel: lvl,
      skillName: String(req.skill),
      dc: req.dc
    }
  }
}

export function formatRollBreakdown(r:RollResolution): string {
  const d = r.detail
  const parts = [
    `d20=${r.d20}`,
    d.luckUsed?`+ удача ${d.luckUsed}`:null,
    d.masteryBonus?`+ мастерство ${signed(d.masteryBonus)}`:null,
    d.inventiveness?`+ изобретательность ${signed(d.inventiveness)}`:null,
    d.fatiguePenalty?`− усталость ${d.fatiguePenalty}`:null,
    `vs DC ${d.dc}`
  ].filter(Boolean)
  return `Проверка «${d.skillName}»: ${parts.join(' ')} → итог ${r.total}`
}
const signed = (n:number)=> (n>=0?`+${n}`:`${n}`)
