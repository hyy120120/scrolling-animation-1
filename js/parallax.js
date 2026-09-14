/**
 * parallax.js
 * Applies a subtle scroll-tied translateY + scale to each act's background
 * image, driven by the existing "scene:progress" event. Purely additive —
 * does not touch scroll mechanics, only visual transform of .act-bg elements.
 *
 * Tuning knobs (inside computeTransform):
 *   maxDrift — total vertical pixel shift across the full act range (default 60px)
 *   maxZoom  — extra scale factor added by the end of the act (default 0.06 = 6%)
 * Increase either to make the effect more dramatic; decrease to be more subtle.
 */
(function () {
  "use strict";

  /**
   * Maps an act's 0..1 scroll progress to a smooth translateY (px) and
   * scale, so the image drifts and slowly zooms as the act is scrolled
   * through, rather than sitting frozen.
   * @param {number} progress - 0..1
   * @returns {{ translateY: number, scale: number }}
   */
  function computeTransform(progress) {
    const maxDrift = 60; // px of vertical drift across the whole act
    const maxZoom  = 0.06; // extra scale added by the end of the act (6%)
    return {
      translateY: (progress - 0.5) * maxDrift,
      scale:      1 + progress * maxZoom,
    };
  }

  window.addEventListener("scene:progress", (event) => {
    event.detail.acts.forEach(({ id, progress }) => {
      // Convention: each act's bg element is id="<act-id>-bg"
      // e.g. act-1 → #act-1-bg, act-2 → #act-2-bg, etc.
      const bg = document.querySelector(`#${id}-bg`);
      if (!bg) return;
      const { translateY, scale } = computeTransform(progress);
      bg.style.transform = `translateY(${translateY.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    });
  });
})();
