import React, { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  request: null | { dc:number }
  onRoll: (res:{ d20:number })=>void
}

function useAudioBeeps(){
  const ctxRef = useRef<AudioContext | null>(null)
  function ensure(){ if(!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() }
  function beep(freq=600, dur=0.06, type: OscillatorType = 'triangle', gain=0.02){
    try {
      ensure()
      const ctx = ctxRef.current!
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type; osc.frequency.value = freq
      g.gain.value = gain
      osc.connect(g).connect(ctx.destination)
      osc.start()
      setTimeout(()=>{ osc.stop(); }, Math.max(1, dur*1000))
    } catch {}
  }
  function seq(nums:number[], step=70){ nums.forEach((n,i)=> setTimeout(()=>beep(n, .05, 'square', 0.03), i*step)) }
  return { beep, seq }
}

export function D20RollLauncher({ request, onRoll }: Props){
  const [phase, setPhase] = useState<'idle'|'preflash'|'spin'|'result'|'done'>('idle')
  const [d20, setD20] = useState<number | null>(null)
  const [showNum, setShowNum] = useState(false)
  const [glow, setGlow] = useState(false)
  const [fadeAll, setFadeAll] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef<HTMLCanvasElement>(null)
  const flashRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<HTMLCanvasElement>(null)

  const { beep, seq } = useAudioBeeps()

  // simple fallback spin (no assets): rotating hexagon
  function drawSpin(t:number){
    const cvs = canvasRef.current; if(!cvs) return
    const ctx = cvs.getContext('2d')!
    const w = cvs.width, h = cvs.height
    ctx.clearRect(0,0,w,h)
    ctx.save()
    ctx.translate(w/2, h/2)
    ctx.rotate(t/180*Math.PI)
    ctx.fillStyle = '#2b2340'; ctx.strokeStyle='#5a4a7f'; ctx.lineWidth=2
    const R = 44
    ctx.beginPath()
    for(let i=0;i<6;i++){
      const a = (i/6)*Math.PI*2
      const x = Math.cos(a)*R, y = Math.sin(a)*R
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
    }
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
  }

  // pulse background
  function drawPulse(intensity:number, colorA='#661d87', colorB='#ffd166'){
    const cvs = pulseRef.current; if(!cvs) return
    const ctx = cvs.getContext('2d')!
    const w=128,h=128; ctx.clearRect(0,0,w,h)
    const g = ctx.createRadialGradient(w/2,h/2,10, w/2,h/2, 64)
    const c = intensity
    const mix = (a:string,b:string,t:number)=>{
      // crude mix by choosing b when t>.5
      return t>0.5?b:a
    }
    g.addColorStop(0, mix(colorA,colorB,c))
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0,0,w,h)
  }

  // circular flash with hard-opaque center and feathered edges
  function drawFlash(progress:number, color='#ffd166', innerR=30, outerR=64){
    const cvs = flashRef.current; if(!cvs) return
    const ctx = cvs.getContext('2d')!
    const w=128,h=128; ctx.clearRect(0,0,w,h)
    // expand radius from small to outerR
    const R = 6 + progress*(outerR-6)
    const g = ctx.createRadialGradient(w/2,h/2, Math.min(innerR,R), w/2,h/2, R)
    g.addColorStop(0, color)
    g.addColorStop(0.7, color+'cc')
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0,0,w,h)
  }

  // sparks (nat20 only)
  const sparks = useRef<{x:number,y:number,vx:number,vy:number,life:number}[]>([])
  function initSparks(){
    sparks.current = Array.from({length: 26}, ()=>{
      const a = Math.random()*Math.PI*2
      const s = 1.8 + Math.random()*2.6
      return { x:64, y:64, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life: 1.0 }
    })
  }
  function drawSparks(dt:number){
    const cvs = sparksRef.current; if(!cvs) return
    const ctx = cvs.getContext('2d')!
    ctx.clearRect(0,0,128,128)
    ctx.fillStyle = '#ffd166'
    sparks.current.forEach(p=>{
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.985
      p.vy *= 0.985
      p.life *= 0.96
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillRect(p.x|0, p.y|0, 2, 2)
    })
    ctx.globalAlpha = 1
  }

  useEffect(()=>{
    let raf = 0
    let t0 = 0
    if(phase==='spin'){
      const start = performance.now()
      const tick = (now:number)=>{
        if(!t0) t0 = now
        const t = now - start
        drawSpin(t/6) // rotate
        const beat = Math.sin(t/300)*0.5+0.5
        drawPulse(beat)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      // spin beeps gently
      seq([400,420,440,460,480,500,520,540,560,580,600], 120)
    }
    return ()=> cancelAnimationFrame(raf)
  }, [phase])

  useEffect(()=>{
    if(phase==='preflash'){
      // initial purple pop
      let a=0; const id = setInterval(()=>{
        a+=0.2; drawFlash(a, '#661d87', 24, 64)
        if(a>=1){ clearInterval(id); setPhase('spin') }
      }, 24)
    }
  }, [phase])

  // start when request arrives
  useEffect(()=>{
    if(request){
      setFadeAll(false); setShowNum(false); setGlow(false)
      setPhase('preflash')
      const rolled = 1 + Math.floor(Math.random()*20)
      setD20(rolled)
      // schedule end of spin
      setTimeout(()=>{
        setPhase('result')
        // result flash + sound
        let a=0; const id = setInterval(()=>{
          a+=0.25; drawFlash(a, '#ffd166', 30, 64)
          if(a>=1){ clearInterval(id) }
        }, 24)
        if(rolled===20) seq([880, 1320, 1760], 120)
        else if(rolled===1) seq([140, 120, 100], 110)
        else seq([520, 480, 560], 100)
        // sparks only on 20
        if(rolled===20){ initSparks(); (function loop(){ drawSparks(16); if(phase==='result') requestAnimationFrame(loop) })() }
        // reveal number (under flash, then show)
        setTimeout(()=>{ setShowNum(true) }, 120)
        setTimeout(()=>{ setGlow(true) }, 620)
        // fade out whole scene later
        setTimeout(()=>{ setFadeAll(true); setPhase('done') }, 2600)
      }, 3000) // 3s spin
    }
  }, [request])

  // clear overlays when done
  useEffect(()=>{
    if(phase==='done'){
      const cvs = flashRef.current; if(cvs) cvs.getContext('2d')!.clearRect(0,0,128,128)
      const p = pulseRef.current; if(p) p.getContext('2d')!.clearRect(0,0,128,128)
      const s = sparksRef.current; if(s) s.getContext('2d')!.clearRect(0,0,128,128)
      // notify host after little delay, so fade-out is visible
      setTimeout(()=>{
        if(d20!=null) onRoll({ d20 })
      }, 350)
    }
  }, [phase])

  if(!request) return null
  return (
    <div style={{position:'relative', width:128, height:128}} className={fadeAll ? 'fade-out' : ''}>
      <canvas ref={pulseRef} width={128} height={128} className="pulse" />
      <canvas ref={canvasRef} width={128} height={128} className="dice-canvas" />
      <canvas ref={sparksRef} width={128} height={128} className="sparks" style={{opacity: d20===20?1:0}} />
      <canvas ref={flashRef} width={128} height={128} className="flash" />
      {showNum && (
        <div className={'num '+(glow?'glow':'')} style={{fontSize: '34px', transform: 'translate(2px,6px)'}}>
          {d20}
        </div>
      )}
    </div>
  )
}
