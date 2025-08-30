import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

/**
 * Исправления/добавления:
 * - Прелоад всех спрайтов (спин + результаты), чтобы анимация была стабильной.
 * - Спин: 2.0 c, смена кадров каждые 60мс.
 * - Вспышка: круглая золотая маска (радиальная), центр R=30px полностью непрозрачный,
 *   дальше плавный фейд (smoothstep) к краям; холст маски больше ассета (192×192), чтобы уйти за границы.
 * - Результат и цифра подставляются ПОД вспышкой и видны уже после её схлопывания.
 * - Фон-свечение (#661d87) под всей анимацией: пульсация; на фазе flash — золотой «взрыв»; затем плавное затухание.
 * - Цифра: сразу после вспышки — белая; затем плавная перекраска в золото ~900мс; потом общий fade дольше.
 * - Цифра меньше ~на 5px: масштаб 3.6875 (≈59px вместо 64px). Центр на 6px ниже.
 */

export interface D20OverlayProps {
  spinFrames: string[];          // 4 кадра, 128×128
  resultFrameDefault: string;    // PNG 128×128
  resultFrameSpecial: string;    // PNG для {1,3,5,6,8,10,13,18}
  value: number;                 // 1..20
  durationMs?: number;           // длительность спина (по умолчанию 2000)
  onDone?: () => void;
}

const SPECIAL_SET = new Set([1,3,5,6,8,10,13,18]);

type Phase = "spin" | "flash" | "reveal" | "fade" | "done";

// ——— Тайминги (под твоё ТЗ) ———
const SPIN_MS = 2000;            // длительность спина
const FLASH_MS = 280;            // длительность вспышки/маски
const REVEAL_HOLD_MS = 1600;     // пауза после появления результата (чуть дольше)
const TINT_MS = 900;             // плавная перекраска цифры из белого в золото
const FADE_MS = 900;             // более длинное общее исчезновение

// ——— Утилиты ———
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(t: number, lo=0, hi=1) { return Math.max(lo, Math.min(hi, t)); }
function smoothstep(t: number) { t = clamp(t); return t * t * (3 - 2 * t); } // мягкий фейд

function usePreloadImages(srcs: string[]) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const unique = Array.from(new Set(srcs.filter(Boolean)));
    Promise.all(unique.map(src => new Promise<void>(res => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res(); // не ломаем анимацию при ошибке
      img.src = src;
    }))).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [JSON.stringify(srcs)]);
  return ready;
}

// Круглая золотая вспышка-маска (канвас 192×192, центр смещён на +6px по Y)
function CircularFlashMask({ show }: { show: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!show) return;
    const W = 192, H = 192;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const cx = W / 2;       // 96
    const cy = H / 2 + 6;   // смещение на 6px вниз
    const inner = 30;       // R=30px — полностью непрозрачный центр
    const outer = 96;       // к краю холста уходим в 0

    const img = ctx.createImageData(W, H);
    const data = img.data;

    const gold = { r: 255, g: 213, b: 74 };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        let a = 0;
        if (r <= inner) {
          a = 1;
        } else {
          const t = clamp((r - inner) / (outer - inner));
          a = 1 - smoothstep(t);
        }
        const i = (y * W + x) * 4;
        data[i + 0] = gold.r;
        data[i + 1] = gold.g;
        data[i + 2] = gold.b;
        data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [show]);

  if (!show) return null;
  return (
    <div
      className="absolute"
      style={{
        left: -32, top: -32, width: 192, height: 192,
        opacity: 1, transition: `opacity ${FLASH_MS}ms ease-out`,
      }}
    >
      <canvas ref={canvasRef} width={192} height={192} />
    </div>
  );
}

// Фоновое свечение под всей анимацией
function BackgroundGlow({ phase }: { phase: Phase }) {
  // базовый цвет: #661d87, на flash добавим золотой всплеск
  const isFlash = phase === "flash";
  const isFading = phase === "fade" || phase === "done";

  return (
    <div
      className="absolute -inset-8 rounded-[24px]"
      style={{
        // Пульсация масштаба/прозрачности
        animation: `pulseGlow 1200ms ease-in-out infinite`,
        opacity: isFading ? 0 : (isFlash ? 0.9 : 0.55),
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
          0%   { transform: scale(1);   opacity: 0.40; }
          50%  { transform: scale(1.06); opacity: 0.60; }
          100% { transform: scale(1);   opacity: 0.40; }
        }
      `}</style>
    </div>
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
  const allSrcs = useMemo(
    () => [...spinFrames, resultFrameDefault, resultFrameSpecial],
    [spinFrames, resultFrameDefault, resultFrameSpecial]
  );
  const ready = usePreloadImages(allSrcs);

  const [phase, setPhase] = useState<Phase>("spin");
  const [frame, setFrame] = useState(0);
  const [resultSrc, setResultSrc] = useState(resultFrameDefault);
  const [showFlash, setShowFlash] = useState(false);
  const numberCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── СПИН: только когда спрайты загружены
  useEffect(() => {
    if (!ready || phase !== "spin") return;
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % Math.max(1, spinFrames.length));
    }, 60);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setPhase("flash");
    }, durationMs);
    return () => { clearInterval(interval); clearTimeout(stop); };
  }, [ready, phase, durationMs, spinFrames.length]);

  // ── FLASH: под вспышкой подставляем ассет результата и рисуем белую цифру
  useEffect(() => {
    if (phase !== "flash") return;
    setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);

    // Белое число (под вспышкой)
    const c = numberCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) drawPixelNumber(ctx, value, "#FFFFFF");
    }

    // Показать маску, затем убрать → перейти к reveal
    setShowFlash(true);
    const hide = setTimeout(() => {
      setShowFlash(false);
      setPhase("reveal");
    }, FLASH_MS);
    return () => clearTimeout(hide);
  }, [phase, value, resultFrameDefault, resultFrameSpecial]);

  // ── REVEAL: держим подольше, параллельно плавно перекрашиваем цифру (TINT_MS)
  useEffect(() => {
    if (phase !== "reveal") return;

    // Плавная перекраска: белый → золото (#FFD54A)
    const start = performance.now();
    const gold = { r: 255, g: 213, b: 74 };
    const loop = (t: number) => {
      const dt = t - start;
      const k = clamp(dt / TINT_MS);
      const r = Math.round(lerp(255, gold.r, k));
      const g = Math.round(lerp(255, gold.g, k));
      const b = Math.round(lerp(255, gold.b, k));
      const c = numberCanvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) drawPixelNumber(ctx, value, `rgb(${r},${g},${b})`);
      }
      if (k < 1) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const hold = setTimeout(() => setPhase("fade"), REVEAL_HOLD_MS);
    return () => clearTimeout(hold);
  }, [phase, value]);

  // ── FADE: общее исчезновение + завершение
  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => { setPhase("done"); onDone?.(); }, FADE_MS);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const spinSrc = useMemo(
    () => spinFrames[frame % Math.max(1, spinFrames.length)],
    [frame, spinFrames]
  );

  // Масштаб цифры: 16*4=64 → нужно примерно 59px → 59/16 = 3.6875
  const NUMBER_SCALE = 3.6875;

  // Общий fade контейнера
  const containerOpacity = (phase === "fade" || phase === "done") ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ opacity: containerOpacity, transition: `opacity ${FADE_MS}ms ease` }}
    >
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* Фон-свечение под всей сценой */}
        <BackgroundGlow phase={phase} />

        {/* База: спин или готовый ассет */}
        {ready && phase === "spin" && <img src={spinSrc} width={128} height={128} alt="d20 spinning" />}
        {ready && phase !== "spin" && <img src={resultSrc} width={128} height={128} alt="d20 result" />}

        {/* Круглая золотая вспышка-маска поверх (уйдёт за края ассета) */}
        <div style={{ opacity: showFlash ? 1 : 0, transition: `opacity ${FLASH_MS}ms ease-out` }}>
          <CircularFlashMask show={showFlash} />
        </div>

        {/* Число 16×16, центр на +6px по Y, уменьшено до ~59px, с пиксельным рендерингом */}
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
      </div>
    </div>
  );
};
