import React, { useState } from "react";
import { D20RollLauncher } from "../game/dice";
import { seedCharacter } from "../game/examples/seedCharacter";
import type { RollRequest, RollResolution } from "../game/state/types";

const spin = [
  "/assets/d20/spin_1.png",
  "/assets/d20/spin_2.png",
  "/assets/d20/spin_3.png",
  "/assets/d20/spin_4.png",
];
const resDefault = "/assets/d20/result_default.png";
const resSpecial = "/assets/d20/result_special.png";

export default function DemoD20() {
  const [log, setLog] = useState<string[]>([]);
  const [char] = useState(seedCharacter);
  const [req] = useState<RollRequest>({ skill: "Stealth", dc: 15, ingenuity: 2 });

  const onResolved = (r: RollResolution) => {
    setLog(l => [
      `${r.crit === "critSuccess" ? "УСПЕХ!" : r.crit === "critFail" ? "Провал…" : (r.success ? "УСПЕХ!" : "Провал…")}`,
      `==Проверка ${req.skill}== d20=${(r as any).d20 ?? r.d20Raw} → total=${r.total} vs DC ${r.dc}`,
      ...l,
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black text-zinc-100 p-6 grid grid-cols-3 gap-4">
      <div className="col-span-1"></div>
      <div className="col-span-1">
        <D20RollLauncher
          char={char}
          request={req}
          spinFrames={spin}
          resultDefault={resDefault}
          resultSpecial={resSpecial}
          onResolved={onResolved}
        />
        <div className="mt-6 space-y-2">
          {log.map((s, i) => (<div key={i} className="text-yellow-400">{s}</div>))}
        </div>
      </div>
      <div className="col-span-1"></div>
    </div>
  );
}
