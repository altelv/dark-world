import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

/**
 * Текущее поведение:
 * - Старт: фиолетовая вспышка (0.12с раздув + 0.28с уход), одновременно включаются спин и пульсация.
 * - Спин: 3.0с, кадр каждые 60мс, с прелоадом.
 * - Золотая вспышка (уменьшенный внешний радиус −15%): «миг» 0.18с.
 * - Цифра появляется одновременно со вспышкой (под ней), смещена +2px вправо, +6px вниз, масштаб ~56px.
 * - Искры: больше штук, быстрее старт, меньше затухание на кадр → летят дальше; живут дольше вспышки.
 * - Цифра плавно золотится 0.9с; пауза результата 2.6с; общий fade 1.7с.
 */

export interface D20OverlayProps {
  spinFrames: string[];          // 4 кадра, 128×128
  resultFrameDefault: string;    // PNG 128×128
  resultFrameSpecial: string;    // PNG для {1,3,5,6,8,10,13,18}
  value: number;                 // 1..20
  durationMs?: number;           // длительность спина (по умолчанию 3000)
  onDone?: () => void;
}

const SPECIAL_SET = new Set([1,3,5,6,8,10,13,18]);

type Phase = "spin" | "flash" | "reveal" | "fade" | "done";

// Тайминги
const INTRO_EXPAND_MS = 120;      // фиолетовая стартовая вспышка — раздувание
const INTRO_FADE_MS   = 280;      // и уход
const SPIN_MS         = 3000;     // спин
const FLASH_MS        = 180;      // золотая вспышка — «миг»
const REVEAL_HOLD_MS  = 2600;     // пауза после результата
const TINT_MS         = 900;      // белый → золото
const FADE_MS         = 1700;     // финальное исчезновение
const PULSE_MS        = 2600;     // пульсация
const SPARKS_MS       = 1600;     // искры живут дольше вспышки

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
      img.decoding = "async";
      img.src = src;
      // @ts-ignore
      if (img.decode) img.decode().then(done).catch(done);
    }))).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [JSON.stringify(srcs)]);
  return ready;
}

// Круглая золотая вспышка (маска 256×256, центр смещён +6px по Y)
// Внешний радиус уменьшен на 15% (128 → ~109)
function CircularGoldFlash({ show }: { show: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!show) return;
    const W = 256, H = 256;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const cx = W / 2; const cy = H / 2 + 6; // центр ниже на 6px
    const inner = 30;                        // R=30px — жёсткий центр
    const outerBase = 128;
    const outer = Math.round(outerBase * 0.85); // −15% по запросу
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

// Пиксельные искры (канвас 256×256)
function Sparks({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    (ctx as any).imageSmoothingEnabled = false;

    const W = 256, H = 256;
    const cx = W / 2, cy = H / 2 + 6;

    // БОЛЬШЕ искр, БЫСТРЕЕ старт, МЕНЬШЕ затухание скорости — ЛЕТЯТ ДАЛЬШЕ
    const N = 42; // было 26
    type S = { x:number; y:number; vx:number; vy:number; life:number; };
    const sparks: S[] = [];
    for (let i=0;i<N;i++){
      const ang = Math.random() * Math.PI * 2;
      const speed = 1.3 + Math.random()*2.6; // было 0.6..2.2 → теперь 1.3..3.9 px/кадр
      sparks.push({
        x: cx, y: cy,
        vx: Math.cos(ang)*speed,
        vy: Math.sin(ang)*speed,
        life: 1,
      });
    }

    const start = performance.now();
    let raf = 0;
    const loop = (t:number) => {
      const dt = t - start;
      const k = clamp(dt / SPARKS_MS);

      ctx.clearRect(0,0,W,H);

      for (const s of sparks){
        // более мягкое торможение (было 0.96) → дальше улетают
        s.vx *= 0.985; s.vy *= 0.985;
        s.x += s.vx;   s.y += s.vy;

        // яркость гаснет медленно и равномерно
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

// Фоновая пульсация (синхронно со спином)
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

// Фиолетовая стартовая вспышка над всем
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

  // Старт: фиолетовая вспышка + включение пульсации + спин
  useEffect(() => {
    if (!ready) return;
    setShowIntro(true);
    setGlowActive(true);

    const interval = setInterval(() => {
      setFrame(f => (f + 1) % Math.max(1, spinFrames.length));
    }, 60);
    const stop = setTimeout(() => { clearInterval(interval); setPhase("flash"); }, durationMs);
    const hideIntro = setTimeout(() => setShowIntro(false), INTRO_EXPAND_MS + INTRO_FADE_MS);

    return () => { clearInterval(interval); clearTimeout(stop); clearTimeout(hideIntro); };
  }, [ready, durationMs, spinFrames.length]);

  // GOLD FLASH: цифра появляется сразу под маской, вспышка и искры стартуют вместе
  useEffect(() => {
    if (phase !== "flash") return;
    setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);

    // белое число сразу (под вспышкой)
    const c = numberCanvasRef.current;
    if (c) { const ctx = c.getContext("2d"); if (ctx) drawPixelNumber(ctx, value, "#FFFFFF"); }

    setShowGoldFlash(true);
    setSparksActive(true);

    // убрать вспышку → reveal; искры живут дольше
    const hide = setTimeout(() => {
      setShowGoldFlash(false);
      setPhase("reveal");

      // плавное золочение цифры
      const start = performance.now();
      const gold = { r: 255, g: 213, b: 74 };
      const tintLoop = (t: number) => {
        const dt = t - start;
        const k = clamp(dt / TINT_MS);
        const r = Math.round(lerp(255, gold.r, k));
        const g = Math.round(lerp(255, gold.g, k));
        const b = Math.round(lerp(255, gold.b, k));
        const cnv = numberCanvasRef.current;
        if (cnv) { const ctx2 = cnv.getContext("2d"); if (ctx2) drawPixelNumber(ctx2, value, `rgb(${r},${g},${b})`); }
        if (k < 1) requestAnimationFrame(tintLoop);
      };
      requestAnimationFrame(tintLoop);
    }, FLASH_MS);

    const stopSparks = setTimeout(() => setSparksActive(false), SPARKS_MS);

    return () => { clearTimeout(hide); clearTimeout(stopSparks); };
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

  // Масштаб цифры: ~56px → 56/16 = 3.5
  const NUMBER_SCALE = 3.5;

  const containerOpacity = (phase === "fade" || phase === "done") ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ opacity: containerOpacity, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* Фон-пульсация */}
        <BackgroundGlow active={glowActive} phase={phase} />

        {/* База: спин или результат */}
        {ready && phase === "spin" && <img src={spinSrc} width={128} height={128} alt="d20 spinning" draggable={false} />}
        {ready && phase !== "spin" && <img src={resultSrc} width={128} height={128} alt="d20 result" draggable={false} />}

        {/* Искры */}
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

        {/* Число 16×16, смещение: +2px вправо, +6px вниз; масштаб ~56px */}
        {ready && phase !== "spin" && (
          <canvas
            ref={numberCanvasRef}
            width={16}
            height={16}
            className="absolute left-1/2 top-1/2"
            style={{
              transform: `translate(calc(-50% + 2px), calc(-50% + 6px)) scale(3.5)`,
              imageRendering: "pixelated" as const,
              filter: phase === "reveal" ? "drop-shadow(0 0 6px rgba(255,215,0,0.85))" : "none",
              transition: "filter 250ms ease",
            }}
          />
        )}

        {/* Фиолетовая стартовая вспышка — верхний слой при старте */}
        <IntroPurpleFlash show={showIntro} />
      </div>
    </div>
  );
};
