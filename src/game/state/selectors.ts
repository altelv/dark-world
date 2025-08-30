import { masteryBonus, effectiveLevel } from "../rules/mastery";
import { perksFlatBonus } from "../rules/perks";
import { RACE_BONUSES } from "../rules/race";
import { GENDER_BONUSES } from "../rules/gender";
import type { CharacterState, RollRequest } from "./types";
import type { SkillId } from "../rules/skills";

export function skillMasteryBonus(char: CharacterState, skill: SkillId): number {
  const s = char.skills[skill];
  const lvl = s?.level || 0;
  const buf = s?.levelBuff || 0;
  const eff = effectiveLevel({ baseLevel: lvl, levelBuff: buf });
  return masteryBonus(eff);
}

export function flatBonuses(char: CharacterState, skill: SkillId): number {
  const raceFlat = (RACE_BONUSES[char.race] || {})[skill] || 0;
  const genderFlat = (GENDER_BONUSES[char.gender] || {})[skill] || 0;
  const perksFlat = perksFlatBonus(char.perks, skill);
  return raceFlat + genderFlat + perksFlat;
}

export function computeRollTotalInputs(char: CharacterState, req: RollRequest) {
  const mastery = skillMasteryBonus(char, req.skill);
  const flat = flatBonuses(char, req.skill);
  const ingenuity = Math.max(0, Math.min(4, req.ingenuity || 0));
  const situational = req.situational || 0;
  const luck = char.luck || 0;
  const fatigue = char.fatigue || 0; // each point = −1
  return { mastery, flat, ingenuity, situational, luck, fatigue };
}

export function computeTheoreticalTotal(char: CharacterState, req: RollRequest, d20Raw: number) {
  const i = computeRollTotalInputs(char, req);
  const total = d20Raw + i.mastery + i.flat + i.ingenuity + i.luck + i.situational - i.fatigue;
  return { total, ...i };
}
