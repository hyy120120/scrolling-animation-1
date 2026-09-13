/**
 * audioEngine.js
 * Lightweight one-shot + looping audio player for game-feel feedback.
 * Exposes window.AudioFX with:
 *   play(name)      — plays a named sound effect once
 *   toggleMute()    — toggles global mute (in-memory only, no localStorage)
 *   isMuted()       — returns current mute state
 *
 * Resilience:
 *   - Every play() call is wrapped in try/catch; a missing or corrupt .mp3
 *     never throws an uncaught error or breaks the visual experience.
 *   - Audio.load() failures are swallowed silently.
 *   - The ambient loop uses a deferred-play pattern: if the browser's
 *     autoplay policy blocks the first play() attempt (common in Chrome/Safari
 *     when the gesture-chain is > 1 hop deep), the engine queues a one-time
 *     retry on the next pointerdown/click anywhere on the document.
 */
(function () {
  "use strict";

  /* ── Design tokens (must match styles.css :root) ─────────────────────── */
  const AMBIENT_VOLUME = 0.22;
  const TICK_THROTTLE_MS = 145; // minimum gap between hold-tick plays

  /* ── Internal state ──────────────────────────────────────────────────── */
  let _muted = false;
  let _lastTickAt = 0;
  let _ambientRetryPending = false;

  /* ── Sound registry ──────────────────────────────────────────────────── */
  /**
   * Map of sound key → Audio instance. We create one Audio object per named
   * sound and reuse it (cloning for overlapping one-shots where needed).
   * @type {Object.<string, HTMLAudioElement>}
   */
  const _clips = {};

  /**
   * Paths to each named sound, relative to the document root.
   * The actual .mp3 files are supplied externally; we reference exact filenames
   * so they can be dropped in without any code change.
   * @type {Object.<string, string>}
   */
  const SOUND_MAP = {
    "gate-unlock": "assets/sounds/gate-unlock.mp3",
    "xp-gain":     "assets/sounds/xp-gain.mp3",
    "hold-tick":   "assets/sounds/hold-tick.mp3",
    "act-complete":"assets/sounds/act-complete.mp3",
    "ambient-loop":"assets/sounds/ambient-loop.mp3",
  };

  /**
   * Pre-create Audio elements for each named sound. Failures (e.g. 404 when
   * files aren't present yet) are caught so the rest of the engine still works.
   */
  function preload() {
    Object.entries(SOUND_MAP).forEach(([name, src]) => {
      try {
        const audio = new Audio();
        audio.preload = "auto";
        if (name === "ambient-loop") {
          audio.loop = true;
          audio.volume = AMBIENT_VOLUME;
        } else {
          audio.volume = 0.6;
        }
        // Swallow load errors — file may not exist yet.
        audio.addEventListener("error", () => {}, { once: true });
        audio.src = src;
        _clips[name] = audio;
      } catch (e) {
        // Audio constructor unavailable in test environments; ignore.
      }
    });
  }

  /* ── Ambient loop with autoplay-retry ──────────────────────────────────
   * Chrome / Safari require that Audio.play() is called within a short
   * call-stack that originates from a user gesture. When we call play()
   * inside a setTimeout() (which is what unlockGate() does), the browser
   * may reject the promise. We catch that rejection and queue a one-shot
   * retry on the very next user interaction anywhere on the page.
   * ──────────────────────────────────────────────────────────────────── */

  /**
   * Attach a single-use listener that retries ambient-loop playback on the
   * next real user gesture (pointerdown or click). Idempotent — only registers
   * once even if called multiple times.
   */
  function _queueAmbientRetry() {
    if (_ambientRetryPending) return;
    _ambientRetryPending = true;

    const retry = () => {
      _ambientRetryPending = false;
      if (_muted) return;
      const clip = _clips["ambient-loop"];
      if (!clip) return;
      try {
        clip.play().catch(() => {
          // Still blocked (e.g. user muted the tab) — give up gracefully.
        });
      } catch (e) {}
    };

    document.addEventListener("pointerdown", retry, { once: true, capture: true });
    document.addEventListener("click",       retry, { once: true, capture: true });
  }

  /**
   * Start the ambient loop. Handles autoplay-policy rejection automatically.
   */
  function _startAmbient() {
    if (_muted) return;
    const clip = _clips["ambient-loop"];
    if (!clip) return;
    try {
      const promise = clip.play();
      if (promise && typeof promise.then === "function") {
        promise.catch((err) => {
          // NotAllowedError = autoplay blocked — schedule retry.
          if (err && err.name === "NotAllowedError") {
            _queueAmbientRetry();
          }
        });
      }
    } catch (e) {
      _queueAmbientRetry();
    }
  }

  /* ── Public API ─────────────────────────────────────────────────────── */

  /**
   * Play a named one-shot sound effect. For overlapping sounds (e.g. hold-tick
   * that can fire while a previous tick is still playing) we clone the Audio
   * node so both instances can play simultaneously.
   * Special handling:
   *   - "hold-tick" is throttled to TICK_THROTTLE_MS to prevent spam.
   *   - "ambient-loop" delegates to _startAmbient() for retry logic.
   * @param {string} name  Key from SOUND_MAP.
   */
  function play(name) {
    if (_muted) return;

    // Ambient loop has its own start function.
    if (name === "ambient-loop") {
      _startAmbient();
      return;
    }

    // Throttle rapid-fire tick sounds.
    if (name === "hold-tick") {
      const now = Date.now();
      if (now - _lastTickAt < TICK_THROTTLE_MS) return;
      _lastTickAt = now;
    }

    const clip = _clips[name];
    if (!clip) return;

    try {
      // Clone so overlapping plays don't cut each other off.
      const instance = clip.cloneNode();
      instance.volume = clip.volume;
      instance.play().catch(() => {});
    } catch (e) {}
  }

  /**
   * Toggle global mute state. When muting, also pause the ambient loop.
   * When un-muting, restart it.
   * @returns {boolean} New mute state.
   */
  function toggleMute() {
    _muted = !_muted;

    const ambient = _clips["ambient-loop"];
    if (!ambient) return _muted;

    if (_muted) {
      try { ambient.pause(); } catch (e) {}
    } else {
      _startAmbient();
    }

    return _muted;
  }

  /**
   * @returns {boolean} Whether audio is currently muted.
   */
  function isMuted() {
    return _muted;
  }

  /* ── Initialise ──────────────────────────────────────────────────────── */
  preload();

  window.AudioFX = { play, toggleMute, isMuted };
})();
