import { useMemo } from "react"
import type { BattleState } from "@types/battle"
import { isInBoardLocal, worldToLocal, possibleMovesLocal } from "@game/battle/board"
import clsx from "clsx"

type Props = { battle: BattleState, onCellClick: (x:number,y:number)=>void }

export function BattleGrid({ battle, onCellClick }: Props){
  const board = battle.board
  const cells = useMemo(()=>{
    const arr: { lx:number, ly:number }[] = []
    for (let ly=4; ly>=-1; ly--){ for (let lx=-3; lx<=3; lx++){ if (isInBoardLocal(lx, ly)) arr.push({ lx, ly }) } }
    return arr
  }, [])

  const reachable = useMemo(()=>{
    if (battle.ap.simple<=0 || battle.movementLocked) return new Set<string>()
    const set = new Set<string>()
    for (const mv of possibleMovesLocal(battle.board.facing)){
      const lx = -mv.dx, ly = -mv.dy; const k = `${lx},${ly}`
      if (isInBoardLocal(lx, ly)) set.add(k)
    }
    return set
  }, [battle.ap.simple, battle.board.facing, battle.movementLocked])

  const enemyLoc = useMemo(()=>{
    const map = new Map<string, any>()
    Object.values(board.enemies).forEach(e=>{
      if (e.hpState==="dead") return
      const l = worldToLocal(e.pos, board.origin, board.facing)
      map.set(`${l.x},${l.y}`, { enemy: e, local: l })
    })
    return map
  }, [board.enemies, board.origin, board.facing])

  const tileLoc = useMemo(()=>{
    const map = new Map<string,string>()
    Object.entries(board.tiles).forEach(([k,t])=>{
      const [x,y] = k.split(",").map(Number)
      const l = worldToLocal({x,y}, board.origin, board.facing)
      if (isInBoardLocal(l.x,l.y)) map.set(`${l.x},${l.y}`, t as string)
    })
    return map
  }, [board.tiles, board.origin, board.facing])

  return (
    <div className="grid grid-cols-7 gap-[2px] p-2 bg-iron rounded-xl2 border border-iron">
      {cells.map(c=>{
        const k = `${c.lx},${c.ly}`
        const enemy = enemyLoc.get(k)?.enemy
        const tile = tileLoc.get(k)
        const isHero = (c.lx===0 && c.ly===0)
        const canMoveHere = reachable.has(k)
        return (
          <button key={k} onClick={()=> onCellClick(c.lx, c.ly)}
            className={clsx(
              "w-12 h-12 md:w-14 md:h-14 rounded-sm relative border border-coal/50 bg-coal/40 hover:bg-coal/60 transition-colors",
              isHero && "ring-2 ring-accent/60",
              tile==="cover" && "bg-coal/70 before:content-[''] before:absolute before:bottom-1/2 before:left-1/2 before:-translate-x-1/2 before:border-l-8 before:border-r-8 before:border-b-[14px] before:border-l-transparent before:border-r-transparent before:border-b-iron/80",
              tile==="block" && "bg-iron/70",
              canMoveHere && "outline outline-1 outline-emerald-500/60",
            )}
            title={`${c.lx},${c.ly}`}>
            {enemy && (
              <div className="absolute inset-[6px] rounded-sm flex items-center justify-center text-[10px] md:text-xs bg-red-600/20">
                <span className="truncate px-1">{enemy.name}</span>
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/60" />
              </div>
            )}
            {isHero && <div className="absolute inset-2 rounded-full bg-accent/80"/>}
          </button>
        )
      })}
    </div>
  )
}
