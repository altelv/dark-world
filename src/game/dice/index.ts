// src/game/dice/index.ts
// Универсальный баррель: подхватывает И именованные, И default-экспорты.
// Это защищает сборку Rollup/Vercel от "is not exported by ..." при разных вариантах экспорта внутри файлов.

import * as ModOverlay from "./D20Overlay";
import * as ModLauncher from "./D20RollLauncher";
import * as ModService from "./D20RollService";

// Гарантируем наличие одноимённых экспортов
export const D20Overlay =
  (ModOverlay as any).D20Overlay ?? (ModOverlay as any).default;

export const D20RollLauncher =
  (ModLauncher as any).D20RollLauncher ?? (ModLauncher as any).default;

export const resolveRoll =
  (ModService as any).resolveRoll ?? (ModService as any).default;

// Пробрасываем ВСЕ именованные экспорты из модулей (на всякий случай)
export * from "./D20Overlay";
export * from "./D20RollLauncher";
export * from "./D20RollService";

// Типы наружу
export type { RollRequest, RollResolution, CharacterState } from "../state/types";

// Набор путей к ассетам (опционально)
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
