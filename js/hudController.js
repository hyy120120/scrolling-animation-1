/**
 * hudController.js
 * Listens to "scene:progress" events from scrollEngine.js and updates
 * the fixed HUD plus reveals each act's text content once it is
 * sufficiently in view.
 *
 * Juice-pass additions (non-destructive):
 *  Task 1 — AudioFX.play("xp-gain") wired into HudXP.add().
 *  Task 3 — Floating "+N XP" score popup spawned on every HudXP.add() call;
 *            XP badge receives a quick scale-punch; the star icon has an
 *            idle pulse animation (CSS class applied on HUD reveal).
 *  Task 4 — The linear ticker bar is replaced by a 5-checkpoint "level-map"
 *            dot trail (Gate → Act 1 → Act 2 → Act 3 → Act 4). Built
 *            dynamically here so index.html needs no structural change beyond
 *            the existing hud-center wrapper. The old hud-ticker-fill element
 *            is no longer present, but the getElementById() call returns null
 *            gracefully (existing `if (tickerFill)` guard protects it).
 */
(function () {
  "use strict";

  const hud       = document.getElementById("hud");
  const tickerFill = document.getElementById("hud-ticker-fill"); // may be null after trail replaces it

  /* ── Task 4: Level-map dot trail ────────────────────────────────────────
   * 5 checkpoint dots, one per act. Connected by thin lines.
   * Built inside .hud-center, replacing the old ticker-track markup.
   * ────────────────────────────────────────────────────────────────────── */

  /**
   * Act IDs in scene order. "gate" is a synthetic first dot (no .act element)
   * representing the draw-circle unlock moment.
   * @type {string[]}
   */
  const ACT_IDS = ["gate", "act-1", "act-2", "act-3", "act-4"];

  /** @type {HTMLElement[]} — dot elements in ACT_IDS order */
  const _dots = [];

  /** Previously active act index — used to detect first-reach transitions. */
  let _prevActiveIdx = -1;

  /** Which acts have ever been "reached" — prevents re-popping on re-scroll. */
  const _reached = new Set();

  /**
   * Build the trail DOM inside .hud-center, replacing the old linear ticker.
   */
  function buildTrail() {
    const center = document.querySelector(".hud-center");
    if (!center) return;

    // Remove existing ticker markup.
    const oldTrack = center.querySelector(".hud-ticker-track");
    if (oldTrack) oldTrack.remove();

    const trail = document.createElement("div");
    trail.className = "hud-trail";
    trail.setAttribute("aria-hidden", "true");

    ACT_IDS.forEach((id, i) => {
      // Connecting line before every dot except the first.
      if (i > 0) {
        const line = document.createElement("div");
        line.className = "hud-trail-line";
        trail.appendChild(line);
      }

      const dot = document.createElement("div");
      dot.className = "hud-dot";
      dot.dataset.actId = id;
      dot.title = id === "gate" ? "Gate" : `Act ${id.replace("act-", "")}`;
      _dots.push(dot);
      trail.appendChild(dot);
    });

    // Insert trail before the ticker label so the label stays below.
    const label = center.querySelector(".hud-ticker-label");
    if (label) {
      center.insertBefore(trail, label);
    } else {
      center.appendChild(trail);
    }
  }

  /**
   * Update dots based on which act is currently active.
   * @param {{ id: string, progress: number }[]} acts  From scene:progress.
   */
  function updateTrail(acts) {
    // Determine the highest act index with progress > 0.08 (same threshold
    // as the act-content reveal, so dots stay in sync with visible content).
    let activeIdx = 0; // gate is always "reached" once the HUD is visible

    acts.forEach(({ id, progress }) => {
      const idx = ACT_IDS.indexOf(id);
      if (idx !== -1 && progress > 0.08) {
        activeIdx = Math.max(activeIdx, idx);
      }
    });

    _dots.forEach((dot, i) => {
      const isReached = i <= activeIdx;
      const isActive  = i === activeIdx;

      dot.classList.toggle("hud-dot--reached", isReached);
      dot.classList.toggle("hud-dot--active",  isActive);

      // "Pop" animation fires exactly once per dot, the first time it's reached.
      if (isReached && !_reached.has(i)) {
        _reached.add(i);
        dot.classList.add("hud-dot--pop");
        setTimeout(() => dot.classList.remove("hud-dot--pop"), 500);
      }
    });

    _prevActiveIdx = activeIdx;
  }

  buildTrail();

  /* ── scene:progress listener ─────────────────────────────────────────── */
  window.addEventListener("scene:progress", (event) => {
    const { acts } = event.detail;

    // Linear ticker fill (kept for safety — element removed in HTML refresh
    // but guard prevents errors if it exists in older markup).
    if (tickerFill) {
      tickerFill.style.width = `${(event.detail.page * 100).toFixed(1)}%`;
    }

    // Act-content reveal (unchanged logic).
    acts.forEach(({ id, progress }) => {
      const contentEl = document.querySelector(`#${id} .act-content`);
      if (!contentEl) return;
      contentEl.classList.toggle("is-in-view", progress > 0.08);
    });

    // Level-map dot trail update.
    updateTrail(acts);
  });

  /* ── HUD reveal ──────────────────────────────────────────────────────── */
  /**
   * Called by gestureGate.js once the unlock gesture succeeds.
   * Also marks the "gate" dot as reached immediately.
   */
  window.showHud = function showHud() {
    if (hud) hud.classList.add("is-visible");
    // Gate dot (index 0) pops the moment the HUD appears.
    if (_dots[0] && !_reached.has(0)) {
      _reached.add(0);
      _dots[0].classList.add("hud-dot--reached", "hud-dot--pop");
      setTimeout(() => _dots[0].classList.remove("hud-dot--pop"), 500);
    }
  };

  /* ── Task 3: XP floater helper ───────────────────────────────────────── */

  /**
   * Spawn a floating "+N XP" label above the XP badge that animates upward
   * and fades out over ~800 ms, like a score popup in a platformer.
   * Uses position:fixed so it never affects layout or causes overflow.
   * @param {number} amount
   */
  function spawnXpFloater(amount) {
    const xpEl = document.getElementById("hud-xp-count");
    if (!xpEl) return;

    const rect = xpEl.getBoundingClientRect();
    const floater = document.createElement("span");
    floater.className = "xp-floater";
    floater.textContent = `+${amount}`;
    floater.style.cssText = [
      `left:${(rect.left + rect.width / 2).toFixed(0)}px`,
      `top:${rect.top.toFixed(0)}px`,
    ].join(";");

    document.body.appendChild(floater);

    // Trigger animation on next frame (must be in DOM first).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => floater.classList.add("xp-floater--fly"));
    });

    setTimeout(() => { if (floater.parentNode) floater.remove(); }, 900);
  }

  /* ── XP tracker ──────────────────────────────────────────────────────── */
  let xp = 0;
  const xpEl    = document.getElementById("hud-xp-count");
  const xpBadge = document.querySelector(".hud-xp");

  window.HudXP = {
    add(amount) {
      xp += amount;
      if (xpEl) xpEl.textContent = `${xp} XP`;

      // ── Audio (Task 1) ────────────────────────────────────────────────
      if (window.AudioFX) AudioFX.play("xp-gain");

      // ── Floater popup (Task 3) ────────────────────────────────────────
      spawnXpFloater(amount);

      // ── Badge scale-punch (Task 3) ────────────────────────────────────
      if (xpBadge) {
        xpBadge.classList.remove("hud-xp--punch");
        void xpBadge.offsetWidth; // force reflow to re-trigger animation
        xpBadge.classList.add("hud-xp--punch");
        setTimeout(() => xpBadge.classList.remove("hud-xp--punch"), 380);
      }
    },
    get value() {
      return xp;
    },
  };
})();
