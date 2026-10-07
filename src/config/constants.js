// src/config/constants.js
// Abstract action vocabulary + tunable gameplay numbers.
// NOTE (STEP 4 contract): entities NEVER read keys/mouse/gamepad directly.
// They only consume the actions exported here.

export const ACTIONS = Object.freeze({
  MOVE: 'MOVE',           // analogue vector: { x, y }, magnitude 0..1
  ATTACK: 'ATTACK',       // digital + "justPressed" edge
  INTERACT: 'INTERACT',   // digital + "justPressed" edge
  DASH: 'DASH',           // digital + "justPressed" edge
  PAUSE: 'PAUSE',         // digital + "justPressed" edge
});

/** Prototype arena bounds. STEP 5 grows this into a real Tiled/room-based map. */
export const WORLD = {
  width: 2560,
  height: 1440,
};

export const PLAYER = {
  SPEED: 260,             // px/s at full stick / key press
  ACCELERATION: 8,        // exponential-approach smoothing factor (higher = snappier)
  RADIUS: 14,             // placeholder body radius
  START_HP: 100,
};

export const ENEMY = {
  PATROL_SPEED: 70,
  CHASE_SPEED: 150,
  AGGRO_RADIUS: 220,
  LEASH_RADIUS: 420,      // distance from spawn point before we give up the chase
  RADIUS: 15,
  HP: 40,
};

export const COMBAT = {
  ATTACK_DAMAGE: 12,
  ATTACK_RANGE: 52,
  ATTACK_ARC_DEG: 110,
  ATTACK_COOLDOWN_MS: 380,
  HURT_INVULN_MS: 400,
};

/**
 * Virtual touch controls (mobile). Sizes are in *screen* pixels and scale with
 * the viewport, so the joystick stays comfortably thumb-sized in portrait mode.
 */
export const TOUCH_CONTROLS = Object.freeze({
  BASE_SIZE: 140,          // reference joystick diameter (at 720p)
  MIN_RADIUS: 60,          // never smaller than this (px)
  MAX_RADIUS: 110,         // never larger than this (px)
  EDGE_MARGIN_FRACTION: 0.12, // distance from screen edge, as fraction of min(w,h)
});

// Placeholder palette (STEP 3 replaces these with real sprites).
export const COLORS = {
  FLOOR: 0x2b2735,
  FLOOR_GRID: 0x37323f,
  PLAYER: 0x4fc3f7,
  PLAYER_DIR: 0xffffff,
  ENEMY: 0xef5350,
  ENEMY_AGGRO: 0xffb300,
  LOOT: 0xffd54f,
  UI_BG: 0x000000,
  HP: 0x66bb6a,
  HP_BACK: 0x1b1b1b,
};
