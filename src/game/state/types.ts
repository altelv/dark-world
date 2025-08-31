export type SkillName =
  | 'Боевая подготовка' | 'Защита' | 'Тактика' | 'Выносливость' | 'Физическая подготовка' | 'Акробатика' | 'Ремесло'
  | 'Скрытность' | 'Поиск' | 'Выживание' | 'Ловкость рук' | 'Манипуляция и Торговля' | 'Интуиция' | 'Выступление'
  | 'Магия' | 'Магическое чутьё' | 'Концентрация' | 'Наука' | 'История' | 'Природа' | 'Медицина'

export type Skills = Record<SkillName, number>

export type Character = {
  name: string
  race: string
  class: string
  gender: 'Мужчина'|'Женщина'|'Другое'
  hp: number
  luck: number
  fatigue: number
  skills: Partial<Skills>
  tempBuffs?: Partial<Record<SkillName, number>>
  perks: string[]
  perkMaster?: SkillName | null
  perkSpecial?: SkillName | null
}

export type RollRequest = {
  skill: SkillName | string
  dc: number
  luck: number
  fatigue: number
  inventiveness: number
  mode: 'Бой'|'Сюжет'
}

export type RollResolution = {
  d20: number
  total: number
  success: boolean
  detail: {
    luckUsed: number
    fatiguePenalty: number
    inventiveness: number
    masteryBonus: number
    skillLevel: number
    skillName: string
    dc: number
  }
}
