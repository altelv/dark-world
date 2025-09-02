export type Cell = { x:number; y:number };
export type Tile = "empty" | "cover" | "block";
export type EnemyHpState = "unhurt" | "light" | "heavy" | "near_death" | "dead";
export type EnemyArchetype = "tank" | "glass" | "trickster" | "horde";
export type EnemyRank = "weak" | "medium" | "strong" | "boss";
export interface BoardEnemy {
  id: string; name: string; rank: EnemyRank; archetype: EnemyArchetype;
  pos: Cell; defenseDC: number; attackDC: number; hpState: EnemyHpState; promptEN?: string;
}
export interface Board {
  origin: Cell; facing: 0|90|180|270;
  tiles: Record<string, Tile>;
  enemies: Record<string, BoardEnemy>;
  rangeRules: { throw:number; magic:number; bow:number };
}
export type ActionKind = "none" | "melee" | "shoot" | "magic" | "throw";
export interface BattleState {
  active: boolean; board: Board; ap: { simple:number; main:number };
  phase: "player"|"enemies"; selectedEnemyId?: string|null; selectedAction: ActionKind;
  movementLocked: boolean;
}
