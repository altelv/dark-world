// src/game/dice/index.ts
// Надёжный баррель для модуля D20. Все экспорты именованные и явные.

export { D20Overlay } from "./D20Overlay";
export type { D20OverlayProps } from "./D20Overlay";

export { D20RollLauncher } from "./D20RollLauncher";
export type { D20RollLauncherProps } from "./D20RollLauncher";

export { resolveRoll } from "./D20RollService";

// Пробрасываем типы состояния/ролла наружу для удобства импорта из "game/dice"
export type { RollRequest, RollResolution, CharacterState } from "../state/types";

// (опционально) Стандартные пути к ассетам, если хочешь импортировать «пакетом»
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
