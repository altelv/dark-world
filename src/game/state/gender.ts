import type { Character, SkillId, Sex } from './types';
const MAP: Record<Sex, Partial<Record<SkillId, number>>> = {
  'Мужчина': { endurance:+2, athletics:+2, tactics:+2, combat:+2 },
  'Женщина': { medicine:+2, insight:+2, performance:+2, msense:+2 },
  'Не указан': { awareness:+2, nature:+2, science:+2, defense:+2 },
};
export function applySexBonuses(ch: Character): Character {
  const b = MAP[ch.sex] ?? {}; let refund = 0;
  const next = { ...ch, skills: { ...ch.skills } };
  (Object.keys(b) as SkillId[]).forEach((id) => {
    const add = b[id]!; const cap = next.caps[id];
    const newLvl = next.skills[id] + add;
    if (newLvl > cap) { refund += (newLvl - cap); next.skills[id] = cap; }
    else { next.skills[id] = newLvl; }
  });
  if (refund) next.bank += refund;
  return next;
}
