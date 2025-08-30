import type { CharacterState } from "../state/types";

export const seedCharacter: CharacterState = {
  name: "Аран Сэйр", race: "Human", className: "Следопыт", gender: "Male", age: 27,
  perks: [ { type: "Master", skill: "Stealth" }, { type: "Specialist", skill: "Awareness" } ],
  weakness: "Хрупкое эго", background: "Суровые северные границы",
  hpBase: 10, hpCurrent: 17, fatigue: 0, luck: 0,
  skills: {
    "Stealth": { level: 9 },
    "Awareness": { level: 8 },
    "Survival": { level: 6 },
    "Athletics": { level: 6 },
    "Endurance": { level: 5 },
    "Medicine": { level: 3 },
    "Sleight of Hand": { level: 4 },
    "History": { level: 2 },
  }
};
