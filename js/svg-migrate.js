(function(){
  const api = {
    run(svgRoot){
      if (!svgRoot || !svgRoot.querySelector) return;
      // Legacy id fix (if old SVG sneaks in)
      const bad = svgRoot.querySelector("#btn_ATTAK");
      if (bad) bad.setAttribute("id","btn_attack");
      // Remove duplicate old potion if present
      const dup = svgRoot.querySelector("#btn_potion1");
      if (dup && dup.parentNode) dup.parentNode.removeChild(dup);
      // Make sure button groups accept events
      svgRoot.querySelectorAll("[id^='btn_']").forEach(el => { el.style.pointerEvents = "auto"; });
    }
  };
  window.DWSVGMigrate = api;
})();