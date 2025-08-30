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
  valu
