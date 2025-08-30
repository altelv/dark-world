import type { SkillId } from "./skills";

export type Gender = "Male" | "Female" | "Other";

// Balanced +2 to four skills each (editable design placeholder)
export const GENDER_BONUSES: Record<Gender, Partial<Record<SkillId, number>>> = {
  Male: {
    Endurance: 2,
    Athletics: 2,
    Tactics: 2,
    Defense: 2,
  },
  Female: {
    Medicine: 2,
    Insight: 2,
    Performance: 2,
    Focus: 2,
  },
  Other: {
    // neutral spread (player can pick any four +2 via character creation UI)
  },
};
