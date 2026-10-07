// src/systems/DungeonGenerator.js
// STEP (Variant C): Procedural dungeon generation — "Random Rooms + Corridors".
//
// ─────────────────────────────────────────────────────────────────────────────
// ALGORITHM OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
// 1. GRID SETUP
//    The world (2000x2000 px) is carved on a 32px tile grid (63x63 tiles,
//    63*32 = 2016 >= 2000). Every tile starts as WALL (id 0). We keep three
//    parallel grids:
//      - `tiles`   : final tile ids (WALL / FLOOR / CORRIDOR) -> tilemap data
//      - `carved`  : boolean "is this tile open (walkable)?"
//      - `roomAt`  : which room id owns each carved tile (-1 = none)
//
// 2. ROOM PLACEMENT (rejection sampling with a buffer, in PIXEL space)
//    We try to place 8..12 rooms. Each room gets a random size between
//    150x150 and 350x350 px (snapped to whole tiles => 156..352 px actual)
//    and a random pixel position. A candidate is REJECTED if it overlaps any
//    accepted room inflated by BUFFER_PX/2 on each side — i.e. two rooms must
//    have >= 50 px of solid rock between them. Placement works in pixels
//    rather than tiles because snapping first would round the 50px buffer up
//    to 64px and squeeze the minimum room size below spec.
//
// 3. CARVING + CORRIDORS
//    Room interiors are carved as FLOOR. Then each room i is connected to
//    room i+1 with an L-shaped corridor (horizontal leg first then vertical,
//    or the reverse — chosen at random; when centers share a row/column the
//    L degenerates into a straight run). Corridors are 64 px (2 tiles) wide.
//    Because the connections form a CHAIN (r0-r1-r2-...-rn), the graph is
//    connected BY CONSTRUCTION => every room is reachable, no isolated rooms.
//    Tiles carved by corridors are tagged CORRIDOR (lighter shade); tiles that
//    fall inside a room stay FLOOR.
//
// 4. ROLE ASSIGNMENT
//    - Room 0 = ENTRANCE (player spawn, green marker).
//    - The room whose CENTER is farthest from the entrance center (euclidean
//      pixel distance) = BOSS room (red marker).
//    - All other rooms get yellow markers = future enemy spawn points.
//
// 5. OUTPUT
//    `generate()` returns a plain-data description (tile grid + rooms + roles)
//    that the scene feeds into Phaser's built-in TilemapLayer system. The
//    generator has no Phaser dependencies, so it is trivially unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import { DUNGEON, TILE } from '../config/constants.js';

export default class DungeonGenerator {
  /**
   * @param {object} [opts] overrides for the DUNGEON constants (for testing/tuning)
   */
  constructor(opts = {}) {
    this.cfg = { ...DUNGEON, ...opts };
    this.rooms = [];        // [{x,y,w,h,id,role,cx,cy}, ...] in PIXELS
    this.tiles = null;      // Uint8Array(cols*rows) of TILE ids
    this.cols = this.cfg.COLS;
    this.rows = this.cfg.ROWS;
    this.seed = 0;
  }

  // ── Seeded RNG (mulberry32) ────────────────────────────────────────────────
  // Deterministic so a seed reproduces a layout (useful for debugging/testing).
  static makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Generate a fresh dungeon and return its description. */
  generate(seed = Date.now()) {
    this.seed = seed >>> 0;
    const rng = DungeonGenerator.makeRng(this.seed);

    // 1) Start with a solid block of wall everywhere.
    this.tiles = new Uint8Array(this.cols * this.rows).fill(TILE.WALL);
    this._carved = new Uint8Array(this.cols * this.rows); // 0/1 open flag
    this._roomAt = new Int16Array(this.cols * this.rows).fill(-1); // owner room id
    this.rooms = [];

    // 2) Place non-overlapping rooms (+50px buffer between them).
    const targetRooms =
      this.cfg.MIN_ROOMS + Math.floor(rng() * (this.cfg.MAX_ROOMS - this.cfg.MIN_ROOMS + 1));
    this._placeRooms(targetRooms, rng);

    // 3) Carve the room floors, then chain-corridors r0->r1->...->rN.
    for (const r of this.rooms) this._carveRoom(r);
    for (let i = 0; i < this.rooms.length - 1; i++) {
      this._carveCorridor(this.rooms[i], this.rooms[i + 1], rng);
    }

    // 4) Assign roles: entrance = first placed, boss = farthest center.
    this._assignRoles();

    return this.getDescription();
  }

  // ── Room placement ─────────────────────────────────────────────────────────
  /**
   * Rejection sampling on the TILE grid (rooms align to whole tiles so carving
   * is exact). The 50px buffer is enforced in PIXEL space: two rooms must have
   * >= 50 px of solid rock between them. Because room edges are multiples of
   * 32, a pixel gap can only be 0 or >= 32 — so the practical rule becomes
   * "separated rooms need >= 2 clear tiles (64px) between their rects".
   */
  _placeRooms(target, rng) {
    const T = this.cfg.TILE;
    const bufTiles = Math.ceil(this.cfg.ROOM_BUFFER_PX / T); // 50px -> 2 tiles
    const minTiles = Math.ceil(this.cfg.ROOM_MIN_PX / T);    // 150px -> 5 tiles
    const maxTiles = Math.floor(this.cfg.ROOM_MAX_PX / T);   // 350px -> 10 tiles

    // Tile-space AABB overlap test against every accepted room grown by hb
    // tiles on all sides (hb = bufTiles enforces the >=50px rock gap).
    const fits = (x, y, w, h, hb) => {
      for (const r of this.rooms) {
        if (
          x < r.tx + r.tw + hb &&
          x + w + hb > r.tx &&
          y < r.ty + r.th + hb &&
          y + h + hb > r.ty
        ) return false;
      }
      return true;
    };

    const pushRoom = (tx, ty, tw, th) => {
      this.rooms.push({
        id: this.rooms.length,
        tx, ty, tw, th,                          // tile rect
        x: tx * T, y: ty * T, w: tw * T, h: th * T, // pixel rect
        cx: (tx + tw / 2) * T, cy: (ty + th / 2) * T, // pixel center
        role: 'normal',
      });
    };

    // Rooms keep a 1-tile wall border from the map edge.
    const maxX = this.cols - 1;
    const maxY = this.rows - 1;

    for (let n = 0; n < target; n++) {
      let placed = false;
      for (let attempt = 0; attempt < this.cfg.MAX_PLACEMENT_ATTEMPTS && !placed; attempt++) {
        const w = minTiles + Math.floor(rng() * (maxTiles - minTiles + 1));
        const h = minTiles + Math.floor(rng() * (maxTiles - minTiles + 1));
        const x = 1 + Math.floor(rng() * (maxX - w - 1));
        const y = 1 + Math.floor(rng() * (maxY - h - 1));
        if (!fits(x, y, w, h, bufTiles)) continue;
        pushRoom(x, y, w, h);
        placed = true;
      }
    }

    // Safety net: guarantee at least MIN_ROOMS by retrying with progressively
    // relaxed buffers (the 2000x2000 grid normally fits 8+ rooms at 50px).
    let guard = 0;
    while (this.rooms.length < this.cfg.MIN_ROOMS && guard++ < 60) {
      for (const hb of [bufTiles, 1]) {
        let placed = false;
        for (let attempt = 0; attempt < 200 && !placed; attempt++) {
          const w = minTiles + Math.floor(rng() * (maxTiles - minTiles + 1));
          const h = minTiles + Math.floor(rng() * (maxTiles - minTiles + 1));
          const x = 1 + Math.floor(rng() * (maxX - w - 1));
          const y = 1 + Math.floor(rng() * (maxY - h - 1));
          if (!fits(x, y, w, h, hb)) continue;
          pushRoom(x, y, w, h);
          placed = true;
        }
        if (placed) break;
      }
    }
  }

  // ── Carving helpers ────────────────────────────────────────────────────────
  _setTile(tx, ty, id, roomId) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    const i = ty * this.cols + tx;
    this._carved[i] = 1;
    this.tiles[i] = id;
    if (roomId !== undefined && roomId >= 0) this._roomAt[i] = roomId;
  }

  _carveRoom(room) {
    for (let y = room.ty; y < room.ty + room.th; y++) {
      for (let x = room.tx; x < room.tx + room.tw; x++) {
        this._setTile(x, y, TILE.FLOOR, room.id);
      }
    }
  }

  /**
   * Carve a 2-tile-wide (64px) L-corridor between two rooms. Randomly picks
   * H-then-V or V-then-H routing; equal rows/columns collapse to straight.
   */
  _carveCorridor(a, b, rng) {
    const T = this.cfg.TILE;
    const half = Math.max(1, Math.round(this.cfg.CORRIDOR_WIDTH_PX / T / 2)); // 1 tile each side of centerline
    const ax = Math.floor(a.cx / T);
    const ay = Math.floor(a.cy / T);
    const bx = Math.floor(b.cx / T);
    const by = Math.floor(b.cy / T);

    const carveH = (x0, x1, yc) => {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let d = -(half - 1); d < half; d++) this._carveOpen(x, yc + d);
      }
    };
    const carveV = (y0, y1, xc) => {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let d = -(half - 1); d < half; d++) this._carveOpen(xc + d, y);
      }
    };

    if (rng() < 0.5) {
      carveH(ax, bx, ay); // horizontal leg from A's center row...
      carveV(ay, by, bx); // ...then vertical leg to B's center column
    } else {
      carveV(ay, by, ax);
      carveH(ax, bx, by);
    }
  }

  /** Mark a tile open, keeping FLOOR ownership if it lies inside a room. */
  _carveOpen(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    const i = ty * this.cols + tx;
    const owner = this._roomAt[i];
    if (owner >= 0) {
      this.tiles[i] = TILE.FLOOR; // inside a room -> stays plain floor
    } else {
      this.tiles[i] = TILE.CORRIDOR;
      this._roomAt[i] = -1;
    }
    this._carved[i] = 1;
  }

  // ── Roles ──────────────────────────────────────────────────────────────────
  _assignRoles() {
    if (this.rooms.length === 0) return;
    const entrance = this.rooms[0];
    entrance.role = 'entrance';

    // Boss = room whose center is farthest (euclidean, px) from the entrance.
    let boss = entrance;
    let best = -1;
    for (const r of this.rooms) {
      if (r === entrance) continue;
      const d = Math.hypot(r.cx - entrance.cx, r.cy - entrance.cy);
      if (d > best) {
        best = d;
        boss = r;
      }
    }
    boss.role = 'boss';

    for (const r of this.rooms) {
      if (r !== entrance && r !== boss) r.role = 'enemy';
    }
  }

  // ── Output ─────────────────────────────────────────────────────────────────
  getDescription() {
    return {
      seed: this.seed,
      cols: this.cols,
      rows: this.rows,
      tileSize: this.cfg.TILE,
      widthPx: this.cols * this.cfg.TILE,
      heightPx: this.rows * this.cfg.TILE,
      tiles: this.tiles, // Uint8Array, row-major, values in TILE
      rooms: this.rooms, // pixel + tile coords, role: entrance|boss|enemy
    };
  }

  /** Player spawn point (center of the entrance room), in pixels. */
  getEntranceSpawn() {
    const e = this.rooms.find((r) => r.role === 'entrance') || this.rooms[0];
    return e ? { x: e.cx, y: e.cy } : { x: 1000, y: 1000 };
  }

  /**
   * Connectivity proof (shown in the HUD): flood-fill from the entrance over
   * all carved tiles and count how many rooms contain a reached tile.
   * Must equal rooms.length or the generator has a bug.
   */
  verifyConnectivity() {
    if (!this._carved || this.rooms.length === 0) return 0;
    const start = this.rooms.find((r) => r.role === 'entrance') || this.rooms[0];
    const si = Math.floor(start.cy / this.cfg.TILE) * this.cols + Math.floor(start.cx / this.cfg.TILE);
    const queue = [si];
    const seen = new Uint8Array(this.cols * this.rows);
    seen[si] = 1;
    const reached = new Set([start.id]);

    while (queue.length) {
      const i = queue.pop();
      const x = i % this.cols;
      if (this._roomAt[i] >= 0) reached.add(this._roomAt[i]);
      const nb = [i - 1, i + 1, i - this.cols, i + this.cols];
      for (const j of nb) {
        if (j < 0 || j >= seen.length || seen[j]) continue;
        // guard horizontal wrap-around between rows
        if (Math.abs((j % this.cols) - x) > 1) continue;
        if (this._carved[j]) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    return reached.size;
  }
}
