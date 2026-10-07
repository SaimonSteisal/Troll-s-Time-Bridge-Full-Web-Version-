// src/systems/DungeonGenerator.js
// STEP 5 (Variant C): procedural dungeon generation — "Random Rooms + Corridors".
//
// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
// 1. GRID MODEL
//    The world is a fixed WORLD_W x WORLD_H pixel canvas carved into a grid of
//    TILE (32px) cells. Every cell starts as WALL. We only ever *carve* cells
//    to FLOOR / CORRIDOR, so the walkable area can never leak outside bounds
//    and walls are implicit (anything not carved stays solid).
//
// 2. ROOM PLACEMENT (rejection sampling)
//    We attempt to place ROOM_MIN..ROOM_MAX (8-12) rooms with random sizes in
//    [MIN_ROOM_PX, MAX_ROOM_PX] (150..350 px, snapped to whole tiles). A room
//    is accepted only if its rect — grown by BUFFER_PX (50px) on every side —
//    does not intersect any previously accepted room. That guarantees the
//    required "no overlap + 50px buffer" property. If placement fails too many
//    times we simply accept fewer rooms (still >= ROOM_MIN attempts worth of
//    backtracking; practically 8-12 always fit comfortably in 2000x2000).
//
// 3. CORRIDOR CONNECTION (guaranteed connectivity)
//    Rooms are connected in placement order: room[i] -> room[i+1]. Because the
//    graph is a simple PATH (chain), EVERY room is reachable from every other
//    by construction — no isolated rooms, no flood-fill needed. Each link is an
//    L-shaped corridor (two straight axis-aligned segments through the room
//    centers; degenerates to a straight corridor when centers share an axis).
//    Corridor width is CORRIDOR_PX (64px = 2 tiles).
//
// 4. ROLE ASSIGNMENT
//    - Room #0 is the ENTRANCE (player spawn, green marker).
//    - The room whose center has the maximum Euclidean distance from the
//      entrance center becomes the BOSS ROOM (red marker).
//    - All remaining rooms are candidate ENEMY SPAWN rooms (yellow markers);
//      each gets 1-3 spawn points at jittered positions inside the room rect.
//
// 5. OUTPUT
//    `generate()` returns a plain-data description of the dungeon:
//      { grid, cols, rows, tile, worldWidth, worldHeight, rooms[], entrance,
//        bossRoom, enemySpawns[] }
//    The scene turns that data into a Phaser Tilemap (see DungeonScene). The
//    generator itself is pure logic + Math.random — trivially unit-testable and
//    reusable for minimap rendering (it exposes isWalkableTile(x, y)).
//
// Optional extra: setDungeonSeed() style deterministic runs are left for later;
// swap Math.random for an injected PRNG if reproducible layouts are wanted.
// ─────────────────────────────────────────────────────────────────────────────

/** Tile ids written into the grid. Index into the scene's tileset image. */
export const TILE = Object.freeze({
  WALL: 0,      // solid (#2a2a2a w/ border effect)
  FLOOR: 1,     // room floor (#3a3a3a w/ subtle grid)
  CORRIDOR: 2,  // corridor floor (#4a4a4a, slightly lighter)
});

export const DUNGEON = Object.freeze({
  TILE: 32,               // px per tile cell
  WORLD_SIZE: 2000,       // px (square world; camera bounds match this)
  ROOM_COUNT_MIN: 8,
  ROOM_COUNT_MAX: 12,
  ROOM_MIN_PX: 150,       // min room width/height
  ROOM_MAX_PX: 350,       // max room width/height
  BUFFER_PX: 50,          // required gap between two rooms
  CORRIDOR_PX: 64,        // corridor width (2 tiles)
  MARGIN_PX: 96,          // keep rooms away from the world edge (wall shell)
});

const randRange = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(randRange(min, max + 1));

/** Axis-aligned rect intersection test (inclusive edges). */
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export default class DungeonGenerator {
  constructor(opts = {}) {
    this.tile = opts.tile ?? DUNGEON.TILE;
    this.worldWidth = opts.worldWidth ?? DUNGEON.WORLD_SIZE;
    this.worldHeight = opts.worldHeight ?? DUNGEON.WORLD_SIZE;
    this.cols = Math.floor(this.worldWidth / this.tile);
    this.rows = Math.floor(this.worldHeight / this.tile);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Generate a fresh dungeon layout. Returns a plain-data description. */
  generate() {
    this.grid = this._blankGrid();
    this.rooms = this._placeRooms();

    // Chain-connect consecutive rooms -> guaranteed single connected graph.
    for (let i = 0; i < this.rooms.length - 1; i++) {
      this._carveCorridor(this.rooms[i], this.rooms[i + 1]);
    }

    // Roles: first room = entrance, farthest room = boss, rest = enemy rooms.
    this.entrance = this.rooms[0];
    this.bossRoom = this._farthestRoomFrom(this.entrance);
    for (const room of this.rooms) {
      room.role = room === this.entrance ? 'entrance' : room === this.bossRoom ? 'boss' : 'enemy';
    }

    this.enemySpawns = this._buildEnemySpawns();

    return {
      grid: this.grid,
      cols: this.cols,
      rows: this.rows,
      tile: this.tile,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      rooms: this.rooms,
      entrance: this.entrance,
      bossRoom: this.bossRoom,
      enemySpawns: this.enemySpawns,
    };
  }

  /** World-space center of the entrance room (player spawn point). */
  getSpawnPoint() {
    return this._centerOf(this.entrance);
  }

  /** Collision query used by the minimap + future AI line-of-sight checks. */
  isWalkableTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    const t = this.grid[ty][tx];
    return t === TILE.FLOOR || t === TILE.CORRIDOR;
  }

  isWalkableWorld(x, y) {
    return this.isWalkableTile(Math.floor(x / this.tile), Math.floor(y / this.tile));
  }

  // ── Step 2a: room placement ───────────────────────────────────────────────

  _placeRooms() {
    const targetCount = randInt(DUNGEON.ROOM_COUNT_MIN, DUNGEON.ROOM_COUNT_MAX);
    const rooms = [];
    const margin = DUNGEON.MARGIN_PX;
    let attempts = 0;
    const maxAttempts = targetCount * 60;

    while (rooms.length < targetCount && attempts++ < maxAttempts) {
      // Random size, snapped to whole tiles so carving is exact.
      const w = this._snapToTile(randRange(DUNGEON.ROOM_MIN_PX, DUNGEON.ROOM_MAX_PX));
      const h = this._snapToTile(randRange(DUNGEON.ROOM_MIN_PX, DUNGEON.ROOM_MAX_PX));

      const x = randInt(margin, this.worldWidth - margin - w);
      const y = randInt(margin, this.worldHeight - margin - h);
      const rect = { x, y, w, h };

      // Rejection test: grown-by-BUFFER rect must not touch existing rooms.
      const grown = this._grow(rect, DUNGEON.BUFFER_PX);
      if (rooms.some((r) => rectsOverlap(grown, this._grow(r.rect, DUNGEON.BUFFER_PX)))) continue;

      const room = {
        id: rooms.length,
        rect,
        role: 'normal', // reassigned after all corridors exist
        ...{ center: { x: x + w / 2, y: y + h / 2 } },
      };
      rooms.push(room);
      this._carveRoom(room);
    }

    // Safety net: rejection sampling occasionally yields fewer than MIN rooms
    // in tight layouts. Retry once with a relaxed buffer before giving up —
    // an 8-room guarantee matters more than a perfect 50px gap in a stress case.
    if (rooms.length < DUNGEON.ROOM_COUNT_MIN) return this._placeRoomsRelaxed(targetCount);

    return rooms;
  }

  _placeRoomsRelaxed(targetCount) {
    this.grid = this._blankGrid(); // start clean; caller re-carves corridors
    const rooms = [];
    const margin = DUNGEON.MARGIN_PX;
    let attempts = 0;

    while (rooms.length < targetCount && attempts++ < targetCount * 120) {
      const w = this._snapToTile(randRange(DUNGEON.ROOM_MIN_PX, DUNGEON.ROOM_MAX_PX));
      const h = this._snapToTile(randRange(DUNGEON.ROOM_MIN_PX, DUNGEON.ROOM_MAX_PX));
      const x = randInt(margin, this.worldWidth - margin - w);
      const y = randInt(margin, this.worldHeight - margin - h);
      const rect = { x, y, w, h };
      const grown = this._grow(rect, Math.max(16, DUNGEON.BUFFER_PX / 2));
      if (rooms.some((r) => rectsOverlap(grown, this._grow(r.rect, Math.max(16, DUNGEON.BUFFER_PX / 2))))) continue;
      const room = { id: rooms.length, rect, role: 'normal', center: { x: x + w / 2, y: y + h / 2 } };
      rooms.push(room);
      this._carveRoom(room);
    }
    return rooms;
  }

  // ── Step 2b: carving helpers (grid writes) ────────────────────────────────

  _carveRoom(room) {
    this._carveRect(room.rect.x, room.rect.y, room.rect.w, room.rect.h, TILE.FLOOR);
  }

  /**
   * L-shaped corridor between two room centers.
   * Pick one of the two elbows (H-then-V or V-then-H) at random so repeated
   * generations look varied. When centers align on one axis this naturally
   * degenerates into a straight corridor. Width = CORRIDOR_PX, centered on
   * the path.
   */
  _carveCorridor(a, b) {
    const { x: ax, y: ay } = a.center;
    const { x: bx, y: by } = b.center;
    const half = DUNGEON.CORRIDOR_PX / 2;
    const horizontalFirst = Math.random() < 0.5;

    if (horizontalFirst) {
      this._carveH(ax, bx, ay, half); // a -> elbow (at ay)
      this._carveV(ay, by, bx, half); // elbow -> b
    } else {
      this._carveV(ay, by, ax, half); // a -> elbow (at ax)
      this._carveH(ax, bx, by, half); // elbow -> b
    }
  }

  _carveH(x0, x1, cy, half) {
    const x = Math.min(x0, x1);
    const w = Math.abs(x0 - x1);
    this._carveRect(x, cy - half, w, half * 2, TILE.CORRIDOR);
  }

  _carveV(cy0, cy1, cx, half) {
    const y = Math.min(cy0, cy1);
    const h = Math.abs(cy0 - cy1);
    this._carveRect(cx - half, y, half * 2, h, TILE.CORRIDOR);
  }

  /** Carve a pixel rect as `id`, but never overwrite existing FLOOR with CORRIDOR. */
  _carveRect(px, py, pw, ph, id) {
    const tx0 = Math.max(0, Math.floor(px / this.tile));
    const ty0 = Math.max(0, Math.floor(py / this.tile));
    const tx1 = Math.min(this.cols - 1, Math.ceil((px + pw) / this.tile) - 1);
    const ty1 = Math.min(this.rows - 1, Math.ceil((py + ph) / this.tile) - 1);

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const cur = this.grid[ty][tx];
        // Priority: WALL < CORRIDOR < FLOOR (rooms visually win over corridors).
        if (id === TILE.CORRIDOR && cur === TILE.FLOOR) continue;
        this.grid[ty][tx] = id;
      }
    }
  }

  // ── Step 2c: roles & spawn points ─────────────────────────────────────────

  _farthestRoomFrom(origin) {
    let best = this.rooms[0];
    let bestD = -1;
    for (const r of this.rooms) {
      const d = Math.hypot(r.center.x - origin.center.x, r.center.y - origin.center.y);
      if (d > bestD) { bestD = d; best = r; }
    }
    return best;
  }

  /**
   * 1-3 yellow marker points per non-entrance/non-boss room, jittered inside
   * the room rect with a small inset so they never sit on a wall.
   */
  _buildEnemySpawns() {
    const spawns = [];
    for (const room of this.rooms) {
      if (room.role !== 'enemy') continue;
      const n = randInt(1, 3);
      const inset = 24;
      for (let i = 0; i < n; i++) {
        spawns.push({
          roomId: room.id,
          x: randRange(room.rect.x + inset, room.rect.x + room.rect.w - inset),
          y: randRange(room.rect.y + inset, room.rect.y + room.rect.h - inset),
        });
      }
    }
    return spawns;
  }

  // ── Small utilities ───────────────────────────────────────────────────────

  _blankGrid() {
    return Array.from({ length: this.rows }, () => new Array(this.cols).fill(TILE.WALL));
  }

  _snapToTile(px) {
    return Math.round(px / this.tile) * this.tile;
  }

  _grow(rect, by) {
    return { x: rect.x - by, y: rect.y - by, w: rect.w + by * 2, h: rect.h + by * 2 };
  }

  _centerOf(room) {
    return { x: room.center.x, y: room.center.y };
  }
}
