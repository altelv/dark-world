import data from '../data/dw_data/CHECKS/hidden_by_skill.json';
import type { Character, RollContext } from '../state/types';
import { proficiencyBonus, effectiveLevel } from '../state/rules';
type Entry = { skill: string; name: string; dc: number; kind: 'combat'|'story'; hint: string };
export function runHiddenChecks(text: string, ch: Character, ctx: RollContext): string {
  const pool = (data as Entry[]).filter(e => (ctx.mode==='Бой'? e.kind==='combat' : e.kind==='story'));
  if (pool.length===0) return text;
  const picks: Entry[] = []; for (let i=0;i<2 && pool.length;i++){ const idx=Math.floor(Math.random()*pool.length); picks.push(pool.splice(idx,1)[0]); }
  let result = text;
  picks.forEach((e)=>{
    const base = Math.floor(Math.random()*20)+1;
    const map: Record<string, any> = {
      'Боевая подготовка':'combat','Защита':'defense','Тактика':'tactics','Выносливость':'endurance',
      'Физическая подготовка':'athletics','Акробатика':'acrobatics','Ремесло':'crafting',
      'Скрытность':'stealth','Поиск':'awareness','Выживание':'survival','Ловкость рук':'sleight',
      'Манипуляция и Торговля':'trade','Интуиция':'insight','Выступление':'performance',
      'Магия':'arcana','Магическое чутьё':'msense','Концентрация':'focus','Наука':'science',
      'История':'history','Природа':'nature','Медицина':'medicine',
    };
    const id = map[e.skill]; const bonus = id ? proficiencyBonus(effectiveLevel(ch, id)) : 0;
    const total = base + bonus;
    if (total >= e.dc || base===20) {
      const tag = `${e.name} — успех!`;
      result = `${tag}
` + result.replace(e.hint, `==${e.hint}==`);
    }
  });
  return result;
}
