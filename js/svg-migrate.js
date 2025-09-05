(function(){
  function ensureBandageHex(svgRoot){
    const band = svgRoot.querySelector("#btn_bandage");
    if (!band) return;
    const hasHex = band.querySelector('[data-hex]') || band.querySelector('.hex');
    if (hasHex) return;
    const pot = svgRoot.querySelector("#btn_potion");
    let hex = null;
    if (pot){
      hex = pot.querySelector('[data-hex], .hex, polygon, path');
    }
    if (hex){
      const clone = hex.cloneNode(true);
      clone.setAttribute("data-hex","");
      band.insertBefore(clone, band.firstChild);
      return;
    }
    const bbox = (band.getBBox && band.getBBox()) ? band.getBBox() : { x:0, y:0, width:48, height:48 };
    const cx = bbox.x + bbox.width/2;
    const cy = bbox.y + bbox.height/2;
    const r = Math.min(bbox.width, bbox.height) * 0.45;
    const points = [];
    for (let i=0;i<6;i++){
      const a = Math.PI/3 * i;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      points.push(px + "," + py);
    }
    const poly = document.createElementNS("http://www.w3.org/2000/svg","polygon");
    poly.setAttribute("points", points.join(" "));
    poly.setAttribute("fill", "rgba(140,110,255,0.25)");
    poly.setAttribute("stroke", "rgba(140,110,255,0.9)");
    poly.setAttribute("stroke-width", "2");
    poly.setAttribute("data-hex","");
    band.insertBefore(poly, band.firstChild);
  }
  const api = {
    run(svgRoot){
      if (!svgRoot || !svgRoot.querySelector) return;
      const bad = svgRoot.querySelector("#btn_ATTAK");
      if (bad) bad.setAttribute("id","btn_attack");
      const dup = svgRoot.querySelector("#btn_potion1");
      if (dup && dup.parentNode) dup.parentNode.removeChild(dup);
      ensureBandageHex(svgRoot);
      svgRoot.querySelectorAll("[id^='btn_']").forEach(el => { el.style.pointerEvents="all"; });
    }
  };
  window.DWSVGMigrate = api;
})();