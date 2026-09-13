/**
 * app.js
 * Entry point. The individual modules (scrollEngine, hudController,
 * gestureGate, holdButton) self-initialize via IIFEs on script load,
 * so this file is intentionally minimal — it exists as the single
 * place to add future cross-module wiring (e.g. audio cues, act
 * transition hooks) as the site grows past this skeleton.
 */
(function () {
  "use strict";
  console.log("Skeleton loaded — Act 0 (gate) and Act 1 (hold-to-continue) are wired up.");
})();
