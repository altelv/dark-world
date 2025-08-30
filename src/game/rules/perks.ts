import type { SkillId } from "./skills";

export type PerkType = "Master" | "Specialist";

export interface Perk {
  type: PerkType;
  skill: SkillId; // must be different across perks
}

export function perkFlatBonus(perk: Perk): number {
  return perk.type === "Master" ? 6 : 3; // flat to check, not to level
}

export function perksFlatBonus(perks: Perk[], skill: SkillId): number {
  // Perks cannot stack on same skill (rule): if both target same skill – only the strongest applies (Master wins). Enforce.
  const relevant = perks.filter(p => p.skill === skill);
  if (relevant.length === 0) return 0;
  const hasMaster = relevant.some(p => p.type === "Master");
  return hasMaster ? 6 : 3;
}

export function perksValid(perks: Perk[]): boolean {
  const seen = new Set<string>();
  for (const p of perks) {
    const k = p.skill;
    if (seen.has(k)) return false; // same skill targeted twice
    seen.add(k);
  }
  return true;
}
