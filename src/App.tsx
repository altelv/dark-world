import React from "react";
import CharacterPanel from "./components/CharacterPanel";
import Chat from "./components/Chat/Chat";
import InventoryPanel from "./components/InventoryPanel";
import "./styles/layout.css";

/**
 * Корневой трёхколоночный лэйаут.
 * - grid 3 колонки во всю ширину и высоту экрана
 * - скролл только у средней колонки (чат)
 * - боковые фиксированные (overflow hidden)
 * ВНИМАНИЕ: компонент Chat внутри сам управляет своим вертикальным скроллом.
 */
export default function App() {
  return (
    <div className="dw-app-grid">
      <aside className="dw-col dw-col--side">
        <CharacterPanel />
      </aside>

      <main className="dw-col dw-col--chat">
        <Chat />
      </main>

      <aside className="dw-col dw-col--side">
        <InventoryPanel />
      </aside>
    </div>
  );
}
