
import type { Character, SkillName } from './types'

export const genderBonuses: Record<string, Record<SkillName, number>> = {
  'Мужчина': {'Выносливость':2, 'Физическая подготовка':2, 'Тактика':2, 'Ловкость рук':2} as any,
  'Женщина': {'Медицина':2, 'Интуиция':2, 'Акробатика':2, 'Магическое чутьё':2} as any,
  'Другое': {'Защита':2, 'Поиск':2, 'Наука':2, 'Выступление':2} as any,
}

export function applyGenderChange(char: Character, newGender: Character['gender']): Character {
  const c: Character = { ...char, skills: { ...char.skills }, __meta: { ...(char.__meta||{}) } }
  const prev = c.__meta?.prevGender
  if(prev && prev!==newGender){
    const back = genderBonuses[prev] || {}
    Object.entries(back).forEach(([sk,v])=>{
      c.skills[sk as SkillName] = Math.max(0, (c.skills[sk as SkillName]||0) - (v as number))
    })
  }
  const add = genderBonuses[newGender] || {}
  Object.entries(add).forEach(([sk,v])=>{
    const cap = 20
    const cur = c.skills[sk as SkillName] || 0
    let next = cur + (v as number)
    if(next > cap){
      c.freePoints += (next - cap)
      next = cap
    }
    c.skills[sk as SkillName] = next
  })
  c.__meta = { ...(c.__meta||{}), prevGender: newGender }
  c.gender = newGender
  return c
}
