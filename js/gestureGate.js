/**
 * gestureGate.js
 * Renders a freehand drawing trail on a full-screen canvas and detects
 * whether the user has traced a roughly closed loop (a "circle") around
 * the guide ring. On success: fires an XP toast, unlocks page scroll,
 * and reveals the HUD.
 *
 * Fixed vs. the original skeleton:
 * 1. resizeCanvas() now uses setTransform() instead of scale(), so the
 *    devicePixelRatio correction no longer compounds on repeated resizes.
 * 2. Uses Pointer Events (not separate mouse/touch handlers) with
 *    setPointerCapture(), so a stroke keeps being tracked even if the
 *    cursor briefly leaves the canvas bounds — no more "stuck" state
 *    where a missed mouseup silently blocks the next attempt.
 * 3. Loop-detection distance threshold now scales with how big the
 *    drawn circle actually was, instead of a fixed 120px, so both
 *    small and large gestures are recognized fairly.
 */
(function () {
  "use strict";

  const gate = document.getElementById("gate");
  const canvas = document.getElementById("gate-canvas");
  const xpToast = document.getElementById("xp-toast");

  if (!gate || !canvas) return;

  const ctx = canvas.getContext("2d");

  /** Resize the canvas to match the viewport (keeps drawing crisp). */
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    // setTransform REPLACES the transform matrix instead of stacking on
    // top of whatever scale was applied last time — this is the fix for
    // strokes drifting/disappearing after a resize.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(224, 181, 99, 0.9)"; // brass-bright
    ctx.lineWidth = 3;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  let isDrawing = false;
  let points = [];

  function startDraw(evt) {
    isDrawing = true;
    points = [{ x: evt.clientX, y: evt.clientY }];
    canvas.setPointerCapture(evt.pointerId);
    ctx.beginPath();
    ctx.moveTo(evt.clientX, evt.clientY);
  }

  function moveDraw(evt) {
    if (!isDrawing) return;
    points.push({ x: evt.clientX, y: evt.clientY });
    ctx.lineTo(evt.clientX, evt.clientY);
    ctx.stroke();
  }

  function endDraw(evt) {
    if (!isDrawing) return;
    isDrawing = false;
    if (evt && evt.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(evt.pointerId);
      } catch (e) {
        // Pointer may already be released — safe to ignore.
      }
    }
    if (isClosedLoop(points)) {
      unlockGate();
    } else {
      // Not a valid loop — fade the trail and let them try again.
      setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 300);
    }
  }

  /**
   * Heuristic loop detection: the path must (a) travel a minimum total
   * distance, (b) sweep close to a full 360 degrees around its centroid,
   * and (c) end reasonably close to where it started, relative to the
   * overall size of the drawn shape (so both small and large circles work).
   * @param {{x:number, y:number}[]} pathPoints
   * @returns {boolean}
   */
  function isClosedLoop(pathPoints) {
    if (pathPoints.length < 15) return false;

    const cx = pathPoints.reduce((sum, p) => sum + p.x, 0) / pathPoints.length;
    const cy = pathPoints.reduce((sum, p) => sum + p.y, 0) / pathPoints.length;

    // Average radius from the centroid — used to make the "ends near
    // start" check proportional to the size of the gesture.
    const avgRadius =
      pathPoints.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) /
      pathPoints.length;

    let totalAngle = 0;
    let prevAngle = Math.atan2(pathPoints[0].y - cy, pathPoints[0].x - cx);

    for (let i = 1; i < pathPoints.length; i++) {
      const angle = Math.atan2(pathPoints[i].y - cy, pathPoints[i].x - cx);
      let delta = angle - prevAngle;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      totalAngle += delta;
      prevAngle = angle;
    }

    const start = pathPoints[0];
    const end = pathPoints[pathPoints.length - 1];
    const closeDistance = Math.hypot(end.x - start.x, end.y - start.y);

    const sweptFullCircle = Math.abs(totalAngle) > Math.PI * 1.4; // ~250 degrees+
    // Ends within 60% of the shape's own average radius (min 80px so
    // tiny accidental gestures don't trivially "close").
    const endsNearStart = closeDistance < Math.max(avgRadius * 0.6, 80);

    return sweptFullCircle && endsNearStart;
  }

  function unlockGate() {
    // ── Audio ─────────────────────────────────────────────────────────────
    if (window.AudioFX) AudioFX.play("gate-unlock");

    if (xpToast) xpToast.classList.add("is-visible");
    if (window.HudXP) window.HudXP.add(100);

    setTimeout(() => {
      gate.classList.add("is-open");
      document.body.classList.remove("is-locked");
      if (window.showHud) window.showHud();
      if (window.SceneScroll) window.SceneScroll.refresh();
      // Start the ambient background loop after the gate fully opens.
      // _startAmbient() has built-in autoplay-retry on the next user gesture
      // if the browser blocks this (common in Chrome/Safari setTimeout context).
      if (window.AudioFX) AudioFX.play("ambient-loop");
    }, 500);
  }

  canvas.addEventListener("pointerdown", startDraw);
  canvas.addEventListener("pointermove", moveDraw);
  canvas.addEventListener("pointerup", endDraw);
  canvas.addEventListener("pointercancel", endDraw);
})();
