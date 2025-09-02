// DW APP — hard replace to avoid missing imports.
// ЗАМЕНИТЕ src/App.tsx ЭТИМ ФАЙЛОМ.

import React from "react";
import Chat from "./components/Chat"; // поправьте путь, если у вас иначе
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
