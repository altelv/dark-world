export type ToUiCommand =
  | { cmd: "start_roll"; payload: { skill: string; dc: number; ingenuity: number; summary: string; } }
  | { cmd: "cancel_roll" }
  | { cmd: "resolve_roll"; payload: { request_id: string; d20: number; total: number; dc: number; success: boolean; crit: "none"|"critSuccess"|"critFail" } };
