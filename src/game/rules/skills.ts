export type SkillId =
  | "Combat Training" | "Defense" | "Tactics" | "Endurance" | "Athletics" | "Acrobatics" | "Crafting"
  | "Stealth" | "Awareness" | "Survival" | "Sleight of Hand" | "Deception & Trade" | "Insight" | "Performance"
  | "Arcana" | "Magical Sense" | "Focus" | "Science" | "History" | "Nature" | "Medicine";

export type SkillGroup = "Warrior" | "Adventurer & Social" | "Scholar & Mystic";

export interface SkillMeta {
  id: SkillId;
  key: string; // safe key
  group: SkillGroup;
}

export const SKILLS: SkillMeta[] = [
  { id: "Combat Training", key: "combatTraining", group: "Warrior" },
  { id: "Defense", key: "defense", group: "Warrior" },
  { id: "Tactics", key: "tactics", group: "Warrior" },
  { id: "Endurance", key: "endurance", group: "Warrior" },
  { id: "Athletics", key: "athletics", group: "Warrior" },
  { id: "Acrobatics", key: "acrobatics", group: "Warrior" },
  { id: "Crafting", key: "crafting", group: "Warrior" },

  { id: "Stealth", key: "stealth", group: "Adventurer & Social" },
  { id: "Awareness", key: "awareness", group: "Adventurer & Social" },
  { id: "Survival", key: "survival", group: "Adventurer & Social" },
  { id: "Sleight of Hand", key: "sleightOfHand", group: "Adventurer & Social" },
  { id: "Deception & Trade", key: "deceptionTrade", group: "Adventurer & Social" },
  { id: "Insight", key: "insight", group: "Adventurer & Social" },
  { id: "Performance", key: "performance", group: "Adventurer & Social" },

  { id: "Arcana", key: "arcana", group: "Scholar & Mystic" },
  { id: "Magical Sense", key: "magicalSense", group: "Scholar & Mystic" },
  { id: "Focus", key: "focus", group: "Scholar & Mystic" },
  { id: "Science", key: "science", group: "Scholar & Mystic" },
  { id: "History", key: "history", group: "Scholar & Mystic" },
  { id: "Nature", key: "nature", group: "Scholar & Mystic" },
  { id: "Medicine", key: "medicine", group: "Scholar & Mystic" },
];

export const SKILL_KEYS = SKILLS.map(s => s.key);
export type SkillKey = typeof SKILL_KEYS[number];

export const SkillByKey: Record<SkillKey, SkillId> = SKILLS.reduce((acc, s) => {
  acc[s.key as SkillKey] = s.id; return acc;
}, {} as Record<SkillKey, SkillId>);

export const SkillGroupMap: Record<SkillId, SkillGroup> = SKILLS.reduce((acc, s) => {
  acc[s.id] = s.group; return acc;
}, {} as Record<SkillId, SkillGroup>);
