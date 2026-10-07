// src/config/gameConfig.js
// Central Phaser configuration. Everything tunable lives here so scenes stay dumb.

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;

/** World bounds for the prototype arena (STEP 5 will grow this into a real map). */
export const WORLD = {
  width: 2560,
  height: 1440,
};

export const GAME_CONFIG = {
  type: Phaser.AUTO, // WebGL with automatic Canvas fallback (older mobile WebViews)
  parent: 'game-root',
  backgroundColor: '#0d0b12',

  scale: {
    // FIT + CENTER_BOTH = the canonical cross-platform setup:
    // the game keeps its aspect ratio and letterboxes instead of stretching.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    // Let the canvas grow past design size on big desktop monitors without blurring.
    zoom: 1,
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
    roundPixels: true, // kills sprite shimmer/tile seams at non-integer camera positions
  },

  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};
