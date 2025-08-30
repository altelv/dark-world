// src/game/dice.ts
// ШИМ для надёжного импорта "./game/dice": реэкспортируем всё из папки.

export { D20Overlay } from "./dice/D20Overlay";
export { resolveRoll } from "./dice/D20RollService";

// И ДВУМЯ способами отдаём лаунчер:
export { D20RollLauncher } from "./dice/D20RollLauncher";     // именованный
export { default as default } from "./dice/D20RollLauncher";  // дефолт

// На всякий случай пробрасываем все именованные экспорты:
export * from "./dice/D20Overlay";
export * from "./dice/D20RollService";
export * from "./dice/D20RollLauncher";
