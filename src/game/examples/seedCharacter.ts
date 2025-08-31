import { ALL_SKILLS } from '../state/skills';
import type { Character } from '../state/types';
export function seedCharacter(): Character {
  const skills = Object.fromEntries(ALL_SKILLS.map(s => [s.id, 0])) as any;
  return {
    name:'', race:'Человек', class:'', sex:'Не указан', age:22,
    hp: 10, luck: 0, fatigue: 0, bank: 36,
    skills, caps: Object.fromEntries(ALL_SKILLS.map(s=>[s.id, 20])) as any,
    perks: { license: null, master: null, specialist: null, weakness: null, background: null },
  };
}
