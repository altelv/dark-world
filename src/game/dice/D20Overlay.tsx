import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

/**
 * Фин-тюнинг:
 * - Старт: фиолетовая вспышка (большая, как раньше) 0.12s expand + 0.28s fade, вместе стартуют спин и фоновая пульсация.
 * - Спин: 3.0s, кадр/60мс, прелоад всех спрайтов.
 * - Золотая вспышка: такого же «большого» размера, что и фиолетовая (внешний радиус возвращён), длит. 0.18s.
 * - Цифра появляется одновременно со второй вспышкой (под ней по слоям), смещена +2px вправо, +6px вниз, масштаб ≈56px.
 * - Искры появляются ТОЛЬКО при выпавшем 20 и живут дольше вспышки.
 * - Звук: WebAudio-заглушки — спин-журчание/тики и звук результата (особые для 1 и 20).
 */

export interface D20OverlayProps {
  spinFrames: string[];          // 4 кадра, 128×128
  resultFrameDefault: string;    // 128×128
  resultFrameSpecial: string;    // для {1,3,5,6,8,10,13,18}
  value: number;                 // 1..20
  durationMs?: number;           // длительность спина (по умолчанию 3000)
  onDone?: () => void;
}

const SPECIAL_SET = new Set([1,3,5,6,8,10,13,18]);

type Phase = "spin" | "flash" | "reveal" | "fade" | "done";

// Тайминги
const INTRO_EXPAND_MS = 120;
const INTRO_FADE_MS   = 280;
const SPIN_MS         = 3000;
const FLASH_MS        = 180;   // «миг»
const REVEAL_HOLD_MS  = 2600;  // пауза на результате
const TINT_MS         = 900;   // белый → золото
const FADE_MS         = 1700;  // общий fade
const PULSE_MS        = 2600;  // медленная пульсация
const SPARKS_MS       = 1600;  // искры живут дольше вспышки

// Утилиты
function clamp(t: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, t)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smoothstep(t: number) { t = clamp(t); return t * t * (3 - 2 * t); }

function usePreloadImages(srcs: string[]) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(srcs.filter(Boolean)));
    Promise.all(unique.map(src => new Promise<void>((res) => {
      const img = new Image();
      let settled = false;
      const done = () => { if (!settled) { settled = true; res(); } };
      img.onload = done; img.onerror = done;
      img.decoding = "async"; img.src = src;
      // @ts-ignore
      if (img.decode) img.decode().then(done).catch(done);
    }))).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [JSON.stringify(srcs)]);
  return ready;
}

/* ===================== AUDIO (WebAudio заглушки) ===================== */
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const spinIntervalRef = useRef<number | null>(null);

  function ensureCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current!;
  }

  function beep(freq: number, durMs: number, type: OscillatorType = "sine", gain = 0.03) {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g); g.connect(ctx.destination);
    const now = ctx.currentTime;
    const dur = durMs / 1000;
    g.gain.linearRampToValueAtTime(gain, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now); osc.stop(now + dur + 0.01);
  }

  // мягкое «журчание» спина: редкие короткие тихие тики с лёгким рандомом частоты
  function startSpin() {
    const ctx = ensureCtx();
    // первый тик сразу
    beep(520 + Math.random()*80, 40, "sine", 0.02);
    stopSpin();
    spinIntervalRef.current = window.setInterval(() => {
      // 90–130мс между тиками
      const freq = 520 + Math.random() * 120;
      beep(freq, 35, "sine", 0.018);
    }, 110);
  }

  function stopSpin() {
    if (spinIntervalRef.current !== null) {
      clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  }

  // звук результата
  function resultSound(kind: "normal" | "crit" | "fail") {
    const ctx = ensureCtx();
    if (kind === "crit") {
      // мини-аккорд-триоль
      beep(523.25, 140, "triangle", 0.04); // C5
      setTimeout(() => beep(659.25, 140, "triangle", 0.04), 90);  // E5
      setTimeout(() => beep(783.99, 220, "triangle", 0.05), 180); // G5
    } else if (kind === "fail") {
      // низкий «бзз»
      beep(196.00, 260, "sawtooth", 0.04);
    } else {
      // обычный «пик»
      beep(660.00, 140, "square", 0.03);
    }
  }

  // очистка на размонтирование
  useEffect(() => {
    return () => {
      stopSpin();
      if (ctxRef.current) ctxRef.current.close().catch(()=>{});
    };
  }, []);

  return { startSpin, stopSpin, resultSound, ensureCtx };
}

/* ===================== ВСПЫШКИ/ФОН/ИСКРЫ ===================== */

// фиолетовая стартовая вспышка (большая, как была)
function IntroPurpleFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: 256, height: 256,
        transform: "translate(-50%, -50%)",
        borderRadius: "9999px",
        background: "radial-gradient(50% 50% at 50% 52%, rgba(102,29,135,1) 0%, rgba(102,29,135,0) 100%)",
        animation: `introExpand ${INTRO_EXPAND_MS}ms ease-out forwards, introFade ${INTRO_FADE_MS}ms ease-out ${INTRO_EXPAND_MS}ms forwards`,
        pointerEvents: "none",
      }}
    />
  );
}

// фоновая пульсация (синхронно со спином)
function BackgroundGlow({ active, phase }: { active: boolean; phase: Phase }) {
  const isFading = phase === "fade" || phase === "done";
  const isFlash = phase === "flash";
  return (
    <div
      className="absolute left-1/2 top-1/2 rounded-[24px]"
      style={{
        width: 256, height: 256,
        transform: "translate(-50%, -50%)",
        display: active ? "block" : "none",
        animation: `pulseGlow ${PULSE_MS}ms ease-in-out infinite`,
        opacity: isFading ? 0 : (isFlash ? 0.9 : 0.6),
        transition: `opacity ${FADE_MS}ms ease, filter 200ms ease, background 200ms ease`,
        filter: isFlash ? "brightness(1.25)" : "none",
        background: isFlash
          ? "radial-gradient(55% 55% at 50% 52%, rgba(255,213,74,0.85) 0%, rgba(255,213,74,0.0) 100%)"
          : "radial-gradient(50% 50% at 50% 52%, rgba(102,29,135,0.55) 0%, rgba(102,29,135,0.0) 100%)",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes pulseGlow {
          0%   { transform: translate(-50%, -50%) scale(1);    opacity: 0.42; }
          50%  { transform: translate(-50%, -50%) scale(1.06); opacity: 0.62; }
          100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.42; }
        }
        @keyframes introExpand {
          from { transform: translate(-50%, -50%) scale(0);   opacity: 0.95; }
          to   { transform: translate(-50%, -50%) scale(1.0); opacity: 0.75; }
        }
        @keyframes introFade {
          from { opacity: 0.75; }
          to   { opacity: 0; }
        }
        @keyframes goldExpand {
          from { transform: translate(-50%, -50%) scale(0); }
          to   { transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

// золотая круглая вспышка: большой размер (как у фиолетовой), мягкие края; жёсткий центр R=30
function CircularGoldFlash({ show }: { show: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!show) return;
    const W = 256, H = 256;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const cx = W / 2; const cy = H / 2 + 6;
    const inner = 30;   // жёсткий центр
    const outer = 128;  // ВЕРНУЛИ исходный внешний радиус (как у большой вспышки)
    const gold = { r: 255, g: 213, b: 74 };

    const img = ctx.createImageData(W, H);
    const data = img.data;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const r = Math.hypot(dx, dy);
      let a = 0;
      if (r <= inner) a = 1;
      else {
        const t = clamp((r - inner) / (outer - inner));
        a = 1 - smoothstep(t);
      }
      const i = (y * W + x) * 4;
      data[i+0] = gold.r; data[i+1] = gold.g; data[i+2] = gold.b; data[i+3] = Math.round(a * 255);
    }
    ctx.putImageData(img, 0, 0);
  }, [show]);

  if (!show) return null;
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: 256, height: 256,
        transform: "translate(-50%, -50%) scale(1)",
        opacity: 1,
        transition: `opacity ${FLASH_MS}ms ease-out`,
        pointerEvents: "none",
      }}
    >
      <canvas ref={canvasRef} width={256} height={256} />
    </div>
  );
}

// искры (только при 20)
function Sparks({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    (ctx as any).imageSmoothingEnabled = false;

    const W = 256, H = 256;
    const cx = W / 2, cy = H / 2 + 6;

    // увеличенные параметры (летят дальше/быстрее)
    const N = 42;
    type S = { x:number; y:number; vx:number; vy:number; life:number; };
    const sparks: S[] = [];
    for (let i=0;i<N;i++){
      const ang = Math.random() * Math.PI * 2;
      const speed = 1.3 + Math.random()*2.6; // 1.3..3.9 px/кадр
      sparks.push({ x: cx, y: cy, vx: Math.cos(ang)*speed, vy: Math.sin(ang)*speed, life: 1 });
    }

    const start = performance.now();
    let raf = 0;
    const loop = (t:number) => {
      const k = clamp((t - start) / SPARKS_MS);
      ctx.clearRect(0,0,W,H);
      for (const s of sparks){
        s.vx *= 0.985; s.vy *= 0.985;
        s.x += s.vx;   s.y += s.vy;
        s.life = 1 - k;
        const a = Math.max(0, Math.min(1, s.life));
        ctx.fillStyle = `rgba(255,213,74,${a})`;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      }
      if (k < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas
      ref={ref}
      width={256}
      height={256}
      className="absolute left-1/2 top-1/2"
      style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}
    />
  );
}

/* ===================== ОСНОВНОЙ КОМПОНЕНТ ===================== */

export const D20Overlay: React.FC<D20OverlayProps> = ({
  spinFrames,
  resultFrameDefault,
  resultFrameSpecial,
  value,
  durationMs = SPIN_MS,
  onDone,
}) => {
  const allSrcs = useMemo(() => [...spinFrames, resultFrameDefault, resultFrameSpecial], [spinFrames, resultFrameDefault, resultFrameSpecial]);
  const ready = usePreloadImages(allSrcs);

  const [phase, setPhase] = useState<Phase>("spin");
  const [frame, setFrame] = useState(0);
  const [resultSrc, setResultSrc] = useState(resultFrameDefault);

  const [showIntro, setShowIntro] = useState(false);
  const [showGoldFlash, setShowGoldFlash] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const [sparksActive, setSparksActive] = useState(false);

  const numberCanvasRef = useRef<HTMLCanvasElement>(null);
  const audio = useAudio();

  // Старт: фиолетовая вспышка + пульсация + СПИН (+ старт звука спина)
  useEffect(() => {
    if (!ready) return;
    setShowIntro(true);
    setGlowActive(true);

    // аудио спина
    audio.startSpin();

    const interval = setInterval(() => {
      setFrame(f => (f + 1) % Math.max(1, spinFrames.length));
    }, 60);
    const stop = setTimeout(() => { clearInterval(interval); setPhase("flash"); }, durationMs);
    const hideIntro = setTimeout(() => setShowIntro(false), INTRO_EXPAND_MS + INTRO_FADE_MS);

    return () => { clearInterval(interval); clearTimeout(stop); clearTimeout(hideIntro); audio.stopSpin(); };
  }, [ready, durationMs, spinFrames.length]);

  // ВТОРАЯ (золотая) вспышка: цифра — сразу под ней; звук результата — в этот момент; искры — ТОЛЬКО при 20
  useEffect(() => {
    if (phase !== "flash") return;

    // прекратить звук спина (на всякий случай)
    audio.stopSpin();

    // ассет результата
    setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);

    // отрисовать белую цифру заранее (под маской)
    const c = numberCanvasRef.current;
    if (c) { const ctx = c.getContext("2d"); if (ctx) drawPixelNumber(ctx, value, "#FFFFFF"); }

    // звук результата — в момент вспышки
    const kind = value === 20 ? "crit" : (value === 1 ? "fail" : "normal");
    audio.resultSound(kind as any);

    // вспышка
    setShowGoldFlash(true);

    // искры только при 20
    if (value === 20) setSparksActive(true);

    // снять вспышку → reveal; искры живут дольше и сами погаснут
    const hide = setTimeout(() => {
      setShowGoldFlash(false);
      setPhase("reveal");

      // плавное золочение цифры
      const start = performance.now();
      const gold = { r: 255, g: 213, b: 74 };
      const tintLoop = (t: number) => {
        const k = clamp((t - start) / TINT_MS);
        const r = Math.round(lerp(255, gold.r, k));
        const g = Math.round(lerp(255, gold.g, k));
        const b = Math.round(lerp(255, gold.b, k));
        const cnv = numberCanvasRef.current;
        if (cnv) { const ctx2 = cnv.getContext("2d"); if (ctx2) drawPixelNumber(ctx2, value, `rgb(${r},${g},${b})`); }
        if (k < 1) requestAnimationFrame(tintLoop);
      };
      requestAnimationFrame(tintLoop);

      // выключим слой искр спустя их жизнь
      const stopSparks = setTimeout(() => setSparksActive(false), SPARKS_MS);
      return () => clearTimeout(stopSparks);
    }, FLASH_MS);

    return () => clearTimeout(hide);
  }, [phase, value, resultFrameDefault, resultFrameSpecial]);

  // Пауза результата → fade
  useEffect(() => {
    if (phase !== "reveal") return;
    const hold = setTimeout(() => setPhase("fade"), REVEAL_HOLD_MS);
    return () => clearTimeout(hold);
  }, [phase]);

  // Финальное исчезновение
  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => { setPhase("done"); onDone?.(); }, FADE_MS);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const spinSrc = useMemo(() => spinFrames[frame % Math.max(1, spinFrames.length)], [frame, spinFrames]);

  const NUMBER_SCALE = 3.5; // ≈56px
  const containerOpacity = (phase === "fade" || phase === "done") ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ opacity: containerOpacity, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* Фон-пульсация */}
        <BackgroundGlow active={ready && glowActive} phase={phase} />

        {/* База: спин или результат */}
        {ready && phase === "spin" && <img src={spinSrc} width={128} height={128} alt="d20 spinning" draggable={false} />}
        {ready && phase !== "spin" && <img src={resultSrc} width={128} height={128} alt="d20 result" draggable={false} />}

        {/* Искры (только при 20) */}
        {sparksActive && <Sparks active={sparksActive} />}

        {/* Золотая вспышка */}
        <div
          style={{
            opacity: showGoldFlash ? 1 : 0,
            transition: `opacity ${FLASH_MS}ms ease-out`,
            transformOrigin: "center",
            animation: showGoldFlash ? `goldExpand ${INTRO_EXPAND_MS}ms ease-out forwards` : "none",
          }}
          className="absolute left-1/2 top-1/2"
        >
          <CircularGoldFlash show={showGoldFlash} />
        </div>

        {/* Цифра 16×16: +2px вправо, +6px вниз; масштаб ~56px */}
        {ready && phase !== "spin" && (
          <canvas
            ref={numberCanvasRef}
            width={16}
            height={16}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(calc(-50% + 2px), calc(-50% + 6px)) scale(${NUMBER_SCALE})`,
              imageRendering: "pixelated" as const,
              filter: phase === "reveal" ? "drop-shadow(0 0 6px rgba(255,215,0,0.85))" : "none",
              transition: "filter 250ms ease",
            }}
          />
        )}

        {/* Фиолетовая стартовая вспышка — верхний слой при старте */}
        <IntroPurpleFlash show={ready && showIntro} />
      </div>
    </div>
  );
};
