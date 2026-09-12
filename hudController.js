/**
 * hudController.js
 * Listens to "scene:progress" events from scrollEngine.js and updates
 * the fixed HUD (ticker fill %) plus reveals each act's text content
 * once it is sufficiently in view.
 */
(function () {
  "use strict";

  const hud = document.getElementById("hud");
  const tickerFill = document.getElementById("hud-ticker-fill");

  window.addEventListener("scene:progress", (event) => {
    const { page, acts } = event.detail;

    if (tickerFill) {
      tickerFill.style.width = `${(page * 100).toFixed(1)}%`;
    }

    acts.forEach(({ id, progress }) => {
      const contentEl = document.querySelector(`#${id} .act-content`);
      if (!contentEl) return;
      // Reveal once the act is ~10% scrolled into its own range.
      contentEl.classList.toggle("is-in-view", progress > 0.08);
    });
  });

  /**
   * Called by gestureGate.js once the unlock gesture succeeds, to
   * reveal the persistent HUD (it stays hidden during the gate).
   */
  window.showHud = function showHud() {
    if (hud) hud.classList.add("is-visible");
  };

  /**
   * XP tracker — simple accumulator other modules can call into.
   */
  let xp = 0;
  const xpEl = document.getElementById("hud-xp-count");

  window.HudXP = {
    add(amount) {
      xp += amount;
      if (xpEl) xpEl.textContent = `${xp} XP`;
    },
    get value() {
      return xp;
    },
  };
})();
