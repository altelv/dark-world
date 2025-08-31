import React, { useMemo, useState } from 'react'
import type { Character } from '@/game/state/types'
import { genderBonuses } from '@/game/state/gender'
import { classPresets } from '@/game/state/classPresets'
import { masteryBonus } from '@/game/state/rules'
import { allSkills } from '@/game/state/skills'

type Props = { character: Character, onChange:(c:Character)=>void, mode:'Бой'|'Сюжет' }

export function LeftPanelCharacter({ character, onChange }: Props){
  const [freePoints, setFreePoints] = useState(0)

  function applyClass(name:string){
    const preset = classPresets[name]
    if(!preset) return
    const base = {...character}
    base.class = name
    base.skills = {...base.skills}
    Object.keys(base.skills).forEach(k => base.skills[k]=0)
    for(const k in preset){ base.skills[k] = preset[k] }
    onChange(base)
  }
  function addPoint(skill:string){
    if(freePoints<=0) return
    const c = {...character, skills: {...character.skills}}
    c.skills[skill] = Math.min(20, (c.skills[skill]||0)+1)
    setFreePoints(p=>p-1)
    onChange(c)
  }

  const pollinationsPrompt = useMemo(()=>{
    const list = Object.entries(character.skills).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k).join(', ')
    return `Create a Pixel art Dark fantasy character. cinematic composition. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Character: ${character.race}, ${character.class}, ${character.gender}, perks: ${character.perks.join('; ')}, top skills: ${list}`
  }, [character])

  return (
    <div className="left-section">
      <div className="avatar">
        {/* Можно заменить на реальный рендер Pollinations */}
        Автарка генерится Pollinations<br/> 
        <span className="small">prompt:</span><br/>
        <span style={{color:'#a88be0'}}>{pollinationsPrompt.slice(0,120)}...</span>
      </div>

      <div>
        <div className="row">
          <div className="tag">Имя: <b>{character.name}</b></div>
          <div className="tag">Пол: <b>{character.gender}</b></div>
          <div className="tag">Раса: <b>{character.race}</b></div>
          <div className="tag">Класс: <b>{character.class}</b></div>
        </div>
        <div className="row" style={{marginTop:6}}>
          <div className="tag">HP: <b>{character.hp}</b></div>
          <div className="tag">Удача: <b>{character.luck}/20</b></div>
          <div className="tag">Усталость: <b>{character.fatigue}/20</b></div>
          <div className="tag">Своб. очки навыков: <b>{freePoints}</b></div>
        </div>
      </div>

      <div>
        <div className="row" style={{marginBottom:8}}>
          <select onChange={e=>applyClass(e.target.value)} defaultValue="">
            <option value="" disabled>Выбрать архетип (раздаёт 36 очков)</option>
            {Object.keys(classPresets).map(k=> <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="btn" onClick={()=>setFreePoints(p=>p+1)}>+1 очко</button>
        </div>

        <div className="skills-list" style={{marginBottom:6, fontSize:12, opacity:.8}}>
          <div>Навык</div><div>Уровень</div><div></div><div>Бонус</div>
        </div>
        <div style={{maxHeight: 340, overflow:'auto', border:'1px solid #2a2236', borderRadius:8}}>
          {allSkills.map(sk=>{
            const lvl = character.skills[sk] || 0
            const bonus = masteryBonus(lvl)
            const buffed = character.tempBuffs?.[sk] && character.tempBuffs[sk]!>0
            return (
              <div key={sk} className="skills-list skill-row">
                <div className={"skill-name "+(buffed?'gold':'')}>{sk}</div>
                <div>{lvl}</div>
                <button className="skill-plus" disabled={freePoints<=0} onClick={()=>addPoint(sk)}>+</button>
                <div className="skill-bonus">{bonus>=0?`+${bonus}`:bonus}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div className="row"><div className="tag">Перк Мастер: <b>{character.perkMaster||'нет'}</b></div><div className="tag">Перк Спец: <b>{character.perkSpecial||'нет'}</b></div></div>
        <div className="row" style={{marginTop:6}}>
          <div className="tag">Лицензии: <b>{character.perks.join(', ')||'—'}</b></div>
        </div>
      </div>
    </div>
  )
}
