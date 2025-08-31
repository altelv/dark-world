import type { Character } from '@/game/state/types'

export function seedCharacter(): Character {
  return {
    name: 'Незримый',
    race: 'Человек',
    class: 'Без класса',
    gender: 'Мужчина',
    hp: 10+4+4+2, // Endurance+Medicine+Athletics (примерные)
    luck: 0,
    fatigue: 0,
    skills: {},
    perks: [],
    perkMaster: null,
    perkSpecial: null,
  }
}
