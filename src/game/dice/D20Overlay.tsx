import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

/**
 * Исправления:
 * - реальная смена кадров (requestAnimationFrame), 0.06с/кадр;
 * - “белая вспышка” на 180мс полностью накрывает ассет, чтобы скрыть подстановку цифры;
 * - цифра меньше на 5px (64→59px) и всё так же на 6px ниже центра;
 * - “позолота” цифры и затем плавное исчезание всей композиции;
 */
export interface D20OverlayProps {
  spinFrames: string[];          // 4 кадра, 128×128
  resultFrameDefault: string;    // PNG 128×128
  resultFrameSpecial: string;    // PNG для {1,3,5,6,8,10,13,18}
  value: number;                 // 1..20
  durationMs?: number;           // длительность спина, по умолчанию 1500
  onDone?: () => void;
}

const SPECIAL_SET = new Set([1,3,5,6,8,10,13,18]);

type Phase = "spin" | "flash" | "reveal" | "gold" | "fade" | "done";

export const D20Overlay: React.FC<D20OverlayProps> = ({
  spinFrames,
  resultFrameDefault,
  resultFrameSpecial,
  value,
  durationMs = 1500,
  onDone,
}) => {
  const [phase, setPhase] = useState<Phase>("spin");
  const [frame, setFrame] = useState(0);
  const [resultSrc, setResultSrc] = useState(resultFrameDefault);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── СПИН (смена кадров каждые 60мс)
  useEffect(() => {
    if (phase !== "spin") return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      const elapsed = t - start;
      const idx = Math.floor(elapsed / 60) % spinFrames.length;
      setFrame(idx);
      if (elapsed >= durationMs) {
        setPhase("flash");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, durationMs, spinFrames.length]);

  // ── FLASH (полное укрытие → рисуем цифру → убираем вспышку)
  useEffect(() => {
    if (phase !== "flash") return;
    // выбираем спрайт результата заранее
    setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);

    // РИСУЕМ ЦИФРУ ПОД ВСПЫШКОЙ (через микро-задержку)
    const t1 = setTimeout(() => {
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) drawPixelNumber(ctx, value, "#FFFFFF");
      }
    }, 50);

    // закрываем фазу вспышки
    const t2 = setTimeout(() => setPhase("reveal"), 180);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, value, resultFrameDefault, resultFrameSpecial]);

  // ── REVEAL (держим результат, потом “позолота”)
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => setPhase("gold"), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  // ── GOLD (перекрашиваем цифру в золото и даём свечение)
  useEffect(() => {
    if (phase !== "gold") return;
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) drawPixelNumber(ctx, value, "#FFD54A"); // золотистая
    }
    const t = setTimeout(() => setPhase("fade"), 600);
    return () => clearTimeout(t);
  }, [phase, value]);

  // ── FADE (исчезновение всей композиции)
  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => { setPhase("done"); onDone?.(); }, 450);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const spinSrc = useMemo(() => spinFrames[frame % spinFrames.length], [frame, spinFrames]);

  // масштаб цифры: 16*4=64, нужно меньше на 5px => 59/16 = 3.6875
  const NUMBER_SCALE = 3.6875;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ opacity: phase === "fade" || phase === "done" ? 0 : 1, transition: "opacity 450ms ease" }}
    >
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* base image */}
        {phase === "spin" && <img src={spinSrc} width={128} height={128} alt="d20 spinning" />}
        {phase !== "spin" && <img src={resultSrc} width={128} height={128} alt="d20 result" />}

        {/* Полная маска-вспышка (накрывает всё на 180мс) */}
        {phase === "flash" && (
          <div
            className="absolute inset-0"
            style={{
              background: "rgba(255,255,255,1)",
              animation: "flashOut 180ms ease-out forwards",
            }}
          />
        )}

        {/* 16×16 число, центр на 6px ниже, масштаб уменьшен на 5px */}
        {phase !== "spin" && (
          <canvas
            ref={canvasRef}
            width={16}
            height={16}
            className="absolute left-1/2 top-1/2 -translate-x-1/2"
            style={{
              transform: `translate(-50%, calc(-50% + 6px)) scale(${NUMBER_SCALE})`,
              imageRendering: "pixelated" as const,
              filter: phase === "gold" ? "drop-shadow(0 0 6px rgba(255,215,0,0.9))" : "none",
              transition: "filter 250ms ease",
            }}
          />
        )}
      </div>

      {/* Локальные keyframes, без Tailwind-плагинов */}
      <style>{`
        @keyframes flashOut { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
    </div>
  );
};
