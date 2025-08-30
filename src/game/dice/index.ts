// src/game/dice/index.ts

export { default as D20RollLauncher } from "./D20RollLauncher";
export { D20RollLauncher as NamedD20RollLauncher } from "./D20RollLauncher"; // на случай, если где-то нужен именно именованный

export { D20Overlay } from "./D20Overlay";
export { resolveRoll } from "./D20RollService";

// проброс всех именованных экспорта из файлов (не мешает)
export * from "./D20RollLauncher";
export * from "./D20Overlay";
export * from "./D20RollService";

// типы наружу
export type { RollRequest, RollResolution, CharacterState } from "../state/types";

// опционально — пути к ассетам
export const D20_ASSET_PATHS = {
  spinFrames: [
    "/assets/d20/spin_1.png",
    "/assets/d20/spin_2.png",
    "/assets/d20/spin_3.png",
    "/assets/d20/spin_4.png",
  ],
  resultDefault: "/assets/d20/result_default.png",
  resultSpecial: "/assets/d20/result_special.png",
};
