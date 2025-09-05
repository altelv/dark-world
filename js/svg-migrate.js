(function(){
  const api = {
    run(svgRoot){
      if (!svgRoot || !svgRoot.querySelector) return;
      // Legacy id fix
      const bad = svgRoot.querySelector("#btn_ATTAK");
      if (bad) bad.setAttribute("id","btn_attack");
      // Remove duplicate old potion if present
      const dup = svgRoot.querySelector("#btn_potion1");
      if (dup && dup.parentNode) dup.parentNode.removeChild(dup);
      // Ensure buttons clickable
      svgRoot.querySelectorAll("[id^='btn_']").forEach(el => { el.style.pointerEvents = "auto"; });
    }
  };
  window.DWSVGMigrate = api;
})();