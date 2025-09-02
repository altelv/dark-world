import type { ActionKind, BattleState } from "@types/battle"
import clsx from "clsx"
type Props = { battle: BattleState
  onSelect: (kind: ActionKind)=>void; onTurn: ()=>void
  onRotate: (deg:90|180|270)=>void; onStep: (dir:"left"|"right"|"back"|"backL"|"backR"|"fwd"|"fwdL"|"fwdR")=>void }
export function ActionBar({ battle, onSelect, onTurn, onRotate, onStep }:Props){
  const disabledMove = battle.ap.simple<=0 || battle.movementLocked || battle.phase!=="player"
  const disabledMain = battle.ap.main<=0 || battle.phase!=="player"
  const Btn = (p:{label:string, onClick:()=>void, disabled?:boolean, active?:boolean})=>(
    <button className={clsx("px-2 py-1 rounded-md border text-xs md:text-sm",
      p.active ? "bg-accent text-white border-accent" : "bg-iron text-ash border-iron hover:bg-iron/80",
      p.disabled && "opacity-50 cursor-not-allowed")} disabled={p.disabled} onClick={p.onClick}>{p.label}</button>
  )
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Btn label="Ближний" onClick={()=>onSelect("melee")} disabled={disabledMain} active={battle.selectedAction==="melee"} />
        <Btn label="Выстрел" onClick={()=>onSelect("shoot")} disabled={disabledMain} active={battle.selectedAction==="shoot"} />
        <Btn label="Магия" onClick={()=>onSelect("magic")} disabled={disabledMain} active={battle.selectedAction==="magic"} />
        <Btn label="Метнуть" onClick={()=>onSelect("throw")} disabled={battle.ap.simple<=0 || battle.phase!=="player"} active={battle.selectedAction==="throw"} />
        <Btn label="Оборона" onClick={()=>onSelect("none")} active={battle.selectedAction==="none"} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn label="↺ 90°" onClick={()=>onRotate(90)} disabled={disabledMove} />
        <Btn label="↻ 270°" onClick={()=>onRotate(270)} disabled={disabledMove} />
        <Btn label="⟳ 180°" onClick={()=>onRotate(180)} disabled={disabledMove} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn label="◀︎" onClick={()=>onStep("left")} disabled={disabledMove} />
        <Btn label="▶︎" onClick={()=>onStep("right")} disabled={disabledMove} />
        <Btn label="▲" onClick={()=>onStep("back")} disabled={disabledMove} />
        <Btn label="◤" onClick={()=>onStep("backL")} disabled={disabledMove} />
        <Btn label="◥" onClick={()=>onStep("backR")} disabled={disabledMove} />
        <Btn label="▼▼" onClick={()=>onStep("fwd")} disabled={disabledMove} />
        <Btn label="◣" onClick={()=>onStep("fwdL")} disabled={disabledMove} />
        <Btn label="◢" onClick={()=>onStep("fwdR")} disabled={disabledMove} />
      </div>
      <div className="pt-2"><Btn label="Конец хода" onClick={onTurn} disabled={battle.phase!=="player"} /></div>
    </div>
  )
}
