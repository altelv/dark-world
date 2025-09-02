// DW SAFE APP LAYOUT — hard replace
// Этот файл полностью заменяет ваш src/App.tsx и НЕ импортирует CharacterPanel/InventoryPanel.

import React from "react";
import Chat from "./components/Chat"; // если у вас Chat лежит в другом пути, поправьте импорт тут
import "./styles/layout.css";

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
