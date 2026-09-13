/**
 * holdButton.js
 * Generic "press and hold until the ring fills" interaction. Wires up
 * every element matching .hold-btn: on pointerdown it starts filling
 * the paired SVG ring (id="<btn-id>-fill"); on release before 100% it
 * resets; on reaching 100% it awards XP and advances scroll to the
 * next .act section.
 *
 * QA fixes applied:
 *  - Double-fire guard: `start()` cancels any in-flight RAF before
 *    beginning a new one, preventing pointerdown+touchstart from both
 *    running the animation simultaneously on touch devices.
 *  - Keyboard support: pressing Enter or Space on a focused hold-btn
 *    instantly completes it (matching WCAG "at least one accessible
 *    activation method" for pointer-only controls).
 */
(function () {
  "use strict";

  const HOLD_DURATION_MS   = 1200;
  const RING_CIRCUMFERENCE = 289; // 2 * PI * r(46), matches styles.css

  document.querySelectorAll(".hold-btn").forEach((btn) => {
    const ring = document.getElementById(`${btn.id}-fill`);
    if (!ring) return;

    let startTime = null;
    let rafId     = null;
    let completed = false;

    /** @param {number} fraction 0..1 */
    function setProgress(fraction) {
      const offset = RING_CIRCUMFERENCE * (1 - fraction);
      ring.style.strokeDashoffset = String(offset);
    }

    /** @param {DOMHighResTimeStamp} now */
    function tick(now) {
      if (startTime === null) startTime = now;
      const elapsed  = now - startTime;
      const fraction = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setProgress(fraction);

      if (fraction >= 1 && !completed) {
        completed = true;
        onComplete();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    /**
     * Begin (or restart) the hold animation.
     * Cancels any already-running RAF first, which prevents the
     * pointerdown + touchstart double-fire on mobile touch devices.
     */
    function start() {
      // Cancel any in-flight animation to prevent double-running.
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      completed  = false;
      startTime  = null;
      rafId      = requestAnimationFrame(tick);
    }

    /**
     * Cancel the hold and reset the ring unless it already completed.
     */
    function cancel() {
      if (completed) return;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      startTime = null;
      setProgress(0);
    }

    /**
     * Called once the ring reaches 100%. Awards XP and advances to the
     * next act section.
     */
    function onComplete() {
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

    // ── Keyboard activation (Task 3 QA fix) ───────────────────────────────
    // Hold buttons are pointer-only by design, but keyboard users must have
    // at least one reachable activation path. Enter or Space instantly
    // triggers onComplete() (skipping the 1.2 s hold timer) so keyboard
    // navigation can complete the full flow.
    btn.setAttribute("tabindex", btn.getAttribute("tabindex") ?? "0");

    btn.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (completed) return;
      // Animate the ring to full in one frame, then complete.
      setProgress(1);
      completed = true;
      // Small delay so the full ring is visible before scroll fires.
      setTimeout(onComplete, 180);
    });
  });
})();
