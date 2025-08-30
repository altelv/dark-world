import React, { useState } from "react";
import { LeftPanelCharacter } from "./components/LeftPanelCharacter";
import D20RollLauncher from "./game/dice/D20RollLauncher";
import { seedCharacter } from "./game/examples/seedCharacter";
import type { RollRequest, RollResolution } from "./game/state/types";

const spin = [
  "/assets/d20/spin_1.png",
  "/assets/d20/spin_2.png",
  "/assets/d20/spin_3.png",
  "/assets/d20/spin_4.png",
];
const resultDefault = "/assets/d20/result_default.png";
const resultSpecial = "/assets/d20/result_special.png";

export default function App() {
  const [char] = useState(seedCharacter);
  const [log, setLog] = useState<string[]>([]);

  const req: RollRequest = { skill: "Stealth", dc: 15, ingenuity: 2 };

  const onResolved = (r: RollResolution) => {
    const status = r.crit === "critSuccess" ? "УСПЕХ!" : r.crit === "critFail" ? "Провал…" : (r.success ? "УСПЕХ!" : "Провал…");
    setLog(l => [
      status,
      `==Проверка ${req.skill}== d20=${(r as any).d20 ?? r.d20Raw} → total=${r.total} vs DC ${r.dc}`,
      ...l,
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black text-zinc-100 grid grid-cols-12">
      <div className="col-span-3">
        <LeftPanelCharacter char={char} />
      </div>
      <div className="col-span-6 p-6">
        <D20RollLauncher
          char={char}
          request={req}
          spinFrames={spin}
          resultDefault={resultDefault}
          resultSpecial={resultSpecial}
          onResolved={onResolved}
        />
        <div className="mt-6 space-y-2">
          {log.map((s, i) => (<div key={i} className="text-yellow-400">{s}</div>))}
        </div>
      </div>
      <div className="col-span-3" />
    </div>
  );
}
