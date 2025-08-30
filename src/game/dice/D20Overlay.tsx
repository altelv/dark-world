import React, { useEffect, useMemo, useRef, useState } from "react";
import { drawPixelNumber } from "./PixelDigits";

export interface D20OverlayProps {
  spinFrames: string[]; // 4 frames, 128×128
  resultFrameDefault: string; // PNG 128×128
  resultFrameSpecial: string; // PNG for {1,3,5,6,8,10,13,18}
  value: number; // 1..20
  durationMs?: number; // default 1500
  onDone?: () => void;
}

const SPECIAL_SET = new Set([1,3,5,6,8,10,13,18]);

export const D20Overlay: React.FC<D20OverlayProps> = ({ spinFrames, resultFrameDefault, resultFrameSpecial, value, durationMs = 1500, onDone }) => {
  const [phase, setPhase] = useState<"spin" | "reveal" | "gold" | "done">("spin");
  const [frame, setFrame] = useState(0);
  const [resultSrc, setResultSrc] = useState(resultFrameDefault);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // spin animation
  useEffect(() => {
    if (phase !== "spin") return;
    const interval = 60; // 0.06s
    const id = setInterval(() => setFrame(f => (f + 1) % spinFrames.length), interval);
    const t = setTimeout(() => setPhase("reveal"), durationMs);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [phase, durationMs, spinFrames.length]);

  // pick result frame on reveal
  useEffect(() => {
    if (phase === "reveal") {
      setResultSrc(SPECIAL_SET.has(value) ? resultFrameSpecial : resultFrameDefault);
      // draw pixel number slightly below center
      const c = canvasRef.current; if (c) {
        const ctx = c.getContext("2d"); if (ctx) {
          drawPixelNumber(ctx, value, "#FFFFFF");
        }
      }
      const t = setTimeout(() => setPhase("gold"), 2000);
      return () => clearTimeout(t);
    }
    if (phase === "gold") {
      const t = setTimeout(() => { setPhase("done"); onDone?.(); }, 600);
      return () => clearTimeout(t);
    }
  }, [phase, value, onDone]);

  const spinSrc = useMemo(() => spinFrames[frame % spinFrames.length], [frame, spinFrames]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative" style={{ width: 128, height: 128, imageRendering: "pixelated" as const }}>
        {/* base image */}
        {phase === "spin" && (
          <img src={spinSrc} width={128} height={128} alt="d20 spinning" />
        )}
        {phase !== "spin" && (
          <img src={resultSrc} width={128} height={128} alt="d20 result" />
        )}
        {/* flash mask on reveal */}
        {phase === "reveal" && (
          <div className="absolute inset-0 animate-[flash_200ms_ease-out_1]" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.0) 60%)" }} />
        )}
        {/* 16×16 number, centered and 6px lower than center */}
        {phase !== "spin" && (
          <canvas
            ref={canvasRef}
            width={16}
            height={16}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 ${phase === "gold" ? "text-yellow-400" : ""}`}
            style={{ transform: "translate(-50%, calc(-50% + 6px)) scale(4)", imageRendering: "pixelated" as const, filter: phase === "gold" ? "drop-shadow(0 0 6px rgba(255,215,0,0.9))" : undefined }}
          />
        )}
      </div>
      <style>{`
        @keyframes flash { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </div>
  );
};
