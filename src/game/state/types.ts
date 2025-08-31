export type SkillId =
  | 'combat' | 'defense' | 'tactics' | 'endurance' | 'athletics' | 'acrobatics' | 'crafting'
  | 'stealth' | 'awareness' | 'survival' | 'sleight' | 'trade' | 'insight' | 'performance'
  | 'arcana' | 'msense' | 'focus' | 'science' | 'history' | 'nature' | 'medicine';

export type SkillInfo = { id: SkillId; name: string };

export type Sex = 'Мужчина' | 'Женщина' | 'Не указан';
export type Race =
  | 'Человек' | 'Эльф' | 'Дворф' | 'Орк' | 'Полурослик' | 'Полуэльф' | 'Полуорк' | 'Тёмный эльф';

export type PerkLicense =
  | 'Маг огня' | 'Маг холода' | 'Маг крови' | 'Тень' | 'Лучник' | 'Мечник';
export type PerkMaster = { kind:'Мастер'; skill: SkillId };
export type PerkSpecialist = { kind:'Специалист'; skill: SkillId };

export type Perk = PerkLicense | PerkMaster | PerkSpecialist;

export type SkillLevels = Record<SkillId, number>;

export type Character = {
  name: string;
  race: Race;
  class: string;
  sex: Sex;
  age: number;
  hp: number;
  luck: number;
  fatigue: number;
  bank: number;
  skills: SkillLevels;
  caps: Record<SkillId, 20|25>;
  perks: {
    license?: PerkLicense | null;
    master?: PerkMaster | null;
    specialist?: PerkSpecialist | null;
    weakness?: string | null;
    background?: string | null;
  }
};

export type RollContext = { mode: 'Бой'|'Сюжет'; lastRoll: number | null; };
