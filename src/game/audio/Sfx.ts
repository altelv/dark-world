/* src/game/audio/Sfx.ts
 * Надёжный менеджер звуков: прелоад с таймаутами/ретраями, фолбэк на WebAudio-пики.
 * Файлы не обязательны: если их нет в /public/assets/audio — будут “пики”.
 */

type ResultKind = "normal" | "crit" | "fail";

const PATHS = {
  spin: ["/assets/audio/d20_spin.ogg", "/assets/audio/d20_spin.mp3"],
  result_normal: ["/assets/audio/d20_result_normal.ogg", "/assets/audio/d20_result_normal.mp3"],
  result_crit: ["/assets/audio/d20_result_crit.ogg", "/assets/audio/d20_result_crit.mp3"],
  result_fail: ["/assets/audio/d20_result_fail.ogg", "/assets/audio/d20_result_fail.mp3"]
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await withTimeout(fetch(url, { cache: "force-cache" }), 4000);
  if (!res.ok) throw new Error(`http ${res.status}`);
  return await withTimeout(res.arrayBuffer(), 4000);
}

async function decodeAudio(ctx: AudioContext, ab: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    try {
      ctx.decodeAudioData(ab.slice(0), resolve, reject);
    } catch (e) {
      // @ts-ignore
      (ctx as any).decodeAudioData(ab).then(resolve).catch(reject);
    }
  });
}

async function loadFirstAvailable(ctx: AudioContext, urls: string[], retries = 1): Promise<AudioBuffer | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const url of urls) {
      try {
        const ab = await fetchArrayBuffer(url);
        const buf = await decodeAudio(ctx, ab);
        return buf;
      } catch {
        // пробуем следующий
      }
    }
  }
  return null;
}

export function useSfx() {
  // SSR-/build-safe: если window нет — возвращаем no-op
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser) {
    return {
      warmup: async () => {},
      preloadAll: async () => {},
      startSpin: () => {},
      stopSpin: () => {},
      resultSound: (_: ResultKind) => {}
    };
  }

  const ctxRef = { current: null as AudioContext | null };
  const masterGainRef = { current: null as GainNode | null };

  const buffers = {
    spin: null as AudioBuffer | null,
    normal: null as AudioBuffer | null,
    crit: null as AudioBuffer | null,
    fail: null as AudioBuffer | null
  };

  let spinSource: AudioBufferSourceNode | null = null;
  let spinTickInterval: number | null = null;

  function ensureCtx(): AudioContext {
    // @ts-ignore
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!ctxRef.current) {
      ctxRef.current = new Ctx();
      masterGainRef.current = ctxRef.current.createGain();
      masterGainRef.current.gain.value = 0.35;
      masterGainRef.current.connect(ctxRef.current.destination);
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  function connectNode(n: AudioNode) {
    const mg = masterGainRef.current;
    if (mg) n.connect(mg);
    else n.connect(ensureCtx().destination);
  }

  function oscBeep(freq: number, durMs: number, type: OscillatorType = "sine", gain = 0.03) {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = 0.0001;
    osc.connect(g); connectNode(g);
    const now = ctx.currentTime;
    const dur = Math.max(0.02, durMs / 1000);
    g.gain.linearRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now); osc.stop(now + dur + 0.02);
  }

  function playBufferOnce(buf: AudioBuffer, opts?: { loop?: boolean; gain?: number }) {
    const ctx = ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = !!opts?.loop;
    if (opts?.gain != null) {
      const g = ctx.createGain();
      g.gain.value = opts.gain;
      src.connect(g); connectNode(g);
    } else {
      connectNode(src);
    }
    src.start();
    return src;
  }

  async function preloadAll() {
    const ctx = ensureCtx();
    const [spin, normal, crit, fail] = await Promise.all([
      loadFirstAvailable(ctx, PATHS.spin, 1),
      loadFirstAvailable(ctx, PATHS.result_normal, 1),
      loadFirstAvailable(ctx, PATHS.result_crit, 1),
      loadFirstAvailable(ctx, PATHS.result_fail, 1)
    ]);
    buffers.spin = spin;
    buffers.normal = normal;
    buffers.crit = crit;
    buffers.fail = fail;
  }

  function startSpin() {
    ensureCtx();
    if (spinSource || spinTickInterval) return;

    if (buffers.spin) {
      const src = playBufferOnce(buffers.spin, { loop: true, gain: 0.5 });
      spinSource = src;
    } else {
      oscBeep(520 + Math.random()*120, 38, "sine", 0.02);
      spinTickInterval = window.setInterval(() => {
        const f = 520 + Math.random() * 120;
        oscBeep(f, 36, "sine", 0.018);
      }, 110);
    }
  }

  function stopSpin() {
    if (spinSource) {
      try { spinSource.stop(); } catch {}
      try { spinSource.disconnect(); } catch {}
      spinSource = null;
    }
    if (spinTickInterval != null) {
      clearInterval(spinTickInterval);
      spinTickInterval = null;
    }
  }

  function resultSound(kind: ResultKind) {
    if (kind === "crit") {
      if (buffers.crit) playBufferOnce(buffers.crit, { gain: 0.9 });
      else {
        oscBeep(523.25, 140, "triangle", 0.05);
        setTimeout(() => oscBeep(659.25, 140, "triangle", 0.05), 90);
        setTimeout(() => oscBeep(783.99, 220, "triangle", 0.06), 180);
      }
    } else if (kind === "fail") {
      if (buffers.fail) playBufferOnce(buffers.fail, { gain: 0.9 });
      else { oscBeep(196.00, 260, "sawtooth", 0.05); }
    } else {
      if (buffers.normal) playBufferOnce(buffers.normal, { gain: 0.9 });
      else { oscBeep(660.00, 160, "square", 0.04); }
    }
  }

  async function warmup() {
    ensureCtx();
    try { await preloadAll(); } catch {}
  }

  return { startSpin, stopSpin, resultSound, warmup, preloadAll };
}
