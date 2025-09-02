import { useGameStore } from "@store/game"
import { BattleGrid } from "./BattleGrid"
import { ActionBar } from "./ActionBar"
import { localToWorld, possibleMovesLocal } from "@game/battle/board"
import type { ActionKind } from "@types/battle"

export function BattleOverlay(){
  const s = useGameStore()
  const battle = s.battle!
  if (!battle?.active) return null

  const onCellClick = (lx:number, ly:number) => {
    const world = localToWorld({x:lx,y:ly}, battle.board.origin, battle.board.facing)
    const target = Object.values(battle.board.enemies).find(e=> e.pos.x===world.x && e.pos.y===world.y && e.hpState!=="dead")
    if (target){ s.battleSelectEnemy(target.id); return }
    if (battle.ap.simple>0 && !battle.movementLocked){
      const moves = possibleMovesLocal(battle.board.facing)
      const mv = moves.find(m => (-m.dx)===lx && (-m.dy)===ly)
      if (mv){ s.battleMove(mv.dx, mv.dy) }
    }
  }

  const onSelect = (kind:ActionKind)=> s.battleSelectAction(kind)
  const onRotate = (deg:90|180|270)=> s.battleRotate(deg)
  const onStep = (dir:"left"|"right"|"back"|"backL"|"backR"|"fwd"|"fwdL"|"fwdR")=> s.battleStep(dir)
  const onTurn = ()=> s.battleEndTurn()

  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-b from-coal/95 to-coal/60 backdrop-blur-sm rounded-xl2 border border-iron p-3 md:p-4">
      <div className="flex items-start gap-4 h-full">
        <div className="flex-1 overflow-hidden">
          <div className="mb-2 text-xs text-ash/70">
            Ход: <span className="text-ash">Игрок</span> · Простые: {battle.ap.simple} · Основные: {battle.ap.main}
          </div>
          <BattleGrid battle={battle} onCellClick={onCellClick} />
          <div className="mt-2 text-xs text-ash/60">
            Клик по зелёной клетке — перемещение за 1 простое. Клик по врагу — выбор цели.
            После ближнего удара или выстрела/магии — движение до конца хода запрещено.
          </div>
        </div>
        <div className="w-56 shrink-0">
          <ActionBar battle={battle} onSelect={onSelect} onRotate={onRotate} onStep={onStep} onTurn={onTurn} />
        </div>
      </div>
    </div>
  )
}
