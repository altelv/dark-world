import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

/**
 * Исправлено:
 * - Спин по таймеру: 0.06с/кадр, длится ровно 2000мс.
 * - Вспышка: белая маска выходит за границы ассета (192×192) и
 *   с полностью непрозрачным квадратом 20×20, центр смещён на +6px вниз,
 *   дальше плавный фейд к прозрачности.
 * - Результат и цифра подставляются ПОД вспышкой.
 * - Цифра меньше на 5px (≈59px вместо 64px), золотеет, затем всё исчезает.
 */
export interface D20OverlayProps {
  spinFrames: string[];          // 4 кадра, 128×128
  resultFrameDefault: string;    // PNG 128×128
  resultFrameSpecial: string;    // PNG для {1,3,5,6,8,10,13,18}
  value: number;                 // 1..20
  durationMs?: number;           // длительность спина, по умолчанию 2000
  onDone?: () => void;
}

const SPECIAL_SET = new Set([1,3,5,6,8,10,13,18]);

type Phase = "spin" | "flash" | "reveal" | "gold" | "fade" | "done";

// внутренняя маска-вспышка: рисует квадрат 20×20 с жёсткой сердцевиной и перьём до краёв
function FlashMask({
  visible,
  lifetimeMs = 220,
}: { visible: boolean; lifetimeMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const W = 192, H = 192;           // больше ассета 128×128, чтобы фейд ушёл за края
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    // центр соответствует центру ассета 128×128, но сам холст больше на 32px с каждой стороны
    const cx = W / 2;                 // 96
    const cy = H / 2 + 6;             // 96 + 6 = 102 (смещение вниз на 6px)
    const halfHard = 10;              // половина стороны жёсткого квадрата 20×20
    const fadeEnd = 96;               // до края холста (больше, чем край ассета)

    const img = ctx.createImageData(W, H);
    const data = img.data;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);
        const dInf = Math.max(dx, dy);           // «квадратная» метрика L∞
        let a = 0;
        if (dInf <= halfHard) {
          a = 1; // центр 20×20 полностью непрозрачен
        } else {
          const t = Math.min(1, Math.max(0, (dInf - halfHard) / (fadeEnd - halfHard)));
          a = 1 - t; // линейный фейд к 0
        }
        const i = (y * W + x) * 4;
        data[i + 0] = 255; // белая
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [visible]);

  if (!visible) return null;
  return (
    <div
      className="absolute"
      style={{
        // расширяем холст за пределы 128×128: отступаем на 32px наружу
        left: -32, top: -32, width: 192, height: 192,
        opacity: 1, transition: `opacity ${lifetimeMs}ms ease-out`,
        // opacity анимируется снаружи (родителем), здесь просто холст
      }}
    >
      <canvas ref={canvasRef} width={192} height={192} />
    </div>
  );
}

export const D20Overlay: React.FC<D20OverlayProps> = ({
  spinFrames,
  resultFrameDefault,
  resultFrameSpecial,
  value,
  durationMs = 2000, // по твоему запросу — 2 секунды
  onDone,
}) => {
  const [phase, setPhase] = useState<Phase>("spin");
  const [frame, setFrame] = useState(0);
  const [resultSrc, setResultSrc] = useState(resultFrameDefault);
  const [flashVisible, setFlashVisible] = useState(false);
  const numberCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── СПИН: интервал 60мс, суммарно durationMs
  useEffect(() => {
    if (phase !== "spin") return;
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % Math.max(1, spinFrames.length));
    }, 60);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setPhase("flash");
    }, durationMs);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [phase, durationMs, spinFrames.length]);

  // ── FLASH: сразу подменяем ассет на результат и рисуем число ПОД вспышкой
  useEffect(() => {
    if (phase !== "flash") return;
    setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);

    // рисуем белое число, которое позже «позолотеет»
    const c = numberCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) drawPixelNumber(ctx, value, "#FFFFFF");
    }

    // показать маску и спрятать смену ассета/цифры
    setFlashVisible(true);
    const hide = setTimeout(() => {
      setFlashVisible(false);
      setPhase("reveal");
    }, 220); // длительность вспышки
    return () => clearTimeout(hide);
  }, [phase, value, resultFrameDefault, resultFrameSpecial]);

  // ── REVEAL: держим секунду и уходим в gold
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => setPhase("gold"), 1000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── GOLD: перекрашиваем число и добавляем свечение
  useEffect(() => {
    if (phase !== "gold") return;
    const c = numberCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) drawPixelNumber(ctx, value, "#FFD54A"); // золотистая
    }
    const t = setTimeout(() => setPhase("fade"), 600);
    return () => clearTimeout(t);
  }, [phase, value]);

  // ── FADE: исчезаем и завершаем
  useEffect(() => {
    if (phase !== "fade") return;
    const t = setTimeout(() => { setPhase("done"); onDone?.(); }, 450);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const spinSrc = useMemo(() => spinFrames[frame % Math.max(1, spinFrames.length)], [frame, spinFrames]);

  // масштаб цифры: 16*4=64, нужно меньше на 5px ⇒ 59/16 = 3.6875
  const NUMBER_SCALE = 3.6875;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{
        opacity: phase === "fade" || phase === "done" ? 0 : 1,
        transition: "opacity 450ms ease",
      }}
    >
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* base image */}
        {phase === "spin" && <img src={spinSrc} width={128} height={128} alt="d20 spinning" />}
        {phase !== "spin" && <img src={resultSrc} width={128} height={128} alt="d20 result" />}

        {/* ВСПЫШКА-МАСКА: больше ассета, мягкие края, жёсткий центр 20×20 */}
        <div
          style={{
            opacity: flashVisible ? 1 : 0,
            transition: "opacity 220ms ease-out",
          }}
        >
          <FlashMask visible={flashVisible} lifetimeMs={220} />
        </div>

        {/* 16×16 число, центр на 6px ниже, меньше на 5px и со свечением в GOLD */}
        {phase !== "spin" && (
          <canvas
            ref={numberCanvasRef}
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
    </div>
  );
};
