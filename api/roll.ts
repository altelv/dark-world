export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const body = await req.json();
  const { dc, d20Raw, inputs } = body as { dc: number; d20Raw?: number; inputs: { mastery: number; flat: number; ingenuity: number; luck: number; fatigue: number; situational?: number; } };

  const roll = (() => {
    if (typeof d20Raw === "number" && d20Raw >=1 && d20Raw <= 20) return d20Raw;
    const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 20) + 1;
  })();
  const total = roll + inputs.mastery + inputs.flat + inputs.ingenuity + inputs.luck + (inputs.situational||0) - inputs.fatigue;
  const crit = roll === 20 ? "critSuccess" : (roll === 1 ? "critFail" : "none");
  const success = crit === "critSuccess" ? true : (crit === "critFail" ? false : total >= dc);
  const payload = { request_id: crypto.randomUUID(), d20: roll, total, dc, success, crit };
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
}
