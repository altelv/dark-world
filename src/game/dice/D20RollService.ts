import type { CharacterState, RollRequest, RollResolution } from "../state/types";
import { computeTheoreticalTotal } from "../state/selectors";

export function randD20(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] % 20) + 1; // 1..20
}

export function resolveRoll(char: CharacterState, req: RollRequest): RollResolution {
  const d20Raw = randD20();
  const { total } = computeTheoreticalTotal(char, req, d20Raw);
  const crit: RollResolution["crit"] = d20Raw === 20 ? "critSuccess" : (d20Raw === 1 ? "critFail" : "none");
  const success = crit === "critSuccess" ? true : (crit === "critFail" ? false : total >= req.dc);
  return {
    requestId: crypto.randomUUID(),
    d20Raw, total, dc: req.dc, success, crit,
  };
}
