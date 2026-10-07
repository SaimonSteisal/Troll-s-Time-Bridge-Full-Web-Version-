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

/** Test world for the movement/camera step: big enough that camera follow is obvious. */
export const WORLD = {
  width: 2000,
  height: 2000,
  TILE: 100,              // grid cell size drawn by BootScene (major lines every 5 tiles)
};

// ── Procedural dungeon (Variant C: Random Rooms + Corridors) ────────────────
// The dungeon lives on its own 32px tile grid inside the WORLD bounds.
export const DUNGEON = Object.freeze({
  TILE: 32,               // tile size in px (requirement)
  WIDTH_PX: 2000,         // world size in px (camera + physics bounds match WORLD)
  HEIGHT_PX: 2000,
  COLS: Math.ceil(2000 / 32), // 63 columns (63*32 = 2016 >= 2000)
  ROWS: Math.ceil(2000 / 32), // 63 rows
  MIN_ROOMS: 8,
  MAX_ROOMS: 12,
  ROOM_MIN_PX: 150,       // requirement: rooms between 150x150 and 350x350 px
  ROOM_MAX_PX: 350,
  ROOM_BUFFER_PX: 50,     // minimum empty gap between any two rooms
  CORRIDOR_WIDTH_PX: 64,  // corridors are 2 tiles wide
  MAX_PLACEMENT_ATTEMPTS: 300, // per-room rejection-sampling attempts
});

// Tile ids used by DungeonGenerator + the tilemap layers.
export const TILE = Object.freeze({
  WALL: 0,   // solid, collidable
  FLOOR: 1,  // room floor (walkable)
  CORRIDOR: 2, // corridor floor (walkable, lighter shade)
});

export const DUNGEON_COLORS = Object.freeze({
  FLOOR: '#3a3a3a',       // dark gray room floor
  FLOOR_GRID: '#444444',  // subtle grid pattern on floor tiles
  WALL: '#2a2a2a',        // darker gray wall fill
  WALL_BORDER: '#151515', // wall border / inner shading
  CORRIDOR: '#4a4a4a',    // corridors: same family but slightly lighter
  ENTRANCE: '#3ddc5a',    // green marker -> player spawn room
  BOSS: '#e64545',        // red marker -> future boss room
  ENEMY_SPAWN: '#e6d13c', // yellow markers -> future enemy spawn rooms
});

export const PLAYER = {
  SPEED: 200,             // px/s at full stick / key press
  MOVE_LERP: 0.12,        // per-frame lerp factor toward target velocity (0.1-0.15)
  STOP_EPSILON: 4,        // px/s below which we snap velocity to exactly 0
  RADIUS: 44,             // hitbox radius inside the 96px placeholder texture
  TEXTURE: 96,            // ph-player texture size (centered art)
  SCALE: 1.5,             // display scale (keeps the body clearly visible on phones)
  START_HP: 100,
  // Movement-state feedback (placeholder graphics until STEP 3 sprites land)
  IDLE_TINT: 0x66bb6a,    // green while standing still
  MOVING_TINT: 0xb9f6ca,  // brighter green while moving
  TILT_DEG: 14,           // max lean angle toward the movement direction
  BOB_SPEED: 12,          // bobbing cycles/sec at full speed
  BOB_AMP_PX: 5,          // vertical squash amplitude (scale pulse)
  ATTACK_LERP: 0.35,      // rotation/tint smoothing factor
};

export const CAMERA = {
  LERP: 0.09,             // follow smoothing (0.08-0.1 = pleasant lag)
  ROUND: false,           // sub-pixel follow looks smoother with vector placeholders
};

export const ATTACK_FX = {
  DURATION_MS: 260,       // expanding-ring lifetime
  RADIUS_FACTOR: 2.4,     // ring reaches player display-radius x this
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
  ATTACK_COOLDOWN_MS: 500, // attack button cooldown (also drives the visual sweep)
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
  GRID_MINOR: 0x3c3648,   // fine grid lines on the test world
  GRID_MAJOR: 0x5a5170,   // every 5th line + world border (movement is easier to read)
  PLAYER: 0x4fc3f7,
  PLAYER_DIR: 0xffffff,
  ATTACK_FX: 0xffe082,    // expanding attack ring / flash
  ENEMY: 0xef5350,
  ENEMY_AGGRO: 0xffb300,
  LOOT: 0xffd54f,
  UI_BG: 0x000000,
  HP: 0x66bb6a,
  HP_BACK: 0x1b1b1b,
};
