import React, { useMemo, useState } from "react";
import type { CharacterState, RollRequest, RollResolution } from "../state/types";
import { resolveRoll } from "./D20RollService";
import { D20Overlay } from "./D20Overlay";
import { computeRollTotalInputs } from "../state/selectors";

export interface D20RollLauncherProps {
  char: CharacterState;
  request: RollRequest;
  spinFrames: string[];
  resultDefault: string;
  resultSpecial: string;
  onResolved: (res: RollResolution) => void;
}

export const D20RollLauncher: React.FC<D20RollLauncherProps> = ({
  char, request, spinFrames, resultDefault, resultSpecial, onResolved
}) => {
  const [pending, setPending] = useState(false);
  const [overlayKey, setOverlayKey] = useState(0);
  const [value, setValue] = useState<number | null>(null);

  const mods = useMemo(() => computeRollTotalInputs(char, request), [char, request]);

  const start = () => {
    if (pending) return;
    setPending(true);
    setOverlayKey(k => k + 1); // новый оверлей на каждый бросок
    const res = resolveRoll(char, request);
    setValue(res.d20Raw);

    // Общая длительность под новые тайминги:
    // спин 3000 + gold flash 180 + reveal hold 2600 + fade 1700 + запас 150 = 7630мс
    const totalMs = 3000 + 180 + 2600 + 1700 + 150;
    const timer = setTimeout(() => {
      onResolved(res);
      setPending(false);
      clearTimeout(timer);
    }, totalMs);
  };

  return (
    <div className="w-full">
      <div className="mb-3 rounded-2xl border border-gray-700 p-3 bg-black/30">
        <div className="text-sm text-gray-300">
          Вы собираетесь: <span className="font-semibold">{request.skill}</span>. Цель (DC):
          <span className="font-semibold"> {request.dc}</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          Модификаторы: d20 + мастерство <b>+{mods.mastery}</b> + плоские <b>+{mods.flat}</b> + изобретательность <b>+{mods.ingenuity}</b> + удача <b>+{mods.luck}</b> − усталость <b>{mods.fatigue}</b>
          {mods.situational ? <> + ситуативный <b>{mods.situational}</b></> : null}
        </div>
      </div>

      <button
        disabled={pending}
        onClick={start}
        className="px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Ждём…" : "Бросить кости"}
      </button>

      {value !== null && (
        <D20Overlay
          key={overlayKey}
          spinFrames={spinFrames}
          resultFrameDefault={resultDefault}
          resultFrameSpecial={resultSpecial}
          value={value}
          durationMs={3000}
          onDone={() => {/* overlay finished */}}
        />
      )}
    </div>
  );
};
