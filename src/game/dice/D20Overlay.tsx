import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

/**
 * Что добавлено/исправлено:
 * - Прелоад всех спрайтов (стабильная анимация без пропаданий).
 * - Старт с фиолетовой вспышки (#661d87) поверх всего: быстрое «раздувание» 0.12с и плавный уход.
 * - Пульсация фона стартует С ОДНОГО МОМЕНТА со спином (не раньше).
 * - Спин 3.0с, кадр каждые 60мс.
 * - Золотая круглая вспышка (256×256, чтобы края не обрезало), жёсткий центр R=30px, мягкий smoothstep-фейд.
 * - Результат и цифра появляются ПОСЛЕ золотой вспышки (не «под» ней).
 * - Цифра из белого плавно золотится 900мс; удержание результата дольше; общий fade дольше.
 * - Цифра меньше ~на 5px (масштаб 3.6875), центр на 6px ниже.
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

// ——— Тайминги ———
const INTRO_EXPAND_MS = 120;      // фиолетовая стартовая вспышка — раздувание
const INTRO_FADE_MS   = 280;      // и уход
const SPIN_MS         = 3000;     // спин по запросу
const FLASH_MS        = 320;      // золотая вспышка при показе результата
const REVEAL_HOLD_MS  = 2200;     // пауза после результата — дольше
const TINT_MS         = 900;      // белый → золото
const FADE_MS         = 1400;     // финальное исчезновение — дольше
const PULSE_MS        = 2200;     // более медленная пульсация фона

// ——— Утилиты ———
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
      // доп. гарантия
      // @ts-ignore
      if (img.decode) img.decode().then(done).catch(done);
    }))).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [JSON.stringify(srcs)]);
  return ready;
}

// Круглая золотая вспышка-маска (канвас 256×256, чтобы не резало по краям)
function CircularFlashMask({ show }: { show: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!show) return;
    const W = 256, H = 256;
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    const cx = W / 2; const cy = H / 2 + 6; // смещение центра на +6px по Y
    const inner = 30; // R=30px — жёсткий центр
    const outer = 128; // мягкий фейд до краёв
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
      className="absolute"
      style={{
        left: -64, top: -64, width: 256, height: 256, // больше 128×128
        opacity: 1, transition: `opacity ${FLASH_MS}ms ease-out`,
      }}
    >
      <canvas ref={canvasRef} width={256} height={256} />
    </div>
  );
}

// Фоновое свечение (пульсация) — стартует одновременно со спином
function BackgroundGlow({ active, phase }: { active: boolean; phase: Phase }) {
  const isFading = phase === "fade" || phase === "done";
  const isFlash = phase === "flash";
  return (
    <div
      className="absolute -inset-10 rounded-[24px]"
      style={{
        display: active ? "block" : "none",
        animation: `pulseGlow ${PULSE_MS}ms ease-in-out infinite`,
        opacity: isFading ? 0 : (isFlash ? 0.9 : 0.6),
        transition: `opacity ${FADE_MS}ms ease, filter 220ms ease, background 220ms ease`,
        filter: isFlash ? "brightness(1.25)" : "none",
        background: isFlash
          ? "radial-gradient(55% 55% at 50% 52%, rgba(255,213,74,0.85) 0%, rgba(255,213,74,0.0) 100%)"
          : "radial-gradient(50% 50% at 50% 52%, rgba(102,29,135,0.55) 0%, rgba(102,29,135,0.0) 100%)",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes pulseGlow {
          0%   { transform: scale(1);    opacity: 0.42; }
          50%  { transform: scale(1.06); opacity: 0.62; }
          100% { transform: scale(1);    opacity: 0.42; }
        }
        @keyframes introExpand {
          from { transform: translate(-50%, -50%) scale(0);   opacity: 0.95; }
          to   { transform: translate(-50%, -50%) scale(1.0); opacity: 0.75; }
        }
        @keyframes introFade {
          from { opacity: 0.75; }
          to   { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Фиолетовая стартовая вспышка над всем (раздувание 0.12с + плавный уход)
function IntroPurpleFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: 256, height: 256,
        transform: "translate(-50%, -50%) scale(1)",
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

  const [phase, setPhase] = useState<Phase>("spin"); // логическая фаза броска
  const [frame, setFrame] = useState(0);
  const [resultSrc, setResultSrc] = useState(resultFrameDefault);
  const [showIntro, setShowIntro] = useState(false);  // фиолетовая вспышка
  const [showGoldFlash, setShowGoldFlash] = useState(false);
  const [glowActive, setGlowActive] = useState(false); // пульсация включена со спином
  const numberCanvasRef = useRef<HTMLCanvasElement>(null);

  // Старт: как только всё готово — включаем фиолетовую вспышку И спин одновременно
  useEffect(() => {
    if (!ready) return;
    // показать фиолетовую вспышку (она верхним слоем), одновременно включить фон-пульсацию и спин
    setShowIntro(true);
    setGlowActive(true);

    // спин (60мс/кадр) — 3s
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % Math.max(1, spinFrames.length));
    }, 60);
    const stop = setTimeout(() => { clearInterval(interval); setPhase("flash"); }, durationMs);

    // спрятать фиолетовую вспышку после её анимации
    const hideIntro = setTimeout(() => setShowIntro(false), INTRO_EXPAND_MS + INTRO_FADE_MS);

    return () => { clearInterval(interval); clearTimeout(stop); clearTimeout(hideIntro); };
  }, [ready, durationMs, spinFrames.length]);

  // GOLD FLASH: под ней подменяем ассет результата, но цифру РИСУЕМ ПОСЛЕ вспышки
  useEffect(() => {
    if (phase !== "flash") return;
    setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);

    // показать золотую маску
    setShowGoldFlash(true);
    // убрать маску и перейти в reveal
    const hide = setTimeout(() => {
      setShowGoldFlash(false);
      setPhase("reveal");

      // ← сразу после снятия вспышки рисуем белое число
      const c = numberCanvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) drawPixelNumber(ctx, value, "#FFFFFF");
      }
      // и запускаем плавное золочение
      const start = performance.now();
      const gold = { r: 255, g: 213, b: 74 };
      const tintLoop = (t: number) => {
        const dt = t - start;
        const k = clamp(dt / TINT_MS);
        const r = Math.round(lerp(255, gold.r, k));
        const g = Math.round(lerp(255, gold.g, k));
        const b = Math.round(lerp(255, gold.b, k));
        const cnv = numberCanvasRef.current;
        if (cnv) {
          const ctx2 = cnv.getContext("2d");
          if (ctx2) drawPixelNumber(ctx2, value, `rgb(${r},${g},${b})`);
        }
        if (k < 1) requestAnimationFrame(tintLoop);
      };
      requestAnimationFrame(tintLoop);
    }, FLASH_MS);

    return () => clearTimeout(hide);
  }, [phase, value, resultFrameDefault, resultFrameSpecial]);

  // Держим результат и уходим в fade
  useEffect(() => {
    if (phase !== "reveal") return;
    const hold = setTimeout(() => setPhase("fade"), REVEAL_HOLD_MS);
    return () => clearTimeout(hold);
  }, [phase]);

  // Финальное исчезновение + завершение
  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => { setPhase("done"); onDone?.(); }, FADE_MS);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const spinSrc = useMemo(() => spinFrames[frame % Math.max(1, spinFrames.length)], [frame, spinFrames]);

  const NUMBER_SCALE = 3.6875; // ~59px

  const containerOpacity = (phase === "fade" || phase === "done") ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ opacity: containerOpacity, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* Фон-пульсация — стартует одновременно со спином */}
        <BackgroundGlow active={glowActive} phase={phase} />

        {/* База: спин или готовый ассет */}
        {ready && phase === "spin" && <img src={spinSrc} width={128} height={128} alt="d20 spinning" />}
        {ready && phase !== "spin" && <img src={resultSrc} width={128} height={128} alt="d20 result" />}

        {/* Золотая круглая вспышка (поверх), мягкие края, центр R=30 */}
        <div style={{ opacity: showGoldFlash ? 1 : 0, transition: `opacity ${FLASH_MS}ms ease-out` }}>
          <CircularFlashMask show={showGoldFlash} />
        </div>

        {/* Число 16×16, центр на +6px, масштаб ~59px */}
        {ready && phase !== "spin" && (
          <canvas
            ref={numberCanvasRef}
            width={16}
            height={16}
            className="absolute left-1/2 top-1/2 -translate-x-1/2"
            style={{
              transform: `translate(-50%, calc(-50% + 6px)) scale(${NUMBER_SCALE})`,
              imageRendering: "pixelated" as const,
              filter: phase === "reveal" ? "drop-shadow(0 0 6px rgba(255,215,0,0.85))" : "none",
              transition: "filter 250ms ease",
            }}
          />
        )}

        {/* Фиолетовая стартовая вспышка (самый верхний слой) */}
        <IntroPurpleFlash show={showIntro} />
      </div>
    </div>
  );
};
