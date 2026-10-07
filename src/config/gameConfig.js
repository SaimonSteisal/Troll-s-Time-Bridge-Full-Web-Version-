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
    roundPixels: true, // kills sprite shimmer/tile seams at non-integer camera positions
  },

  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
};
