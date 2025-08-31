
import type { Character, RollRequest, RollResolution, SkillName } from './types'
import { raceCapMap } from './races'

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

export function skillCapFor(char: Character, sk: SkillName): number {
  const raceCaps = raceCapMap[char.race] || []
  const hasRaceCap = raceCaps.includes(sk)
  const hasPerkCap = (char.perkMaster===sk) || (char.perkSpecial===sk)
  return (hasRaceCap || hasPerkCap) ? 25 : 20
}

export function effectiveLevel(char: Character, sk: SkillName): number {
  let raw = (char.skills[sk] || 0)
  let add = 0
  if(char.perkMaster===sk) add += 6
  if(char.perkSpecial===sk) add += 3
  const temp = char.tempBuffs?.[sk] || 0
  const pre = raw + add
  const tempApplied = pre >= 25 ? 0 : Math.min(25 - pre, temp)
  return Math.min(25, raw + add + tempApplied)
}

export function computeRollResolution(char:Character, req:RollRequest, d20:number): RollResolution {
  const sk = (req.skill as SkillName)
  const lvl = (char.skills && (sk in (char.skills as any))) ? effectiveLevel(char, sk) : 0
  const mastery = masteryBonus(lvl)
  let luckApplied = Math.min(req.luck, Math.max(0, 20 - d20))
  const base = d20 + luckApplied
  const fatiguePenalty = Math.min(20, req.fatigue)
  const total = base + mastery + req.inventiveness - fatiguePenalty
  const success = (d20===20) || (d20!==1 && total>=req.dc)
  return {
    d20, total, success,
    detail: { luckUsed: luckApplied, fatiguePenalty, inventiveness: req.inventiveness, masteryBonus: mastery, skillLevel: lvl, skillName: String(req.skill), dc: req.dc }
  }
}

export function formatRollBreakdown(r:RollResolution): string {
  const d = r.detail
  const parts = [
    `d20=${r.d20}`,
    d.luckUsed?`+ удача ${d.luckUsed}`:null,
    d.masteryBonus?`+ мастерство +${d.masteryBonus}`:null,
    d.inventiveness?`+ изобретательность +${d.inventiveness}`:null,
    d.fatiguePenalty?`− усталость ${d.fatiguePenalty}`:null,
    `vs DC ${d.dc}`
  ].filter(Boolean)
  return `Проверка «${d.skillName}»: ${parts.join(' ')} → итог ${r.total}`
}
