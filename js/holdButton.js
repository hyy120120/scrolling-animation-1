/**
 * holdButton.js
 * Generic "press and hold until the ring fills" interaction. Wires up
 * every element matching .hold-btn: on pointerdown it starts filling
 * the paired SVG ring (id="<btn-id>-fill"); on release before 100% it
 * resets; on reaching 100% it awards XP and advances scroll to the
 * next .act section.
 *
 * QA fixes applied (original):
 *  - Double-fire guard: `start()` cancels any in-flight RAF before
 *    beginning a new one, preventing pointerdown+touchstart from both
 *    running the animation simultaneously on touch devices.
 *  - Keyboard support: pressing Enter or Space on a focused hold-btn
 *    instantly completes it (matching WCAG "at least one accessible
 *    activation method" for pointer-only controls).
 *
 * Juice-pass additions:
 *  - While holding: button scales up to 1.08× with a spring lerp, and
 *    the ring fill colour intensifies from brass-bright → near-white as
 *    it fills (a "charging power meter" feel).
 *  - On complete: impact scale-punch + radial particle burst + full-screen
 *    white flash.
 *  - On early release: a left-right shake animation so cancels never
 *    silently disappear.
 *  - Audio: hold-tick throttled to ~150ms; act-complete on 100%.
 */
(function () {
  "use strict";

  const HOLD_DURATION_MS   = 1200;
  const RING_CIRCUMFERENCE = 289; // 2 * PI * r(46), matches styles.css

  /* ── Juice helpers (shared across all hold-btn instances) ─────────────── */

  /**
   * Full-screen white flash on completion — a fixed overlay that fades
   * out over 150 ms and then removes itself from the DOM.
   */
  function flashScreen() {
    const el = document.createElement("div");
    el.className = "hold-flash";
    document.body.appendChild(el);
    // Force reflow so the transition fires from opacity 1 → 0.
    void el.offsetWidth;
    el.classList.add("hold-flash--fade");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    // Safety net in case transitionend never fires (e.g. reduced-motion).
    setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
  }

  /**
   * Spawn a radial burst of small circular particles exploding outward
   * from the centre of the given button element.
   * All particles use position:fixed + pointer-events:none so they
   * cannot trigger scroll or layout shifts on any viewport width.
   * @param {HTMLElement} btn
   */
  function spawnBurst(btn) {
    const rect   = btn.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height / 2;
    const count  = 14;
    const frag   = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const angle  = (i / count) * Math.PI * 2;
      // Randomise distance slightly for organic look (48–72 px).
      const dist   = 48 + Math.random() * 24;
      const tx     = Math.cos(angle) * dist;
      const ty     = Math.sin(angle) * dist;
      // Vary size: 5–9 px.
      const size   = 5 + Math.floor(Math.random() * 5);

      const p = document.createElement("div");
      p.className = "hold-spark";
      p.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        // Centre the particle on the button's centre point.
        `left:${cx - size / 2}px`,
        `top:${cy - size / 2}px`,
        // CSS custom properties feed the keyframe translation.
        `--tx:${tx.toFixed(1)}px`,
        `--ty:${ty.toFixed(1)}px`,
        // Stagger start time slightly so they don't all move in perfect sync.
        `animation-delay:${(Math.random() * 60).toFixed(0)}ms`,
      ].join(";");

      frag.appendChild(p);
    }

    document.body.appendChild(frag);

    // Remove all sparks after the animation completes.
    setTimeout(() => {
      document.querySelectorAll(".hold-spark").forEach((s) => s.remove());
    }, 700);
  }

  /* ── Per-button setup ─────────────────────────────────────────────────── */

  document.querySelectorAll(".hold-btn").forEach((btn) => {
    const ring = document.getElementById(`${btn.id}-fill`);
    if (!ring) return;

    let startTime  = null;
    let rafId      = null;
    let completed  = false;
    // Spring state for scale interpolation.
    let currentScale = 1;
    let targetScale  = 1;

    /** @param {number} fraction 0..1 */
    function setProgress(fraction) {
      const offset = RING_CIRCUMFERENCE * (1 - fraction);
      ring.style.strokeDashoffset = String(offset);

      // Interpolate ring stroke colour: brass-bright (0%) → near-white (100%).
      // We blend in HSL space: hue stays ~42, saturation drops, lightness rises.
      const lightness = Math.round(67 + fraction * 26); // 67% → 93%
      const saturation = Math.round(72 - fraction * 42); // 72% → 30%
      ring.style.stroke = `hsl(42, ${saturation}%, ${lightness}%)`;
    }

    /** Reset ring visuals to neutral state. */
    function resetProgress() {
      ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
      ring.style.stroke = ""; // revert to CSS var(--brass-bright)
    }

    /** Apply the current spring-lerped scale to the button element. */
    function applyScale() {
      btn.style.transform = `scale(${currentScale.toFixed(4)})`;
    }

    /** @param {DOMHighResTimeStamp} now */
    function tick(now) {
      if (startTime === null) startTime = now;
      const elapsed  = now - startTime;
      const fraction = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setProgress(fraction);

      // Spring lerp toward target scale (1.08 while held).
      currentScale += (targetScale - currentScale) * 0.12;
      applyScale();

      // Throttled tick sound — AudioFX handles the 145ms gate internally.
      if (fraction < 1 && window.AudioFX) AudioFX.play("hold-tick");

      if (fraction >= 1 && !completed) {
        completed = true;
        onComplete();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    /**
     * Begin (or restart) the hold animation.
     * Cancels any already-running RAF first to prevent double-running.
     */
    function start() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      completed    = false;
      startTime    = null;
      targetScale  = 1.08;
      rafId        = requestAnimationFrame(tick);
    }

    /**
     * Cancel the hold and reset the ring unless it already completed.
     * Adds a shake animation so the cancellation is never silent.
     */
    function cancel() {
      if (completed) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      startTime   = null;
      targetScale = 1;
      // Spring back to 1 on the next available frame.
      requestAnimationFrame(function snapBack() {
        currentScale += (1 - currentScale) * 0.18;
        applyScale();
        if (Math.abs(currentScale - 1) > 0.002) {
          requestAnimationFrame(snapBack);
        } else {
          currentScale = 1;
          applyScale();
        }
      });
      resetProgress();

      // Shake — CSS keyframe via class, removed after animation completes.
      btn.classList.remove("hold-btn--shake");
      // Force reflow so re-adding the class re-triggers the animation.
      void btn.offsetWidth;
      btn.classList.add("hold-btn--shake");
      setTimeout(() => btn.classList.remove("hold-btn--shake"), 320);
    }

    /**
     * Called once the ring reaches 100%. Awards XP, fires juice effects,
     * and advances to the next act section.
     */
    function onComplete() {
      // ── Audio ──────────────────────────────────────────────────────────
      if (window.AudioFX) AudioFX.play("act-complete");

      // ── Juice: impact punch + particle burst + screen flash ────────────
      btn.classList.add("hold-btn--impact");
      setTimeout(() => btn.classList.remove("hold-btn--impact"), 300);

      spawnBurst(btn);
      flashScreen();

      // Spring scale back to 1 after the impact.
      targetScale = 1;

      // ── XP + advance ───────────────────────────────────────────────────
      if (window.HudXP) window.HudXP.add(100);

      const section = btn.closest(".act");
      const next    = section ? section.nextElementSibling : null;
      if (next && window.SceneScroll) {
        window.SceneScroll.scrollToAct(next.id);
      }
    }

    // ── Pointer / touch events ─────────────────────────────────────────────
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup",   cancel);
    btn.addEventListener("pointerleave", cancel);

    // touchstart fires before pointerdown on many mobile browsers. Using
    // preventDefault() here stops the synthetic mouse events that would
    // otherwise call start() a second time, eliminating the double-fire.
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      start();
    }, { passive: false });
    btn.addEventListener("touchend", cancel);

    // ── Keyboard activation ────────────────────────────────────────────────
    // Hold buttons are pointer-only by design, but keyboard users must have
    // at least one reachable activation path. Enter or Space instantly
    // triggers onComplete() (skipping the 1.2 s hold timer).
    btn.setAttribute("tabindex", btn.getAttribute("tabindex") ?? "0");

    btn.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (completed) return;
      setProgress(1);
      completed = true;
      setTimeout(onComplete, 180);
    });
  });
})();
