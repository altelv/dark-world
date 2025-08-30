// src/game/dice.ts
// ШИМ для надёжного импорта "./game/dice" из App.tsx.
// Явно реэкспортируем компоненты и сервисы из папки ./dice.

export { D20RollLauncher } from "./dice/D20RollLauncher";
export { D20Overlay } from "./dice/D20Overlay";
export { resolveRoll } from "./dice/D20RollService";

// На всякий случай пробросим все именованные экспорты:
export * from "./dice/D20RollLauncher";
export * from "./dice/D20Overlay";
export * from "./dice/D20RollService";
