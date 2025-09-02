import type { Board, Cell, Tile } from "@types/battle"
export function key(c:Cell){ return `${c.x},${c.y}` }
export function parseKey(k:string):Cell { const [x,y] = k.split(",").map(Number); return {x,y} }
export function isInBoardLocal(x:number, y:number): boolean {
  if (y >= 1 && y <= 4) return x >= -2 && x <= 2
  if (y === 0) return x >= -3 && x <= 3
  if (y === -1) return x >= -1 && x <= 1
  return false
}
export function rotateLocalToWorld(local:Cell, facing:0|90|180|270): Cell {
  const {x,y} = local
  switch(facing){
    case 0: return {x, y}
    case 90: return {x: y, y: -x}
    case 180: return {x: -x, y: -y}
    case 270: return {x: -y, y: x}
  }
}
export function localToWorld(local:Cell, origin:Cell, facing:0|90|180|270): Cell {
  const r = rotateLocalToWorld(local, facing)
  return { x: r.x + origin.x, y: r.y + origin.y }
}
export function worldToLocal(world:Cell, origin:Cell, facing:0|90|180|270): Cell {
  let x = world.x - origin.x, y = world.y - origin.y
  switch(facing){ case 0: return {x, y}; case 90: return {x: -y, y: x}; case 180: return {x: -x, y: -y}; case 270: return {x: y, y: -x}; }
}
export function getTile(board:Board, c:Cell):Tile { return board.tiles[`${c.x},${c.y}`] ?? "empty" }
export function possibleMovesLocal(facing:0|90|180|270){
  return [
    {dx:0, dy:1},{dx:-1, dy:1},{dx:1, dy:1},
    {dx:0, dy:-2},{dx:-1, dy:-1},{dx:1, dy:-1},
    {dx:-1, dy:0},{dx:1, dy:0},
  ]
}
export function applyMoveOrigin(origin:Cell, move:{dx:number,dy:number}, facing:0|90|180|270): Cell {
  const w = rotateLocalToWorld({x: move.dx, y: move.dy}, facing); return { x: origin.x + w.x, y: origin.y + w.y }
}
export function inAdjacency(local:Cell): boolean {
  return Math.abs(local.x) <= 1 && Math.abs(local.y) <= 1 && !(local.x===0 && local.y===0)
}
