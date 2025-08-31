
import type { Character, Race, SkillName } from './types'

export const raceCapMap: Record<Race, SkillName[]> = {
  'Человек': [],
  'Эльф': ['Акробатика','Магическое чутьё'],
  'Дворф': ['Ремесло','Поиск'],
  'Орк': ['Боевая подготовка','Выносливость'],
  'Полурослик': ['Скрытность','Ловкость рук'],
  'Полуэльф': ['Интуиция','Выступление'],
  'Полуорк': ['Физическая подготовка','Защита'],
  'Тёмный эльф': ['Скрытность','Магия'],
}

export function raceBankGrant(race: Race): number { return race==='Человек' ? 10 : 5 }

export function applyRaceChange(char: Character, newRace: Race): Character {
  const c: Character = { ...char, race: newRace, skills: { ...char.skills }, __meta: { ...(char.__meta||{}) } }
  const prevGrant = c.__meta?.raceGrantApplied || 0
  const nextGrant = raceBankGrant(newRace)
  c.freePoints = (c.freePoints || 0) - prevGrant + nextGrant
  c.__meta = { ...(c.__meta||{}), raceGrantApplied: nextGrant }
  return c
}
