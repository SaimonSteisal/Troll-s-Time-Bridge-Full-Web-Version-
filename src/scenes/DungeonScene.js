// src/scenes/DungeonScene.js
// STEP 5: procedural dungeon rendering + collision.
//
// ─────────────────────────────────────────────────────────────────────────────
// BUGFIX — "Uncaught TypeError: this.add.canvas is not a function" (old line 89)
// ─────────────────────────────────────────────────────────────────────────────
// The previous implementation tried to build the tile visuals with
// `this.add.canvas(...)`. That factory method DOES NOT EXIST in Phaser 3
// (it is a Phaser 2 / CE idea, and even there it was `this.add.bitmapData`).
// Phaser 3's GameObjectFactory only exposes things like `image`, `sprite`,
// `rectangle`, `graphics`, `tilemapLayer` (via `make.tilemap`), etc.
//
// FIX (APPROACH A — rectangle sprites, per the task brief):
//   For every cell of the generated grid we create a static Phaser
//   `rectangle` GameObject sized to TILE (32px). WALL cells get a physics
//   STATIC body via `this.physics.add.staticGroup()`; FLOOR/CORRIDOR cells
//   are plain decorative rectangles kept in `this.floorGroup` so we can
//   destroy them cheaply on regeneration.
//
// BUGFIX #2 — "TypeError: body[key] is not a function" when adding rects with
// manually-created StaticBodies to a regular `physics.add.group()`: a normal
// Group's add() forcibly assigns a DYNAMIC Arcade Body to every child
// (PhysicsGroup.createEnabledBody / runChildUpdate), which conflicts with the
// StaticBody and crashes. The correct container for immovable walls is
// `this.physics.add.staticGroup()` — it creates StaticBodies itself and its
// `.add(go)` / `.create()` calls convert/attach static bodies properly.
//
//   Why rectangles instead of a real TilemapLayer?
//     - Zero binary assets required (the project generates all textures).
//     - Arcade-physics collision against a group of static bodies is trivial
//       (`this.physics.add.collider(player, wallGroup)`), whereas TilemapLayer
//       collision needs an index-based tileset first.
//     - Regenerating ("G" key) is just destroy + rebuild — no layer recycling.
//   If performance ever becomes an issue (~2000x2000 world => ~3900 rects),
//   swap to APPROACH B: `this.make.graphics()` -> `generateTexture()` for a
//   tileset image, then `this.make.tilemap({ data })` + `addTilesetImage()`.
//   The generator already outputs the numeric `grid` that API expects.
//
// All API calls used here are verified against Phaser 3.90.0:
//   this.add.rectangle(x, y, width, height, fillColor)        // GameObjectFactory
//   this.physics.add.staticGroup()                            // group factory
//   staticGroup.add(go) -> converts go to a StaticBody        // Arcade Physics
//   this.physics.add.collider(sprite, staticGroup)            // collision
//   Phaser.Input.Keyboard.JustDown(key)                       // edge detection
// ─────────────────────────────────────────────────────────────────────────────

import DungeonGenerator, { TILE } from '../systems/DungeonGenerator.js';
import { PLAYER } from '../config/constants.js';

// Tile colors (kept in sync with the palette hinted by DungeonGenerator).
const TILE_COLORS = Object.freeze({
  [TILE.WALL]: 0x2a2a2a,
  [TILE.FLOOR]: 0x3a3a3a,
  [TILE.CORRIDOR]: 0x4a4a4a,
});

export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('Dungeon');
  }

  create() {
    // Pure-logic generator; the scene only renders its plain-data output.
    this.generator = new DungeonGenerator();

    // ── Physics groups ───────────────────────────────────────────────────
    // wallGroup: STATIC group — `.add(rect)` converts each rectangle to a
    // StaticBody automatically. A regular physics.add.group() would force a
    // dynamic Body onto every child and crash (see header BUGFIX #2).
    // Top-down game => no gravity anywhere.
    this.wallGroup = this.physics.add.staticGroup();
    // floorGroup: purely decorative, no bodies — tracked so "G" can destroy them.
    this.floorGroup = this.add.group();

    // ── HUD (screen-fixed) ───────────────────────────────────────────────
    this.hud = this.add
      .text(16, 16, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#c9c4d8',
        backgroundColor: 'rgba(0,0,0,0.55)',
        padding: { x: 10, y: 8 },
      })
      .setScrollFactor(0)
      .setDepth(1000);

    // WASD/arrows for movement, G to regenerate the dungeon.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,UP,LEFT,DOWN,RIGHT,G');

    // First build. From here on, everything world-related funnels through
    // buildDungeon() so initial creation and regeneration share one code path.
    this.buildDungeon();
  }

  // ── Dungeon lifecycle ────────────────────────────────────────────────────

  /**
   * Full rebuild: clear old visuals/bodies, generate a fresh grid, render it,
   * (re)spawn the player inside the ENTRANCE room, wire collisions, and fit
   * the camera + physics world bounds to the ACTUAL world size returned by
   * the generator (never hardcoded).
   */
  buildDungeon() {
    this.clearDungeon();

    const dungeon = this.generator.generate();
    this.dungeon = dungeon;

    this.renderGrid(dungeon.grid, dungeon.tile);

    // ── Player spawn ─────────────────────────────────────────────────────
    // getSpawnPoint() returns the entrance-room center in WORLD PIXELS
    // already (rooms store pixel rects). We additionally snap the point to
    // the center of the nearest walkable tile as a belt-and-braces check so
    // the player can never materialise inside a wall rectangle.
    const spawnPx = this.safeSpawnPixel(dungeon);
    this.player = this.physics.add
      .sprite(spawnPx.x, spawnPx.y, 'ph-player')
      .setScale(0.5)
      .setDepth(10)
      .setCollideWorldBounds(true)
      .setDrag(1200);
    this.player.body.setCircle(44, 8, 8); // matches the 96px centered texture
    this.player.setVelocity(0, 0);

    // ── Collision: player vs walls ───────────────────────────────────────
    this.physics.add.collider(this.player, this.wallGroup);

    // ── Camera + physics bounds match the generated world exactly ────────
    this.physics.world.setBounds(0, 0, dungeon.worldWidth, dungeon.worldHeight);
    this.cameras.main.setBounds(0, 0, dungeon.worldWidth, dungeon.worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor('#0d0b12');

    this.depthOrder();
  }

  /** Destroy every visual + static body from the previous run. */
  clearDungeon() {
    if (this.floorGroup) this.floorGroup.clear(true, true); // children destroyed
    if (this.wallGroup) {
      // clear(dropIntoWater, destroyChild) also removes the arcade bodies
      // when the GameObjects are destroyed.
      this.wallGroup.clear(true, true);
    }
    if (this.player) {
      this.player.destroy(); // collider is removed automatically with the body
      this.player = null;
    }
  }

  /**
   * APPROACH A renderer: one rectangle per grid cell.
   * Rectangles are positioned at the CELL CENTER because Phaser's origin is
   * (0.5, 0.5) by default: px = tx * tile + tile / 2.
   */
  renderGrid(grid, tile) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const tileType = row[x];
        const rect = this.add
          .rectangle(
            x * tile + tile / 2, // center-x in pixels from tile coord
            y * tile + tile / 2, // center-y in pixels from tile coord
            tile,
            tile,
            TILE_COLORS[tileType] ?? 0x000000
          )
          .setDepth(tileType === TILE.WALL ? 1 : -10); // floors behind, walls above

        if (tileType === TILE.WALL) {
          // StaticGroup.add() creates/converts a StaticBody for the rectangle
          // automatically — no manual physics.add.existing() needed.
          this.wallGroup.add(rect);
        } else {
          this.floorGroup.add(rect);
        }
      }
    }
  }

  /**
   * Entrance-room center in pixels, nudged to the middle of the nearest
   * walkable tile if the raw center somehow isn't walkable.
   */
  safeSpawnPixel(dungeon) {
    const tile = dungeon.tile;
    const raw = this.generator.getSpawnPoint(); // {x, y} in world pixels
    let tx = Math.floor(raw.x / tile);
    let ty = Math.floor(raw.y / tile);

    if (!this.generator.isWalkableTile(tx, ty)) {
      // Spiral-search outward for the closest walkable tile (tiny radius).
      outer: for (let r = 1; r < 8; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (this.generator.isWalkableTile(tx + dx, ty + dy)) {
              tx += dx;
              ty += dy;
              break outer;
            }
          }
        }
      }
    }
    return { x: tx * tile + tile / 2, y: ty * tile + tile / 2 };
  }

  /** Keep the player above tiles but below the HUD after rebuilds. */
  depthOrder() {
    if (this.player) this.player.setDepth(10);
    if (this.hud) this.hud.setDepth(1000);
  }

  // ── Frame loop ───────────────────────────────────────────────────────────

  update(time, delta) {
    void time;
    void delta;

    // "G" regenerates the whole dungeon: clear rects/bodies -> new grid ->
    // new rects -> respawn player in the (new) entrance room.
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) {
      this.buildDungeon();
    }

    if (!this.player) return;

    const k = this.keys;
    let vx = 0;
    let vy = 0;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * PLAYER.SPEED, (vy / len) * PLAYER.SPEED);
    } else {
      this.player.setVelocity(0, 0);
    }

    this.updateHud();
  }

  updateHud() {
    const d = this.dungeon;
    if (!d) return;
    const rooms = d.rooms.length;
    this.hud.setText(
      [
        `Ashenfall — Procedural Dungeon (Phaser 3.90)`,
        `Tiles: ${d.cols}x${d.rows} @ ${d.tile}px  World: ${d.worldWidth}x${d.worldHeight}px`,
        `Rooms: ${rooms}  Walls: ${this.wallGroup.countActive(true)}  Spawn: entrance room center`,
        `WASD/Arrows move — G regenerate dungeon`,
      ].join('\n')
    );
  }
}
