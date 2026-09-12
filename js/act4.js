/**
 * act4.js
 * Drives Act 4 ("Your Next Step") — the final act.
 *
 * Firebase SDK is intentionally not added yet — see submitLead() for the integration point.
 *
 * Responsibilities:
 *  1. Stage crossfade — same mechanism as act2.js / act3.js:
 *       Stage 0  0.00 – 0.30   Headline: "You don't need luck…"
 *       Stage 1  0.30 – 0.65   Staggered CTA word reveal: "BOOK YOUR FREE COUNSELLING CALL"
 *       Stage 2  0.65 – 1.00   Subline + HUD pulse + capture bar reveal
 *
 *  2. Brass glow intensity — writes --a4-glow-intensity (0..1) on #act-4 every
 *     scroll frame so the CSS radial-gradient brightens as the act progresses.
 *
 *  3. HUD "Book Free Call" button pulse — adds .is-pulsing on stage 2 entry.
 *
 *  4. Capture bar reveal — adds .is-visible to #capture-bar on stage 2 entry
 *     (and keeps it visible for the rest of the session).
 *
 *  5. Email capture form — client-side validation, async submitLead() call,
 *     loading/success/error states ready for Firebase drop-in.
 */
(function () {
  "use strict";

  /** ID of the act this module controls. */
  const ACT_ID = "act-4";

  /**
   * Stage boundary definitions.
   * @type {Array<{start: number, end: number, id: string}>}
   */
  const STAGE_BOUNDARIES = [
    { start: 0.00, end: 0.30, id: "a4-stage-0" },
    { start: 0.30, end: 0.65, id: "a4-stage-1" },
    { start: 0.65, end: 1.01, id: "a4-stage-2" }, // end > 1 catches fp edge
  ];

  // ── DOM refs ────────────────────────────────────────────────────────────────

  /** @type {Array<HTMLElement|null>} */
  let stageEls = [];

  /** @type {HTMLElement|null} */
  let act4Section = null;

  /** @type {HTMLElement|null} */
  let captureBar = null;

  /** @type {HTMLButtonElement|null} */
  let hudCta = null;

  /** @type {number} */
  let currentStageIndex = -1;

  /** Whether the capture bar has already been made visible (one-way latch). */
  let captureBarRevealed = false;

  // ── Init ────────────────────────────────────────────────────────────────────

  /**
   * Cache all DOM references once the document is ready.
   */
  function initRefs() {
    stageEls    = STAGE_BOUNDARIES.map(({ id }) => document.getElementById(id));
    act4Section = document.getElementById(ACT_ID);
    captureBar  = document.getElementById("capture-bar");
    hudCta      = document.querySelector(".hud-cta");

    wireForm();
  }

  // ── Stage system ────────────────────────────────────────────────────────────

  /**
   * Resolve which stage index is active for the given progress.
   * @param {number} progress  0..1
   * @returns {number}  -1 if none
   */
  function resolveStageIndex(progress) {
    for (let i = 0; i < STAGE_BOUNDARIES.length; i++) {
      const { start, end } = STAGE_BOUNDARIES[i];
      if (progress >= start && progress < end) return i;
    }
    if (progress >= 1.0) return STAGE_BOUNDARIES.length - 1;
    return -1;
  }

  /**
   * Activate a stage by index, deactivate all others.
   * Guards against redundant DOM writes.
   * @param {number} index
   */
  function activateStage(index) {
    if (index === currentStageIndex) return;
    currentStageIndex = index;

    stageEls.forEach((el, i) => {
      if (!el) return;
      const isActive = i === index;
      el.classList.toggle("is-active", isActive);
      el.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    // Side-effects that only trigger once stage 2 is reached
    if (index >= 2) {
      revealCaptureBar();
      pulseHudCta();
    }
  }

  // ── Glow intensity ──────────────────────────────────────────────────────────

  /**
   * Write --a4-glow-intensity on #act-4 so the CSS radial-gradient
   * can scale its opacity with scroll progress.
   * Minimum 0.18 keeps a faint glow even at progress 0.
   * @param {number} progress  0..1
   */
  function updateGlowIntensity(progress) {
    if (!act4Section) return;
    const intensity = 0.18 + progress * 0.82; // maps 0..1 → 0.18..1.0
    act4Section.style.setProperty("--a4-glow-intensity", intensity.toFixed(3));
  }

  // ── Capture bar ─────────────────────────────────────────────────────────────

  /**
   * Reveal the capture bar (one-way latch — never hides again once shown).
   */
  function revealCaptureBar() {
    if (captureBarRevealed || !captureBar) return;
    captureBarRevealed = true;
    captureBar.classList.add("is-visible");
  }

  // ── HUD pulse ───────────────────────────────────────────────────────────────

  /**
   * Add the pulsing highlight class to the HUD CTA button.
   * Only touches classList, does not alter any existing behavior.
   */
  function pulseHudCta() {
    if (hudCta && !hudCta.classList.contains("is-pulsing")) {
      hudCta.classList.add("is-pulsing");
    }
  }

  // ── scene:progress handler ──────────────────────────────────────────────────

  /**
   * Handle the "scene:progress" event from scrollEngine.js.
   * @param {CustomEvent} event
   */
  function onSceneProgress(event) {
    const { acts } = event.detail;
    const act4 = acts.find((a) => a.id === ACT_ID);
    if (!act4) return;

    updateGlowIntensity(act4.progress);
    activateStage(resolveStageIndex(act4.progress));
  }

  // ── Lead submission ─────────────────────────────────────────────────────────

  /**
   * Submit a lead email. Isolated here as the single integration point for
   * Firebase (or any other backend) — drop the real implementation in below
   * when ready, without touching any other function in this file.
   *
   * Firebase integration goes here. Replace the stub body with something like:
   *   const { getFirestore, collection, addDoc } = await import("firebase/firestore");
   *   await addDoc(collection(db, "leads"), { email, createdAt: Date.now(), source: "act4" });
   *
   * The simulated 400 ms delay mirrors real async latency so that the loading
   * state (button label, disabled state) is exercised correctly right now.
   *
   * @param {string} email  Validated, trimmed email address.
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async function submitLead(email) {
    console.log("[RKAZN] Email capture:", email);

    // TODO: POST this to Firebase / CRM / Google Sheet endpoint.
    // Replace the lines below with the real async call when integrating.
    await new Promise((resolve) => setTimeout(resolve, 400)); // simulated latency

    return { ok: true };
  }

  // ── Email capture form ──────────────────────────────────────────────────────

  /**
   * Basic email format check.
   * @param {string} value
   * @returns {boolean}
   */
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  /**
   * Set the submit button into a loading state while the async call is in
   * flight, then restore or swap as appropriate.
   * @param {HTMLButtonElement} btn
   * @param {'idle'|'loading'|'error'} state
   */
  function setSubmitState(btn, state) {
    const labels = {
      idle:    "Get Free Counselling",
      loading: "Sending\u2026",
      error:   "Try again",
    };
    btn.textContent = labels[state] || labels.idle;
    btn.disabled    = state === "loading";
  }

  /**
   * Wire up the capture form: validation, async submitLead(), loading/success/
   * error state management.
   */
  function wireForm() {
    const form    = document.getElementById("capture-form");
    const bar     = document.getElementById("capture-bar");
    const confirm = document.getElementById("capture-confirm");
    const input   = document.getElementById("capture-email");
    const submit  = form ? form.querySelector(".capture-submit") : null;

    if (!form || !bar || !confirm || !input || !submit) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = input.value.trim();

      // ── Client-side validation ────────────────────────────────────────────
      if (!email || !isValidEmail(email)) {
        bar.classList.add("has-error");
        input.focus();
        // Remove error state once user starts correcting
        input.addEventListener(
          "input",
          () => bar.classList.remove("has-error"),
          { once: true }
        );
        return;
      }

      bar.classList.remove("has-error");

      // ── Loading state ─────────────────────────────────────────────────────
      setSubmitState(submit, "loading");

      // ── Async submission ──────────────────────────────────────────────────
      let result;
      try {
        result = await submitLead(email);
      } catch (err) {
        // Network / unexpected error — surface an error state.
        result = { ok: false, error: err.message };
      }

      // ── Handle result ─────────────────────────────────────────────────────
      if (result.ok) {
        // Award XP and reveal confirmation message.
        if (window.HudXP) window.HudXP.add(150);
        form.hidden    = true;
        confirm.hidden = false;
        // Tighten pill padding now the confirmation is shorter than the form.
        bar.style.padding = "14px 22px";
      } else {
        // Submission failed — restore button so the user can retry.
        setSubmitState(submit, "error");
        bar.classList.add("has-error");
        input.addEventListener(
          "input",
          () => {
            bar.classList.remove("has-error");
            setSubmitState(submit, "idle");
          },
          { once: true }
        );
      }
    });
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRefs);
  } else {
    initRefs();
  }

  window.addEventListener("scene:progress", onSceneProgress);
})();
