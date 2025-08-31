
export type SkillName =
  | 'Боевая подготовка' | 'Защита' | 'Тактика' | 'Выносливость' | 'Физическая подготовка' | 'Акробатика' | 'Ремесло'
  | 'Скрытность' | 'Поиск' | 'Выживание' | 'Ловкость рук' | 'Манипуляция и Торговля' | 'Интуиция' | 'Выступление'
  | 'Магия' | 'Магическое чутьё' | 'Концентрация' | 'Наука' | 'История' | 'Природа' | 'Медицина'

export type Skills = Partial<Record<SkillName, number>>
export type Race = 'Человек' | 'Эльф' | 'Дворф' | 'Орк' | 'Полурослик' | 'Полуэльф' | 'Полуорк' | 'Тёмный эльф'

export type Character = {
  name: string
  race: Race
  class: string
  gender: 'Мужчина'|'Женщина'|'Другое'
  hp: number
  luck: number
  fatigue: number
  freePoints: number
  skills: Skills
  tempBuffs?: Partial<Record<SkillName, number>>
  perks: string[]
  perkMaster: SkillName | null
  perkSpecial: SkillName | null
  __meta?: { prevGender?: 'Мужчина'|'Женщина'|'Другое'; raceGrantApplied?: number }
}

export type RollRequest = { skill: SkillName | string; dc: number; luck: number; fatigue: number; inventiveness: number; mode: 'Бой'|'Сюжет' }
export type RollResolution = { d20: number; total: number; success: boolean; detail: { luckUsed:number; fatiguePenalty:number; inventiveness:number; masteryBonus:number; skillLevel:number; skillName:string; dc:number } }
