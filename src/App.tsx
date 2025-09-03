import React from "react";
import CharacterPanel from "./components/CharacterPanel";
import InventoryPanel from "./components/InventoryPanel";
import Chat from "./components/Chat";

export default function App() {
  return (
    <div className="grid grid-cols-3 h-screen w-screen overflow-hidden">
      <aside className="h-full overflow-hidden border-r border-white/5">
        <div className="h-full overflow-y-auto px-2 py-3">
          <CharacterPanel />
        </div>
      </aside>
      <main className="relative h-full overflow-hidden">
        <Chat />
      </main>
      <aside className="h-full overflow-hidden border-l border-white/5">
        <div className="h-full overflow-y-auto px-2 py-3">
          <InventoryPanel />
        </div>
      </aside>
    </div>
  );
}


