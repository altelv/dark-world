import type { Gender } from "../rules/gender";
import type { Race } from "../rules/race";
import type { SkillId } from "../rules/skills";
import type { Perk } from "../rules/perks";

export interface SkillState {
  level: number;          // allocated 0..20 (no progression in-game)
  levelBuff?: number;     // temporary +levels (items/potions/spells)
}

export type SkillsMap = Partial<Record<SkillId, SkillState>>;

export interface CharacterState {
  name: string;
  race: Race;
  className: string;
  gender: Gender;
  age: number;
  perks: Perk[]; // must be distinct skills
  weakness?: string;
  background?: string;
  hpBase: number; // default 10
  hpCurrent: number;
  fatigue: number; // 0..20
  luck: number;    // 0..20
  skills: SkillsMap;
}

export interface RollRequest {
  skill: SkillId;
  dc: number;
  ingenuity: number; // 0..4
  situational?: number; // GM situational mod, can be negative/positive
}

export type CritFlag = "none" | "critSuccess" | "critFail";

export interface RollResolution {
  requestId: string;
  d20Raw: number;
  total: number;
  dc: number;
  success: boolean;
  crit: CritFlag;
}
