import React from "react";

/**
 * Заглушка панели персонажа.
 * Нужна, чтобы сборка не падала из-за отсутствия компонента.
 * Замените на реальную реализацию позже.
 */
export default function CharacterPanel() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Персонаж</h2>
      <p className="text-sm opacity-70">Заглушка CharacterPanel (временная).</p>
    </div>
  );
}
