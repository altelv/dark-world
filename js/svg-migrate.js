(function(){
  const api = {
    run(svgRoot){
      if (!svgRoot || !svgRoot.querySelector) return;
      const bad = svgRoot.querySelector("#btn_ATTAK");
      if (bad) { bad.setAttribute("id", "btn_attack"); }
      const dup = svgRoot.querySelector("#btn_potion1");
      if (dup && dup.parentNode) dup.parentNode.removeChild(dup);
      svgRoot.querySelectorAll("[id^='btn_']").forEach(el => {
        el.style.pointerEvents = "all";
      });
    }
  };
  window.DWSVGMigrate = api;
})();