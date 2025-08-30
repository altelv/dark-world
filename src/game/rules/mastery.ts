// Mastery bonus by *effective level* rules:
// 0 -> +0; 1–4 -> +2; 5–8 -> +3; 9–12 -> +4; 13–16 -> +5; 17–19 -> +6; 20 -> +7; if effective >=25 -> +8
export function masteryBonus(effectiveLevel: number): number {
  if (effectiveLevel <= 0) return 0;
  if (effectiveLevel <= 4) return 2;
  if (effectiveLevel <= 8) return 3;
  if (effectiveLevel <= 12) return 4;
  if (effectiveLevel <= 16) return 5;
  if (effectiveLevel <= 19) return 6;
  if (effectiveLevel >= 25) return 8; // buffs/items up to 25 -> +8
  return 7; // level 20–24
}

export interface MasteryInputs {
  baseLevel: number; // allocated 0..20
  levelBuff: number; // temporary +levels from items/potions/spells (NOT perks)
}

export function effectiveLevel({ baseLevel, levelBuff }: MasteryInputs): number {
  return Math.max(0, baseLevel + (levelBuff || 0));
}
