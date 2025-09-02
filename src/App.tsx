import React from "react";
import Chat from "./components/Chat"; // универсальный импорт, как обычно в проекте
import "./styles/layout.css";

/**
 * Жёсткий трёхколоночный layout.
 * - grid 3 колонки на десктопе
 * - скролл только у центра (чат)
 * - боковые панели «заглушки-обёртки» с mount-точками (не требуют импортов)
 */
export default function App() {
  return (
    <div className="dw-app-grid">
      <aside className="dw-col dw-col--side">
        <div className="dw-side-wrap">
          <h2 className="dw-side-title">Персонаж</h2>
          <div id="character-mount" className="dw-side-body" />
        </div>
      </aside>

      <main className="dw-col dw-col--chat">
        <div className="dw-stretch">
          <Chat />
        </div>
      </main>

      <aside className="dw-col dw-col--side">
        <div className="dw-side-wrap">
          <h2 className="dw-side-title">Инвентарь</h2>
          <div id="inventory-mount" className="dw-side-body" />
        </div>
      </aside>
    </div>
  );
}
