// src/game/dice/index.ts
// Баррель-экспорт для модуля кубика D20.

export { D20Overlay } from "./D20Overlay";
export { D20RollLauncher } from "./D20RollLauncher";
export { resolveRoll } from "./D20RollService";

// Пробрасываем типы наружу
export type { RollRequest, RollResolution, CharacterState } from "../state/types";

// Стандартные пути к ассетам (если хочешь импортировать “готовым пакетом”)
export const D20_ASSET_PATHS = {
  spinFrames: [
    "/assets/d20/spin_1.png",
    "/assets/d20/spin_2.png",
    "/assets/d20/spin_3.png",
    "/assets/d20/spin_4.png"
  ],
  resultDefault: "/assets/d20/result_default.png",
  resultSpecial: "/assets/d20/result_special.png"
};
