import type { SkillId } from "./skills";

export type Race = "Human" | "Elf" | "Dwarf" | "Orc" | "Halfling" | "Tiefling" | "Undying";

export const RACE_BONUSES: Record<Race, Partial<Record<SkillId, number>>> = {
  Human: { /* flexible later via UI: e.g., +2 to any three skills */ },
  Elf: { "Stealth": 4, "Magical Sense": 4 },
  Dwarf: { "Crafting": 4, "Awareness": 4 },
  Orc: { "Combat Training": 4, "Endurance": 4 },
  Halfling: { "Sleight of Hand": 4, "Performance": 4 },
  Tiefling: { "Arcana": 4, "Deception & Trade": 4 },
  Undying: { "Focus": 4, "History": 4 },
};
