
(function () {
  const BOOT_NS = "DWCombatOverlay";
  if (window[BOOT_NS]) return;

  const CFG = Object.assign({
    cell: 64,
    floorY: 48,
    assets: {
      hero: "assets/combat/hero.png",
      enemy:"assets/combat/enemy.png",
      boss: "assets/combat/boss.png"
    },
    sprite: {
      baseW: 96, baseH: 112,
      hero: { scale: 1.0,  ox: -16, oy: -57 },
      enemy:{ scale: 1.0,  ox: -15, oy: -39 },
      boss: { scale: 1.15, ox: -16, oy: -51 }
    },
    hp: { radius: 4, gap: 3, stroke:"#2A2E37", fill:"#B74141", fontSize: 10.5, outline:"#171920" },
    move: { fadeDuringMove: true, panMs: 180, fadeMs: 140, tileFill: "rgba(255,255,255,0.26)" }
  }, window.DW_COMBAT_CFG || {});
  if (window.DW_COMBAT_ASSETS) Object.assign(CFG.assets, window.DW_COMBAT_ASSETS);

  const state = {
    root:null, svg:null, boardBBox:null,
    cells:[], grid:{minX:0,maxX:0,minY:0,maxY:0,width:0,height:0},
    facing:0,
    heroWindow:{x:0,y:0},
    heroWorld:{x:5,y:5,name:"Герой",hp:3},
    worldSize:{w:10,h:10},
    enemies:[], covers:[],
    anchor:null,
    pan:{g:null,clipId:null,cellW:64,cellH:64,offX:0,offY:0,animId:0},
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function num(v, d){ const n = parseFloat(v); return isFinite(n)? n : d; }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function log(...a){ console.log("[CombatOverlay]", ...a); }

  // CSS
  (function injectCSS(){
    const css = `
      #dw-combat-root{position:fixed!important;z-index:2147483647!important}
      #dw-combat-root>svg#dw-combat-svg{width:100%;height:100%;display:block}
      #dw-combat-root [id^="btn_"]{cursor:pointer;transition:transform .06s ease,filter .06s ease}
      #dw-combat-root [id^="btn_"].pressed{transform:translateY(1px) scale(.98);filter:brightness(.92)}
      .dw-hl-move{fill:${CFG.move.tileFill};pointer-events:auto}
      .dw-cover{fill:rgba(140,140,160,.22)}
      .dw-hero-img{pointer-events:none}
      .dw-enemy-img{cursor:pointer;pointer-events:auto}
      .dw-name{fill:#fff;font-size:${CFG.hp.fontSize}px;text-anchor:middle;paint-order:stroke fill;stroke:${CFG.hp.outline};stroke-width:.8}
      .dw-aim-line{stroke:rgba(255,60,60,.85);stroke-width:2;stroke-dasharray:3 2}
      .dw-aim-marker{fill:rgba(200,40,40,.95)}
    `;
    const s=document.createElement("style"); s.id="dw-combat-style"; s.textContent=css; document.head.appendChild(s);
  })();

  // Projection
  function projectDelta(dx,dy,f){f=((f%4)+4)%4;return f===0?{dx,dy}:f===1?{dx:dy,dy:-dx}:f===2?{dx:-dx,dy:-dy}:{dx:-dy,dy:dx};}
  function unprojectDelta(dx,dy,f){f=((f%4)+4)%4;return f===0?{dx,dy}:f===1?{dx:-dy,dy:dx}:f===2?{dx:-dx,dy:-dy}:{dx:dy,dy:-dx};}
  function worldToWindow(wx,wy){const dx=wx-state.heroWorld.x,dy=wy-state.heroWorld.y,p=projectDelta(dx,dy,state.facing);return{x:state.heroWindow.x+p.dx,y:state.heroWindow.y+p.dy};}

  // Cells
  function collectCells(){
    state.cells=[];
    const list=state.svg.querySelectorAll("#board #cam #cells rect[id^='cell_']");
    list.forEach(el=>{
      const m=/^cell_(-?\d+)_(-?\d+)$/.exec(el.id); if(!m) return;
      const x=+m[1], y=+m[2], bb=el.getBBox?el.getBBox():null;
      const rx=num(el.getAttribute("x"), bb?bb.x:0), ry=num(el.getAttribute("y"), bb?bb.y:0);
      const rw=num(el.getAttribute("width"), bb?bb.width:CFG.cell), rh=num(el.getAttribute("height"), bb?bb.height:CFG.cell);
      state.cells.push({el,x,y,bb,rx,ry,rw,rh});
    });
    if(!state.cells.length) return false;
    state.grid.minX=Math.min(...state.cells.map(c=>c.x)); state.grid.maxX=Math.max(...state.cells.map(c=>c.x));
    state.grid.minY=Math.min(...state.cells.map(c=>c.y)); state.grid.maxY=Math.max(...state.cells.map(c=>c.y));
    state.grid.width=state.grid.maxX-state.grid.minX+1; state.grid.height=state.grid.maxY-state.grid.minY+1;
    state.heroWindow.x=0; state.heroWindow.y=0;
    const hc=state.cells.find(c=>c.x===0&&c.y===0) || state.cells[0];
    state.pan.cellW=hc?hc.rw:CFG.cell; state.pan.cellH=hc?hc.rh:CFG.cell;
    const board=state.svg.querySelector("#board");
    state.boardBBox = board&&board.getBBox? board.getBBox(): {x:hc.rx-2,y:hc.ry-2,width:state.pan.cellW*state.grid.width+4,height:state.pan.cellH*state.grid.height+4};
    return true;
  }
  function getCell(x,y){ return state.cells.find(c=>c.x===x&&c.y===y); }

  // Layers
  function ensurePan(){
    if(!state.pan.g){
      const g=document.createElementNS("http://www.w3.org/2000/svg","g"); g.id="dw-pan";
      const board=state.svg.querySelector("#board");
      if(board&&board.getBBox){
        const bb=board.getBBox(), defs=state.svg.querySelector("defs")||(function(){const d=document.createElementNS("http://www.w3.org/2000/svg","defs");state.svg.insertBefore(d,state.svg.firstChild);return d})();
        const clip=document.createElementNS("http://www.w3.org/2000/svg","clipPath"); clip.id="dw-board-clip";
        const r=document.createElementNS("http://www.w3.org/2000/svg","rect"); r.setAttribute("x",bb.x); r.setAttribute("y",bb.y); r.setAttribute("width",bb.width); r.setAttribute("height",bb.height);
        clip.appendChild(r); defs.appendChild(clip); g.setAttribute("clip-path","url(#dw-board-clip)");
      }
      const after=state.svg.querySelector("#board"); if(after&&after.parentNode) after.parentNode.insertBefore(g,after.nextSibling); else state.svg.appendChild(g);
      state.pan.g=g;
    }
    const px=state.pan.offX*state.pan.cellW, py=state.pan.offY*state.pan.cellH;
    state.pan.g.setAttribute("transform",`translate(${px} ${py})`);
    return state.pan.g;
  }
  function ensureLayer(id, underPan=true){
    const parent = underPan? ensurePan() : state.svg;
    let g=state.svg.querySelector("#"+id);
    if(!g){ g=document.createElementNS("http://www.w3.org/2000/svg","g"); g.id=id; parent.appendChild(g); }
    else if(g.parentNode!==parent){ g.parentNode.removeChild(g); parent.appendChild(g); }
    while(g.firstChild) g.removeChild(g.firstChild);
    return g;
  }

  // Draw helpers
  function rectFromCell(cell, cls, data){ const r=document.createElementNS("http://www.w3.org/2000/svg","rect");
    r.setAttribute("x",cell.rx); r.setAttribute("y",cell.ry); r.setAttribute("width",cell.rw); r.setAttribute("height",cell.rh); r.setAttribute("rx",6);
    if(cls) r.setAttribute("class",cls); if(data) Object.assign(r.dataset,data); return r; }
  function imageAtCell(cell, kind){
    const cfg = kind==="boss"? CFG.sprite.boss : kind==="enemy"? CFG.sprite.enemy : CFG.sprite.hero;
    const scale=cfg.scale||1, href=kind==="boss"?CFG.assets.boss:kind==="enemy"?CFG.assets.enemy:CFG.assets.hero;
    const img=document.createElementNS("http://www.w3.org/2000/svg","image"); img.setAttributeNS("http://www.w3.org/1999/xlink","href",href);
    const cx=cell.rx+cell.rw/2, floor=cell.ry+CFG.floorY, w=Math.round(CFG.sprite.baseW*scale), h=Math.round(CFG.sprite.baseH*scale);
    const x=Math.round(cx+(cfg.ox||0)*scale), y=Math.round(floor+(cfg.oy||0)*scale);
    img.setAttribute("x",x); img.setAttribute("y",y); img.setAttribute("width",w); img.setAttribute("height",h);
    img.setAttribute("class", kind==="enemy"||kind==="boss" ? "dw-enemy-img" : "dw-hero-img");
    return img;
  }
  function hpPipsAtCell(cell, n){
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    const cy=cell.ry+56, r=CFG.hp.radius, d=r*2, width=n*d+(n-1)*CFG.hp.gap; let x=(cell.rx+cell.rw/2)-width/2+r;
    for(let i=0;i<n;i++){ const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",x); c.setAttribute("cy",cy); c.setAttribute("r",r); c.setAttribute("fill",CFG.hp.fill); c.setAttribute("stroke",CFG.hp.stroke); c.setAttribute("stroke-width","1"); g.appendChild(c);
      x+=d+CFG.hp.gap; } return g; }
  function nameAtCell(cell, s){ const t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",cell.rx+cell.rw/2); t.setAttribute("y",cell.ry+56+12); t.setAttribute("class","dw-name"); s=String(s||""); if(s.length>12) s=s.slice(0,11)+"…"; t.textContent=s; return t; }

  // Render
  function renderMove(){ const g=ensureLayer("dw-highlights-move");
    const offs=[{dx:0,dy:1},{dx:0,dy:-1},{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:2},{dx:0,dy:-2},{dx:2,dy:0},{dx:-2,dy:0},{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
    offs.forEach(v=>{ const cx=state.heroWindow.x+v.dx, cy=state.heroWindow.y+v.dy, cell=getCell(cx,cy); if(cell) g.appendChild(rectFromCell(cell,"dw-hl-move",{cellx:String(cx),celly:String(cy)})); }); }
  function renderCovers(){ const g=ensureLayer("dw-tiles-cover"); state.covers.forEach(p=>{ const w=worldToWindow(p.x,p.y), cell=getCell(w.x,w.y); if(cell) g.appendChild(rectFromCell(cell,"dw-cover")); }); }
  function renderEnemies(){
    const g=ensureLayer("dw-enemies"), off=ensureLayer("dw-offscreen");
    const hc=getCell(state.heroWindow.x,state.heroWindow.y), heroC={x:hc.rx+hc.rw/2,y:hc.ry+hc.rh/2};
    state.enemies.forEach(e=>{
      if(e.alive===false) return; const kind=e.type==="boss"?"boss":"enemy";
      const w=worldToWindow(e.pos.x,e.pos.y), inside=(w.x>=state.grid.minX&&w.x<=state.grid.maxX&&w.y>=state.grid.minY&&w.y<=state.grid.maxY);
      if(inside){ const cell=getCell(w.x,w.y); if(!cell) return; const img=imageAtCell(cell,kind); img.dataset.id=e.id; g.appendChild(img); g.appendChild(hpPipsAtCell(cell,e.hp||3)); g.appendChild(nameAtCell(cell,e.name||e.id||(kind==="boss"?"Босс":"Враг"))); }
      else { const cx=clamp(w.x,state.grid.minX,state.grid.maxX), cy=clamp(w.y,state.grid.minY,state.grid.maxY), cell=getCell(cx,cy); if(!cell) return;
        const target={x:cell.rx+cell.rw/2,y:cell.ry+cell.rh/2}; const ln=document.createElementNS("http://www.w3.org/2000/svg","line");
        ln.setAttribute("x1",heroC.x); ln.setAttribute("y1",heroC.y); ln.setAttribute("x2",target.x); ln.setAttribute("y2",target.y); ln.setAttribute("class","dw-aim-line"); off.appendChild(ln);
        const dx=target.x-heroC.x, dy=target.y-heroC.y, ang=Math.atan2(dy,dx), size=9, tipX=target.x, tipY=target.y;
        const leftX=tipX-Math.cos(ang)*size+Math.sin(ang)*size*.6, leftY=tipY-Math.sin(ang)*size-Math.cos(ang)*size*.6;
        const rightX=tipX-Math.cos(ang)*size-Math.sin(ang)*size*.6, rightY=tipY-Math.sin(ang)*size+Math.cos(ang)*size*.6;
        const poly=document.createElementNS("http://www.w3.org/2000/svg","polygon"); poly.setAttribute("points",`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`); poly.setAttribute("class","dw-aim-marker"); off.appendChild(poly); }
    });
  }
  function renderHero(){ const g=ensureLayer("dw-hero",false); const cell=getCell(state.heroWindow.x,state.heroWindow.y); if(!cell) return; g.appendChild(imageAtCell(cell,"hero")); g.appendChild(hpPipsAtCell(cell,state.heroWorld.hp||3)); g.appendChild(nameAtCell(cell,state.heroWorld.name||"Герой")); }
  function repaint(){ renderCovers(); renderMove(); renderEnemies(); renderHero(); }

  // Movement
  function isAllowedMove(dx,dy){const ax=Math.abs(dx),ay=Math.abs(dy); if((ax===0&&(ay===1||ay===2))||(ay===0&&(ax===1||ax===2))) return true; return ax===1&&ay===1;}
  function animatePan(dx,dy){
    state.pan.offX=dx; state.pan.offY=dy;
    const start=performance.now(), dur=CFG.move.panMs, fade=CFG.move.fadeMs, hl=state.svg.querySelector("#dw-highlights-move");
    if(CFG.move.fadeDuringMove && hl) hl.style.opacity="0";
    cancelAnimationFrame(state.pan.animId);
    const step=(t)=>{ const k=Math.min(1,(t-start)/dur), ease=k<.5?2*k*k:-1+(4-2*k)*k;
      state.pan.offX=lerp(dx,0,ease); state.pan.offY=lerp(dy,0,ease); ensurePan();
      if(k<1) state.pan.animId=requestAnimationFrame(step);
      else{ state.pan.offX=0; state.pan.offY=0; ensurePan(); if(CFG.move.fadeDuringMove&&hl){ hl.style.transition=`opacity ${fade}ms ease`; hl.style.opacity="1"; setTimeout(()=>{hl.style.transition=""}, fade+20);} repaint(); }
    };
    state.pan.animId=requestAnimationFrame(step);
  }
  function performMoveToWindowCell(wx,wy){
    const dx=wx-state.heroWindow.x, dy=wy-state.heroWindow.y; if(!isAllowedMove(dx,dy)) return false;
    const d=unprojectDelta(dx,dy,state.facing); const nx=clamp(state.heroWorld.x+d.dx,0,state.worldSize.w-1), ny=clamp(state.heroWorld.y+d.dy,0,state.worldSize.h-1);
    if(window.DWCombatLogic&&typeof window.DWCombatLogic.setHeroPos==="function"){ window.DWCombatLogic.setHeroPos(nx,ny); } else { state.heroWorld.x=nx; state.heroWorld.y=ny; }
    animatePan(dx,dy); return true;
  }

  // Clicks
  function onClick(e){
    const btn=e.target.closest("[id^='btn_']");
    if(btn){ btn.classList.add("pressed"); setTimeout(()=>btn.classList.remove("pressed"),110);
      const id=btn.id.toLowerCase(); if(id.includes("turn_left")){state.facing=(state.facing+3)%4; repaint(); return;}
      if(id.includes("turn_right")){state.facing=(state.facing+1)%4; repaint(); return;}
      let kind=null; if(id.includes("attack")) kind="attack"; else if(id.includes("defence")||id.includes("defense")) kind="defense";
      else if(id.includes("ranger")&&id.includes("precise")) kind="ranger_precise"; else if(id.includes("throw")) kind="throw";
      else if(id.includes("potion")) kind="potion"; else if(id.includes("bandage")) kind="bandage"; else if(id.includes("rollback")) kind="rollback"; else if(id.includes("end_turn")||id.endsWith("_end")) kind="end_turn";
      if(kind) window.dispatchEvent(new CustomEvent("dw:combat:action",{detail:{kind}})); return;
    }
    const enemy=e.target.closest(".dw-enemy-img"); if(enemy&&enemy.dataset.id){ window.dispatchEvent(new CustomEvent("dw:combat:selectTarget",{detail:{id:enemy.dataset.id}})); return; }
    const hl=e.target.closest(".dw-hl-move"); if(hl&&hl.dataset){ if(performMoveToWindowCell(+hl.dataset.cellx,+hl.dataset.celly)) return; }
    const rect=e.target.closest("#board #cam #cells rect[id^='cell_']"); if(rect){ const m=/^cell_(-?\d+)_(-?\d+)$/.exec(rect.id); if(m) performMoveToWindowCell(+m[1],+m[2]); }
  }

  // Sync from logic
  function onState(ev){
    const st=ev&&ev.detail&&ev.detail.state; if(!st) return;
    if(st.hero&&st.hero.pos){ state.heroWorld.x=st.hero.pos.x|0; state.heroWorld.y=st.hero.pos.y|0; }
    if(st.hero&&(st.hero.name||st.hero.hp)){ if(st.hero.name) state.heroWorld.name=st.hero.name; if(st.hero.hp) state.heroWorld.hp=st.hero.hp|0; }
    if(Array.isArray(st.enemies)){ state.enemies=st.enemies.map(e=>({id:e.id,name:e.name,hp:e.hp||3,type:e.type||"enemy",pos:{x:e.pos.x|0,y:e.pos.y|0},alive:e.alive!==false})); }
    repaint();
  }

  // Anchor to center
  function findCenter(){ let n=document.querySelector("#center"); if(n) return n; const cols=[...document.querySelectorAll(".col")]; if(cols.length===3) return cols[1]; return document.body; }
  function place(){ if(!state.anchor||!state.root) return; const r=state.anchor.getBoundingClientRect(); state.root.style.left=(r.left+window.scrollX)+"px"; state.root.style.top=(r.top+window.scrollY)+"px"; state.root.style.width=r.width+"px"; state.root.style.height=r.height+"px"; }

  // Init
  async function init(){
    state.anchor=findCenter(); const root=document.createElement("div"); root.id="dw-combat-root"; document.body.appendChild(root); state.root=root; place();
    window.addEventListener("resize",place,{passive:true}); window.addEventListener("scroll",place,{passive:true});

    let svg=document.querySelector("#dw-combat-svg");
    if(!svg){ try{ const resp=await fetch("combat-overlay.svg",{cache:"no-store"}); if(resp.ok){ const txt=await resp.text(); const wrap=document.createElement("div"); wrap.innerHTML=txt.trim(); svg=wrap.querySelector("svg"); if(svg) svg.id="dw-combat-svg"; } }catch(e){} }
    if(!svg){ console.error("dw-combat-svg not found"); return; }
    root.appendChild(svg); state.svg=svg;

    if(window.DWSVGMigrate&&typeof window.DWSVGMigrate.run==="function"){ window.DWSVGMigrate.run(state.svg); }

    const ok=collectCells(); if(!ok) console.warn("No cells collected — need rect ids like cell_-1_2 inside #board #cam #cells.");

    // Seed debug enemies & covers
    if(window.DWCombatLogic&&typeof window.DWCombatLogic.getState==="function"){ const st=window.DWCombatLogic.getState(); state.enemies=(st&&st.enemies)?st.enemies:[]; }
    if(!state.enemies||state.enemies.length===0){
      state.enemies=[
        {id:"E1",name:"Сектант",hp:3,type:"enemy",pos:{x:state.heroWorld.x,y:state.heroWorld.y-2},alive:true},
        {id:"B1",name:"Череп",hp:5,type:"boss",pos:{x:Math.min(state.worldSize.w-1,state.heroWorld.x+3),y:Math.min(state.worldSize.h-1,state.heroWorld.y+3)},alive:true},
      ];
      if(window.DWCombatLogic&&typeof window.DWCombatLogic.setEnemies==="function"){ window.DWCombatLogic.setEnemies(state.enemies); }
    }
    state.covers = state.covers && state.covers.length ? state.covers : [
      {x:state.heroWorld.x-1,y:state.heroWorld.y-1},
      {x:state.heroWorld.x+1,y:state.heroWorld.y},
      {x:state.heroWorld.x,y:state.heroWorld.y+2},
    ].filter(p=>p.x>=0&&p.y>=0&&p.x<state.worldSize.w&&p.y<state.worldSize.h);

    state.svg.addEventListener("click", onClick); window.addEventListener("dw:combat:state", onState);

    repaint();

    window[BOOT_NS]={
      setFacing:(f)=>{state.facing=((f|0)%4+4)%4; repaint();},
      getFacing:()=>state.facing,
      setHeroWorld:(x,y)=>{state.heroWorld.x=x|0; state.heroWorld.y=y|0; repaint();},
      setEnemies:(arr)=>{state.enemies=Array.isArray(arr)?arr.map(e=>({id:e.id,name:e.name,hp:e.hp||3,type:e.type||"enemy",pos:{x:e.pos.x|0,y:e.pos.y|0},alive:e.alive!==false})):[]; repaint();},
      setCovers:(arr)=>{state.covers=Array.isArray(arr)?arr.map(p=>({x:p.x|0,y:p.y|0})):[]; repaint();},
      getGrid:()=>({...state.grid}), cfg:CFG
    };

    log("Overlay v3.9 ready", CFG);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
