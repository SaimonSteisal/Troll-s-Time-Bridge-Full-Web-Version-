// src/config/gameConfig.js
// Central Phaser configuration. Everything tunable lives here so scenes stay dumb.

import { WORLD as WORLD_CONST } from './constants.js';

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/** Prototype world bounds. Single source of truth: constants.js (STEP 5 -> real map). */
export const WORLD = WORLD_CONST;

export const GAME_CONFIG = {
  type: Phaser.AUTO, // WebGL with automatic Canvas fallback (older mobile WebViews)
  // Mobile-first sizing: match the actual window (portrait or landscape) so the
  // canvas never renders "tiny" inside a mismatched viewport. These act as the
  // initial size only; Scale.RESIZE below keeps them in sync on rotate/resize.
  width: typeof window !== 'undefined' ? window.innerWidth : DESIGN_WIDTH,
  height: typeof window !== 'undefined' ? window.innerHeight : DESIGN_HEIGHT,
  parent: 'game-root',
  backgroundColor: '#0d0b12',

  scale: {
    // RESIZE + CENTER_BOTH = adaptive sizing for both portrait and landscape:
    // the game surface always fills the browser window exactly, so virtual
    // touch controls (joystick / attack button) can be anchored to real screen
    // edges instead of letterboxed dead zones. FIT was shrinking everything down
    // when a portrait window didn't match the 1280x720 landscape design ratio.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-root',
    width: '100%',
    height: '100%',
  },

  input: {
    // We poll the raw Gamepad API ourselves in InputManager (Phaser's pad mapping
    // is deadzone-heavy and inconsistent across browsers), but we still need
    // gamepad events enabled so the browser wakes the device up on first press.
    gamepad: true,
    // Touch must not be swallowed by the DOM layer.
    mouse: { preventDefaultGD: true },
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // top-down game: no gravity
      debug: false, // flip to true while tuning hitboxes
    },
  },

  render: {
    pixelArt: true,   // crisp nearest-neighbour sampling for the pixel-art pipeline
    antialias: false,
    // NOTE: roundPixels is intentionally OFF. Phaser's built-in camera smoothing
    // (startFollow lerp) snaps to whole pixels when it is on, which makes the
    // laggy follow visibly stutter at low lerp factors. The grid test world has
    // thin lines that could shimmer a little - acceptable until real sprites land.
    roundPixels: false,
  },

  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};
