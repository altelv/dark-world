import type { Character, SkillId } from './types';
export function proficiencyBonus(effective: number): number {
  if (effective >= 25) return +8;
  if (effective >= 20) return +7;
  if (effective >= 17) return +6;
  if (effective >= 13) return +5;
  if (effective >= 9) return +4;
  if (effective >= 5) return +3;
  return +2;
}
export function effectiveLevel(ch: Character, skill: SkillId): number {
  const raw = ch.skills[skill];
  const master = ch.perks.master?.skill === skill ? 6 : 0;
  const specialist = (ch.perks.specialist?.skill === skill && ch.perks.master?.skill !== skill) ? 3 : 0;
  return raw + master + specialist;
}
export function skillBonus(ch: Character, skill: SkillId): number {
  return proficiencyBonus(effectiveLevel(ch, skill));
}
export function computeD20Total(
  baseD20: number,
  opts: { skillBonus?: number; inventiveness?: number; luck?: number; fatigue?: number }
): number {
  const { skillBonus=0, inventiveness=0, luck=0, fatigue=0 } = opts;
  return baseD20 + skillBonus + luck - fatigue + inventiveness;
}
