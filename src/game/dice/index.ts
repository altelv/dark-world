// src/game/dice/index.ts
// Надёжный баррель: явные именованные экспорты + дубль через промежуточную константу (чтобы rollup не терял).

import { D20Overlay as _D20Overlay } from "./D20Overlay";
import { D20RollLauncher as _D20RollLauncher } from "./D20RollLauncher";
import { resolveRoll as _resolveRoll } from "./D20RollService";

export const D20Overlay = _D20Overlay;
export const D20RollLauncher = _D20RollLauncher;
export const resolveRoll = _resolveRoll;

// Типы наружу
export type { RollRequest, RollResolution, CharacterState } from "../state/types";

// Пакет путей к ассетам (опционально)
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

// Дополнительно (не обязательно), но пусть будет:
export * from "./D20RollLauncher";
export * from "./D20Overlay";
export * from "./D20RollService";
