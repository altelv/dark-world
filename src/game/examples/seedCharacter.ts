
import type { Character } from '../state/types'
export function seedCharacter(): Character {
  return {
    name: 'Незримый',
    race: 'Человек',
    class: 'Без класса',
    gender: 'Мужчина',
    hp: 10+4+4+2,
    luck: 0, fatigue: 0,
    freePoints: 36+10,
    skills: {},
    tempBuffs: {},
    perks: [],
    perkMaster: null,
    perkSpecial: null,
    __meta: { prevGender: 'Мужчина', raceGrantApplied: 10 }
  }
}
