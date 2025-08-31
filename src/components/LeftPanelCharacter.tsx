
import React, { useEffect, useMemo } from 'react'
import type { Character, SkillName } from '../game/state/types'
import { allSkills } from '../game/state/skills'
import { masteryBonus, effectiveLevel, skillCapFor } from '../game/state/rules'
import { applyGenderChange } from '../game/state/gender'
import { raceCapMap, applyRaceChange } from '../game/state/races'

type Props = { character: Character, onChange:(c:Character)=>void }

export function LeftPanelCharacter({ character, onChange }: Props){
  useEffect(()=>{
    if(character.perkMaster && character.perkSpecial && character.perkMaster===character.perkSpecial){
      const c = { ...character, perkSpecial: null }
      onChange(c)
    }
  }, [character.perkMaster, character.perkSpecial])

  function setField<K extends keyof Character>(k:K, v:Character[K]){ onChange({ ...character, [k]: v }) }
  function onSetGender(newGender: Character['gender']){ onChange(applyGenderChange(character, newGender)) }
  function onSetRace(newRace: Character['race']){ onChange(applyRaceChange(character, newRace)) }

  function onAddPoint(skill: SkillName){
    const cap = skillCapFor(character, skill)
    if(character.freePoints<=0) return
    const base = character.skills[skill] || 0
    if(base >= cap) return
    const c = { ...character, skills: { ...character.skills } }
    c.skills[skill] = base + 1
    c.freePoints -= 1
    onChange(c)
  }

  function onChangePerkMaster(skillName: string){
    const s = (skillName||'') as SkillName
    if(character.perkSpecial===s) return
    const c = { ...character, perkMaster: s || null }
    if(s){
      const e = effectiveLevel(c, s)
      if(e>25){
        const needDrop = e-25, raw=(c.skills[s]||0), drop=Math.min(raw, needDrop)
        c.skills = { ...c.skills, [s]: raw - drop }; c.freePoints += drop
      }
    }
    onChange(c)
  }
  function onChangePerkSpecial(skillName: string){
    const s = (skillName||'') as SkillName
    if(character.perkMaster===s) return
    const c = { ...character, perkSpecial: s || null }
    if(s){
      const e = effectiveLevel(c, s)
      if(e>25){
        const needDrop = e-25, raw=(c.skills[s]||0), drop=Math.min(raw, needDrop)
        c.skills = { ...c.skills, [s]: raw - drop }; c.freePoints += drop
      }
    }
    onChange(c)
  }

  const pollinationsPrompt = useMemo(()=>{
    const top = Object.entries(character.skills).sort((a,b)=>(b[1]||0)-(a[1]||0)).slice(0,3).map(([k])=>k).join(', ')
    return `Create a Pixel art Dark fantasy character. cinematic composition. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Character: ${character.race}, ${character.class}, ${character.gender}, perks: master=${character.perkMaster||'-'}, specialist=${character.perkSpecial||'-'}; top skills: ${top}`
  }, [character])

  return (
    <div className="left-section">
      <div className="avatar">
        Автарка генерится Pollinations<br/><span className="small">prompt:</span><br/>
        <span style={{color:'#a88be0'}}>{pollinationsPrompt.slice(0,120)}...</span>
      </div>

      <div>
        <div className="row">
          <div className="tag">Имя:&nbsp;<b>{character.name}</b></div>
          <div className="tag">
            Пол:&nbsp;
            <select value={character.gender} onChange={e=>onSetGender(e.target.value as any)}>
              <option>Мужчина</option><option>Женщина</option><option>Другое</option>
            </select>
          </div>
          <div className="tag">
            Раса:&nbsp;
            <select value={character.race} onChange={e=>onSetRace(e.target.value as any)}>
              {Object.keys(raceCapMap).map(r=> <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="tag">
            Класс:&nbsp;
            <select value={character.class} onChange={e=>setField('class', e.target.value)}>
              <option>Без класса</option>
              <option>Воин</option><option>Разбойник</option><option>Следопыт</option>
              <option>Маг</option><option>Жрец</option><option>Бард</option>
              <option>Алхимик</option><option>Паладин</option><option>Некромант</option>
              <option>Монах</option><option>Наёмник</option><option>Охотник на монстров</option>
            </select>
          </div>
        </div>
        <div className="row" style={{marginTop:6}}>
          <div className="tag">HP: <b>{character.hp}</b></div>
          <div className="tag">Удача: <b>{character.luck}/20</b></div>
          <div className="tag">Усталость: <b>{character.fatigue}/20</b></div>
          <div className="tag">Своб. очки навыков: <b>{character.freePoints}</b></div>
        </div>
      </div>

      <div>
        <div className="row" style={{marginBottom:8}}>
          <div className="tag">Перк «Мастер +6»:&nbsp;
            <select value={character.perkMaster||''} onChange={e=>onChangePerkMaster(e.target.value)}>
              <option value="">нет</option>
              {allSkills.map(s=> <option key={s} value={s} disabled={character.perkSpecial===s}>{s}</option>)}
            </select>
          </div>
          <div className="tag">Перк «Специалист +3»:&nbsp;
            <select value={character.perkSpecial||''} onChange={e=>onChangePerkSpecial(e.target.value)}>
              <option value="">нет</option>
              {allSkills.map(s=> <option key={s} value={s} disabled={character.perkMaster===s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="skills-grid" style={{marginBottom:6,fontSize:12,opacity:.8}}>
          <div>Навык</div><div>Уровень/Кэп</div><div></div><div>Бонус</div>
        </div>
        <div style={{border:'1px solid var(--stroke)', borderRadius:8}}>
          {allSkills.map(sk=>{
            const raw = character.skills[sk] || 0
            const cap = skillCapFor(character, sk)
            const eff = effectiveLevel(character, sk)
            const bonus = masteryBonus(eff)
            const buffed = false
            return (
              <div key={sk} className="skills-grid skill-row">
                <div className={"skill-name "+(buffed?'gold':'')}>{sk}</div>
                <div>{raw}/{cap}</div>
                <button className="skill-plus" disabled={character.freePoints<=0 || raw>=cap} onClick={()=>onAddPoint(sk)}>+</button>
                <div className="skill-bonus">{bonus>=0?`+${bonus}`:bonus}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="row">
        <div className="tag">Лицензии: <b>{character.perks.join(', ')||'—'}</b></div>
      </div>
    </div>
  )
}
