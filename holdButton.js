/**
 * holdButton.js
 * Generic "press and hold until the ring fills" interaction. Wires up
 * every element matching .hold-btn: on pointerdown it starts filling
 * the paired SVG ring (id="<btn-id>-fill"); on release before 100% it
 * resets; on reaching 100% it awards XP and advances scroll to the
 * next .act section.
 */
(function () {
  "use strict";

  const HOLD_DURATION_MS = 1200;
  const RING_CIRCUMFERENCE = 289; // 2 * PI * r(46), matches styles.css

  document.querySelectorAll(".hold-btn").forEach((btn) => {
    const ring = document.getElementById(`${btn.id}-fill`);
    if (!ring) return;

    let startTime = null;
    let rafId = null;
    let completed = false;

    function setProgress(fraction) {
      const offset = RING_CIRCUMFERENCE * (1 - fraction);
      ring.style.strokeDashoffset = String(offset);
    }

    function tick(now) {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const fraction = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setProgress(fraction);

      if (fraction >= 1 && !completed) {
        completed = true;
        onComplete();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function start() {
      completed = false;
      startTime = null;
      rafId = requestAnimationFrame(tick);
    }

    function cancel() {
      if (completed) return;
      if (rafId) cancelAnimationFrame(rafId);
      startTime = null;
      setProgress(0);
    }

    function onComplete() {
      if (window.HudXP) window.HudXP.add(100);

      // Find this act's section and jump to the next one, if any.
      const section = btn.closest(".act");
      const next = section ? section.nextElementSibling : null;
      if (next && window.SceneScroll) {
        window.SceneScroll.scrollToAct(next.id);
      }
    }

    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", cancel);
    btn.addEventListener("pointerleave", cancel);
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      start();
    }, { passive: false });
    btn.addEventListener("touchend", cancel);
  });
})();
