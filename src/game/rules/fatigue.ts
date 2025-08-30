// Fatigue 0..20. Each point is −1 to total roll. Accrual and reduction rules below.

export interface FatigueAccrualCtx {
  baseGain: number; // +1, +2 etc (from march, fight, cold, etc.)
  enduranceMasteryBonus: number; // +0..+8 influences percent reduction
}

export function applyFatigueAccrual({ baseGain, enduranceMasteryBonus }: FatigueAccrualCtx): number {
  const reduction = Math.min(0.50, 0.06 * enduranceMasteryBonus); // up to 50%
  const gained = Math.ceil(baseGain * (1 - reduction));
  return Math.max(0, gained);
}

export interface NonBedSleepCtx {
  currentFatigue: number;
  survivalMasteryBonus: number; // increases percent and minimum
}

export function reduceFatigueNonBed({ currentFatigue, survivalMasteryBonus }: NonBedSleepCtx): number {
  const percent = 0.35 + 0.02 * survivalMasteryBonus; // base 35% +
  const minFloor = 3 + Math.floor(survivalMasteryBonus / 3);
  const reduced = Math.max(minFloor, Math.floor(currentFatigue * percent));
  return Math.min(currentFatigue, reduced);
}

export function reduceFatigueBed(currentFatigue: number): number { return currentFatigue; } // full reset handled by caller
