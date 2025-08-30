import React, { useMemo } from "react";
import type { CharacterState } from "../game/state/types";
import { masteryBonus, effectiveLevel } from "../game/rules/mastery";

interface Props { char: CharacterState; portraitUrl?: string; }

export const LeftPanelCharacter: React.FC<Props> = ({ char, portraitUrl }) => {
  const masteryBySkill = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(char.skills).forEach(([skill, st]) => {
      const eff = effectiveLevel({ baseLevel: st.level, levelBuff: st.levelBuff || 0 });
      m[skill] = masteryBonus(eff);
    });
    return m;
  }, [char.skills]);

  const hpMax = char.hpBase + (masteryBySkill["Endurance"] || 0) + (masteryBySkill["Medicine"] || 0) + (masteryBySkill["Athletics"] || 0);

  return (
    <aside className="h-screen w-full p-3 flex flex-col gap-3 bg-zinc-950 text-zinc-200">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-zinc-800 rounded-xl overflow-hidden">
          {portraitUrl ? <img src={portraitUrl} alt="portrait" className="w-full h-full object-cover"/> : null}
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">{char.name} <span className="text-xs opacity-70">({char.gender})</span></div>
          <div className="text-xs opacity-70">{char.race} • {char.className} • {char.age} лет</div>
        </div>
      </div>

      {/* Bars */}
      <div>
        <Bar label="Здоровье" value={char.hpCurrent} max={hpMax} color="bg-red-600"/>
        <Bar label="Усталость" value={char.fatigue} max={20} color="bg-sky-600"/>
        <Bar label="Удача" value={char.luck} max={20} color="bg-amber-500"/>
      </div>

      {/* Perks / Weakness / Background */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoCard title="Перк мастера">{char.perks.find(p=>p.type==="Master")?.skill || "—"}</InfoCard>
        <InfoCard title="Перк специалиста">{char.perks.find(p=>p.type==="Specialist")?.skill || "—"}</InfoCard>
        <InfoCard title="Слабость">{char.weakness || "—"}</InfoCard>
        <InfoCard title="Бэкграунд" wide>{char.background || "—"}</InfoCard>
      </div>

      {/* Skills list (compact) */}
      <div className="mt-2 flex-1 overflow-auto">
        <div className="text-sm font-semibold mb-1">Навыки</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(char.skills).map(([name, st]) => (
            <div key={name} className="rounded-lg bg-zinc-900 p-2 border border-zinc-800">
              <div className="font-medium truncate">{name}</div>
              <div className="opacity-70">ур.: {st.level}{st.levelBuff?` (+${st.levelBuff})`:""} • маст.: +{masteryBySkill[name] || 0}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

const Bar: React.FC<{label: string; value: number; max: number; color: string;}> = ({ label, value, max, color }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{value}/{max}</span></div>
      <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{title: string; wide?: boolean; children: React.ReactNode}> = ({ title, wide, children }) => (
  <div className={`${wide?"col-span-2":""} rounded-lg bg-zinc-900 p-2 border border-zinc-800`}>
    <div className="text-[11px] opacity-70 mb-1">{title}</div>
    <div>{children}</div>
  </div>
);
