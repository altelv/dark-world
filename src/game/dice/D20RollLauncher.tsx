import React, { useEffect, useRef, useState } from 'react';
export function D20RollLauncher({ value, onDone }:{ value:number; onDone:()=>void }){
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const [phase, setPhase] = useState<'spin'|'reveal'|'done'>('spin');
  const [numGlow, setNumGlow] = useState(false);
  useEffect(()=>{
    const start = performance.now(); let raf=0;
    const ctx = canvasRef.current?.getContext('2d');
    const draw = (t:number)=>{
      if (!ctx) return;
      const dt=t-start; ctx.clearRect(0,0,128,128);
      const p = Math.sin(dt/200)+1; ctx.fillStyle = `rgba(102,29,135,${0.15+0.1*p})`;
      ctx.beginPath(); ctx.arc(64,64,60,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#bfbfe6'; ctx.lineWidth=2;
      ctx.beginPath(); const R=46+2*Math.sin(dt/80);
      for(let i=0;i<8;i++){ const a=(Math.PI*2/8)*i + dt/180; const x=64+Math.cos(a)*R; const y=64+Math.sin(a)*R; if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.closePath(); ctx.stroke();
      if (dt>=3000){ cancelAnimationFrame(raf); setPhase('reveal'); return; }
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    try{ const ac = new (window.AudioContext||(window as any).webkitAudioContext)(); const o=ac.createOscillator(); const g=ac.createGain(); o.type='triangle'; o.frequency.value=420; g.gain.value=0.0001; o.connect(g); g.connect(ac.destination); o.start(); const id=setInterval(()=>{ g.gain.value=0.04; setTimeout(()=>g.gain.value=0.0001,60)},180); setTimeout(()=>{ clearInterval(id); o.stop(); ac.close(); },3000);}catch{}
    return ()=>{};
  },[]);
  useEffect(()=>{
    if(phase!=='reveal') return;
    const ctx = canvasRef.current?.getContext('2d'); if(!ctx) return;
    ctx.clearRect(0,0,128,128);
    ctx.fillStyle='rgba(255,209,102,0.9)'; ctx.beginPath(); ctx.arc(64,64,58,0,Math.PI*2); ctx.fill();
    setTimeout(()=>{ ctx.clearRect(0,0,128,128); ctx.strokeStyle='#d8c58a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(64,64,54,0,Math.PI*2); ctx.stroke(); setNumGlow(true);
      try{ const ac=new (window.AudioContext||(window as any).webkitAudioContext)(); const o=ac.createOscillator(); const g=ac.createGain();
        if(value===20){ o.type='square'; o.frequency.value=880; g.gain.value=0.08; } else if(value===1){ o.type='sawtooth'; o.frequency.value=160; g.gain.value=0.06; } else { o.type='sine'; o.frequency.value=520; g.gain.value=0.05; }
        o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+0.3); o.stop(ac.currentTime+0.35); ac.close(); },120);
      }catch{}
      setTimeout(()=>{ setPhase('done'); setTimeout(()=>onDone(), 800); }, 1100);
    }, 120);
  },[phase]);
  return (
    <div className="relative" style={{width:128,height:128}}>
      <canvas ref={canvasRef} width={128} height={128} />
      <div className={"absolute inset-0 grid place-items-center text-white text-3xl font-black " + (numGlow?'[filter:drop-shadow(0_0_8px_rgba(255,209,102,.85))] text-yellow-300':'')}>{value}</div>
    </div>
  );
}
