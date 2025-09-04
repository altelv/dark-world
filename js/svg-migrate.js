/**
 * Dark World — SVG in-place migration helpers
 * - Fix legacy ids (btn_ATTAK -> btn_attack)
 * - Remove duplicate/unused elements (btn_potion1)
 * - Can be extended for future-safe fixes without editing the .svg file
 */
(function(){
  const api = {
    run(svgRoot){
      if (!svgRoot || !svgRoot.querySelector) return;
      // Rename btn_ATTAK -> btn_attack
      const bad = svgRoot.querySelector("#btn_ATTAK");
      if (bad) { bad.setAttribute("id", "btn_attack"); }
      // Remove duplicate btn_potion1
      const dup = svgRoot.querySelector("#btn_potion1");
      if (dup && dup.parentNode) dup.parentNode.removeChild(dup);
      // Ensure all buttons are pointer-enabled
      svgRoot.querySelectorAll("[id^='btn_']").forEach(el => {
        el.style.pointerEvents = "all";
      });
    }
  };
  window.DWSVGMigrate = api;
})();