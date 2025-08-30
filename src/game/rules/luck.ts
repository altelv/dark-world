export interface LuckState { value: number; } // 0..20

export function onRollEvaluated(rawD20: number, hiddenCheckFailed: boolean, prev: LuckState): LuckState {
  let v = prev.value;
  if (rawD20 < 5 || hiddenCheckFailed) v = Math.min(20, v + 1);
  // reset if raw + luck >= 20
  if (rawD20 + v >= 20) v = 0;
  return { value: v };
}
