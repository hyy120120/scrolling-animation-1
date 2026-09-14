/**
 * act1.js
 * Drives the Act 1 ("You Believed") headline-stage crossfade system.
 *
 * Reads the `acts` array from the "scene:progress" CustomEvent dispatched
 * by scrollEngine.js (no second scroll listener), finds the entry with
 * id === "act-1", and maps its 0..1 progress value to one of five stages:
 *
 *   Stage 0  0.00 – 0.20   "You Believed" (with flourish swash)
 *   Stage 1  0.20 – 0.33   "Many study abroad consultancies"
 *   Stage 2  0.33 – 0.53   "would sell You"
 *   Stage 3  0.53 – 0.80   VISA badge (juicy bounce entrance)
 *   Stage 4  0.80 – 1.00   "JOB GUARANTEE?" (crack + wobble) + hold-1 button
 *
 * Stages are activated by toggling the CSS class "is-active" and updating
 * aria-hidden, so the visible stage is accessible and the rest are hidden.
 * Pattern is identical to act2.js / act3.js — only ACT_ID, STAGE_BOUNDARIES,
 * and the stage element id-prefix differ.
 */
(function () {
  "use strict";

  /** ID of the act this module controls. */
  const ACT_ID = "act-1";

  /**
   * Stage boundary definitions: each entry maps a progress range [start, end)
   * to the DOM element id of that stage.
   * @type {Array<{start: number, end: number, id: string}>}
   */
  const STAGE_BOUNDARIES = [
    { start: 0.00, end: 0.20, id: "a1-stage-0" },
    { start: 0.20, end: 0.33, id: "a1-stage-1" },
    { start: 0.33, end: 0.53, id: "a1-stage-2" },
    { start: 0.53, end: 0.80, id: "a1-stage-3" },
    { start: 0.80, end: 1.01, id: "a1-stage-4" }, // end > 1 catches fp edge
  ];

  /**
   * Cached references to each stage element, populated once on init.
   * @type {Array<HTMLElement|null>}
   */
  let stageEls = [];

  /**
   * Index of the currently active stage (-1 = none yet).
   * Tracked to avoid unnecessary DOM writes on every scroll frame.
   * @type {number}
   */
  let currentStageIndex = -1;

  /**
   * Resolve and cache all stage elements from the DOM.
   */
  function initStageRefs() {
    stageEls = STAGE_BOUNDARIES.map(({ id }) => document.getElementById(id));
  }

  /**
   * Given an act-1 progress value (0..1), return the index of the stage
   * that should be active, or -1 if none matches.
   * @param {number} progress
   * @returns {number}
   */
  function resolveStageIndex(progress) {
    for (let i = 0; i < STAGE_BOUNDARIES.length; i++) {
      const { start, end } = STAGE_BOUNDARIES[i];
      if (progress >= start && progress < end) return i;
    }
    // Clamp: if progress is exactly 1.0 (fully scrolled), show the last stage.
    if (progress >= 1.0) return STAGE_BOUNDARIES.length - 1;
    return -1;
  }

  /**
   * Activate a stage by index, deactivating all others.
   * Skips the DOM write when the stage hasn't changed.
   * @param {number} index  Stage index to activate; pass -1 to deactivate all.
   */
  function activateStage(index) {
    if (index === currentStageIndex) return;
    currentStageIndex = index;

    stageEls.forEach((el, i) => {
      if (!el) return;
      const isActive = i === index;
      el.classList.toggle("is-active", isActive);
      // Keep aria-hidden accurate: only the visible stage is announced.
      el.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  }

  /**
   * Handle a "scene:progress" event. Extracts act-1 progress and
   * delegates to activateStage().
   * @param {CustomEvent} event
   */
  function onSceneProgress(event) {
    const { acts } = event.detail;
    const act1 = acts.find((a) => a.id === ACT_ID);
    if (!act1) return;

    const index = resolveStageIndex(act1.progress);
    activateStage(index);
  }

  // Wire up once the DOM is ready (scripts load with defer-by-position,
  // so DOMContentLoaded may already have fired — guard both cases).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStageRefs);
  } else {
    initStageRefs();
  }

  window.addEventListener("scene:progress", onSceneProgress);
})();
