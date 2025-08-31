import type { Character, Race, SkillId } from './types';
import { ALL_SKILLS } from './skills';

type FavMap = Partial<Record<Race, SkillId[]>>;
const FAV: FavMap = {
  'Эльф': ['acrobatics','msense'],
  'Дворф': ['crafting','awareness'],
  'Орк': ['combat','endurance'],
  'Полурослик': ['stealth','sleight'],
  'Полуэльф': ['insight','performance'],
  'Полуорк': ['athletics','defense'],
  'Тёмный эльф': ['stealth','arcana'],
};

export function applyRaceCapsAndBank(ch: Character): Character {
  const baseCaps = Object.fromEntries(ALL_SKILLS.map(s => [s.id, 20])) as Character['caps'];
  let bankAdd = 0;
  if (ch.race === 'Человек') { bankAdd = 10; }
  else { bankAdd = 5; const fav = FAV[ch.race] ?? []; for (const id of fav) baseCaps[id] = 25 as 25; }
  const next = { ...ch, caps: baseCaps, bank: ch.bank + bankAdd };
  for (const id of Object.keys(next.skills) as SkillId[]) {
    const lvl = next.skills[id]; const cap = next.caps[id];
    if (lvl > cap) { next.bank += (lvl - cap); next.skills[id] = cap; }
  }
  return next;
}
