/**
 * app.js
 * Entry point. The individual modules (scrollEngine, hudController,
 * gestureGate, holdButton, audioEngine) self-initialize via IIFEs on
 * script load, so this file is the single place for cross-module wiring.
 */
(function () {
  "use strict";

  /** Wire the HUD mute button to AudioFX.toggleMute(). */
  const muteBtn = document.getElementById("hud-mute");
  if (muteBtn && window.AudioFX) {
    muteBtn.addEventListener("click", () => {
      const muted = AudioFX.toggleMute();
      muteBtn.textContent  = muted ? "🔇" : "🔊";
      muteBtn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    });
  }

  console.log("RKAZN — all modules loaded.");
})();

