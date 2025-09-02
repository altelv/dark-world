import type { Board, Cell } from "@types/battle"
import { getTile } from "./board"
function rayCells(a:Cell, b:Cell): Cell[] {
  const cells:Cell[] = []; let x0=a.x, y0=a.y, x1=b.x, y1=b.y
  const dx = Math.abs(x1-x0), dy = Math.abs(y1-y0)
  const sx = x0<x1?1:-1, sy = y0<y1?1:-1; let err = dx - dy
  while(true){ cells.push({x:x0,y:y0}); if (x0===x1 && y0===y1) break
    const e2 = 2*err; if (e2 > -dy){ err -= dy; x0 += sx } if (e2 < dx){ err += dx; y0 += sy } }
  return cells
}
export function enemyCanShootHero(board:Board, enemy:Cell, hero:Cell={x:0,y:0}): boolean {
  for (const k of Object.keys(board.tiles)){
    if (board.tiles[k] !== "cover") continue
    const [cx,cy] = k.split(",").map(Number)
    if (isInCoverCone({x:cx,y:cy}, enemy)) return false
  }
  const cells = rayCells(enemy, hero)
  for (const c of cells){
    const t = getTile(board, c)
    if ((c.x===enemy.x && c.y===enemy.y) || (c.x===hero.x && c.y===hero.y)) continue
    if (t === "cover" || t === "block") return false
  }
  return true
}
export function checkTargetInCoverCone(board:Board, target:Cell): boolean {
  for (const k of Object.keys(board.tiles)){
    if (board.tiles[k] !== "cover") continue
    const [cx,cy] = k.split(",").map(Number)
    if (isInCoverCone({x:cx,y:cy}, target)) return true
  }
  return false
}
export function isInCoverCone(cover:Cell, p:Cell): boolean {
  if (p.y < cover.y) return false
  const dy = p.y - cover.y, dx = Math.abs(p.x - cover.x)
  return dx <= dy
}
