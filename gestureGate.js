/**
 * gestureGate.js
 * Renders a freehand drawing trail on a full-screen canvas and detects
 * whether the user has traced a roughly closed loop (a "circle") around
 * the guide ring. On success: fires an XP toast, unlocks page scroll,
 * and reveals the HUD.
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
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(224, 181, 99, 0.9)"; // brass-bright
    ctx.lineWidth = 3;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  let isDrawing = false;
  let points = [];

  function pointerPos(evt) {
    const touch = evt.touches && evt.touches[0];
    const x = touch ? touch.clientX : evt.clientX;
    const y = touch ? touch.clientY : evt.clientY;
    return { x, y };
  }

  function startDraw(evt) {
    isDrawing = true;
    points = [pointerPos(evt)];
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
  }

  function moveDraw(evt) {
    if (!isDrawing) return;
    const p = pointerPos(evt);
    points.push(p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function endDraw() {
    if (!isDrawing) return;
    isDrawing = false;
    if (isClosedLoop(points)) {
      unlockGate();
    } else {
      // Not a valid loop — fade the trail and let them try again.
      setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 300);
    }
  }

  /**
   * Heuristic loop detection: the path must (a) travel a minimum total
   * distance, (b) sweep close to a full 360° around its centroid, and
   * (c) end near where it started.
   * @param {{x:number, y:number}[]} pathPoints
   * @returns {boolean}
   */
  function isClosedLoop(pathPoints) {
    if (pathPoints.length < 20) return false;

    const cx = pathPoints.reduce((sum, p) => sum + p.x, 0) / pathPoints.length;
    const cy = pathPoints.reduce((sum, p) => sum + p.y, 0) / pathPoints.length;

    let totalAngle = 0;
    let prevAngle = Math.atan2(pathPoints[0].y - cy, pathPoints[0].x - cx);

    for (let i = 1; i < pathPoints.length; i++) {
      const angle = Math.atan2(pathPoints[i].y - cy, pathPoints[i].x - cx);
      let delta = angle - prevAngle;
      // Normalize to [-PI, PI] to avoid jump artifacts at the wrap-around.
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      totalAngle += delta;
      prevAngle = angle;
    }

    const start = pathPoints[0];
    const end = pathPoints[pathPoints.length - 1];
    const closeDistance = Math.hypot(end.x - start.x, end.y - start.y);

    const sweptFullCircle = Math.abs(totalAngle) > Math.PI * 1.5; // ~270°+
    const endsNearStart = closeDistance < 120;

    return sweptFullCircle && endsNearStart;
  }

  function unlockGate() {
    if (xpToast) xpToast.classList.add("is-visible");
    if (window.HudXP) window.HudXP.add(100);

    setTimeout(() => {
      gate.classList.add("is-open");
      document.body.classList.remove("is-locked");
      if (window.showHud) window.showHud();
      if (window.SceneScroll) window.SceneScroll.refresh();
    }, 500);
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("touchstart", startDraw, { passive: true });
  canvas.addEventListener("touchmove", moveDraw, { passive: true });
  canvas.addEventListener("touchend", endDraw);
})();
