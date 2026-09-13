/**
 * scrollEngine.js
 * Computes scroll progress (0..1) for the whole page and for each
 * individual .act element, then broadcasts it via a custom event
 * ("scene:progress") so other modules (HUD, act animations) can react
 * without being tightly coupled to the scroll listener itself.
 */
(function () {
  "use strict";

  const acts = Array.from(document.querySelectorAll(".act"));

  /**
   * Clamp a number between min and max.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Calculate how far scrolled (0..1) we are through a given element's
   * scrollable range (from entering the top of viewport to leaving it).
   * @param {HTMLElement} el
   * @returns {number}
   */
  function getActProgress(el) {
    const rect = el.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return rect.top <= 0 ? 1 : 0;
    const scrolled = -rect.top;
    return clamp(scrolled / total, 0, 1);
  }

  /**
   * Calculate overall page scroll progress (0..1), used to drive the
   * HUD ticker bar.
   * @returns {number}
   */
  function getPageProgress() {
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    if (total <= 0) return 0;
    return clamp(window.scrollY / total, 0, 1);
  }

  let ticking = false;

  function handleScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const detail = {
        page: getPageProgress(),
        acts: acts.map((el) => ({
          id: el.id,
          progress: getActProgress(el),
        })),
      };
      window.dispatchEvent(new CustomEvent("scene:progress", { detail }));
      ticking = false;
    });
  }

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleScroll);

  // Expose a manual trigger + smooth-scroll helper for other modules
  // (e.g. the hold-to-continue button advancing to the next act).
  window.SceneScroll = {
    refresh: handleScroll,
    scrollToAct(actId) {
      const el = document.getElementById(actId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  };

  // Initial call so the HUD/acts have correct state before any scroll.
  handleScroll();
})();
