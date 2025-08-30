import type { SkillId } from "./skills";

export interface HpInputs {
  base: number; // default 10
  masteryBySkill: Record<SkillId, number>; // mastery bonuses for skills
}

export function computeHP({ base, masteryBySkill }: HpInputs): number {
  const get = (k: SkillId) => masteryBySkill[k] || 0;
  return base + get("Endurance") + get("Medicine") + get("Athletics");
}
