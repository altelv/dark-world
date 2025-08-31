import React from 'react';
import { ALL_SKILLS } from '../game/state/skills';
import type { Character, SkillId, PerkMaster, PerkSpecialist, PerkLicense } from '../game/state/types';
import { applyRaceCapsAndBank } from '../game/state/races';
import { applySexBonuses } from '../game/state/gender';
import { proficiencyBonus, effectiveLevel } from '../game/state/rules';

export function LeftPanelCharacter({ character, onChange }:{ character: Character; onChange:(c:Character)=>void }){
  function set<K extends keyof Character>(k: K, v: Character[K]){ onChange({ ...character, [k]:v } as Character); }
  function setRace(r: Character['race']){ let base={...character, race:r} as Character; base=applyRaceCapsAndBank(base); base=applySexBonuses(base); onChange(base); }
  function setSex(s: Character['sex']){ let base={...character, sex:s} as Character; base=applyRaceCapsAndBank(base); base=applySexBonuses(base); onChange(base); }
  function addPoint(id: SkillId){ if(character.bank<=0) return; const cap=character.caps[id]; const raw=character.skills[id]; if(raw>=cap) return;
    const next={...character, skills:{...character.skills}, bank: character.bank-1}; next.skills[id]=raw+1; onChange(next); }
  function pickLicense(p: PerkLicense | null){ onChange({ ...character, perks:{...character.perks, license:p} }); }
  function pickMaster(id: SkillId | null){ onChange({ ...character, perks:{...character.perks, master: id? {kind:'Мастер', skill:id} as PerkMaster : null} }); }
  function pickSpecialist(id: SkillId | null){
    if (id && character.perks.master?.skill===id) return;
    onChange({ ...character, perks:{...character.perks, specialist: id? {kind:'Специалист', skill:id} as PerkSpecialist : null} });
  }
  const licenseList: PerkLicense[] = ['Маг огня','Маг холода','Маг крови','Тень','Лучник','Мечник'];
  return (
    <div className="h-full flex flex-col gap-2 p-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">Персонаж</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <input className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" placeholder="Имя"
               value={character.name} onChange={e=>set('name', e.target.value)} />
        <input className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" placeholder="Класс"
               value={character.class} onChange={e=>set('class', e.target.value)} />
        <select className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" value={character.race} onChange={e=>setRace(e.target.value as any)}>
          {['Человек','Эльф','Дворф','Орк','Полурослик','Полуэльф','Полуорк','Тёмный эльф'].map(r=><option key={r} value={r}>{r}</option>)}
        </select>
        <select className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" value={character.sex} onChange={e=>setSex(e.target.value as any)}>
          {['Мужчина','Женщина','Не указан'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" placeholder="Возраст"
               value={character.age} onChange={e=>set('age', Number(e.target.value||0))} />
        <div className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60">Очки: <b>{character.bank}</b></div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
        <select className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" value={character.perks.license || ''} onChange={e=>pickLicense((e.target.value||null) as any)}>
          <option value="">Лицензия (маг/тень/лучник…)</option>
          {licenseList.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60" value={character.perks.master?.skill || ''} onChange={e=>pickMaster((e.target.value||'') as any)}>
          <option value="">Мастер +6 (поверх кэпа)</option>
          {ALL_SKILLS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="px-2 py-1.5 rounded bg-zinc-900/70 border border-zinc-800/60 col-span-2 md:col-span-1" value={character.perks.specialist?.skill || ''} onChange={e=>pickSpecialist((e.target.value||'') as any)}>
          <option value="">Специалист +3 (поверх кэпа)</option>
          {ALL_SKILLS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="mt-2 text-xs uppercase tracking-wide text-zinc-500">Навыки</div>
      <div className="border border-zinc-800/60 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 p-2 bg-zinc-900/40 text-[12px]">
          <div>Навык</div><div>Ур./кэп</div><div></div><div>Бонус</div>
        </div>
        <div className="max-h-[46vh] overflow-auto">
          {ALL_SKILLS.map(s=>{
            const raw = character.skills[s.id]; const cap = character.caps[s.id];
            const eff = effectiveLevel(character, s.id); const prof = proficiencyBonus(eff);
            const boosted = eff > raw;
            return (
              <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-2 py-1.5 border-t border-zinc-800/40 text-sm">
                <div className="truncate">{s.name}</div>
                <div className={`text-right tabular-nums ${boosted?'text-yellow-300':''}`}>{raw}/{cap}</div>
                <button className="px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/40 text-xs disabled:opacity-40" onClick={()=>addPoint(s.id)} disabled={character.bank<=0 || raw>=cap}>+</button>
                <div className="text-center px-2 py-0.5 rounded border border-zinc-800/60">{prof>=0?`+${prof}`:prof}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
