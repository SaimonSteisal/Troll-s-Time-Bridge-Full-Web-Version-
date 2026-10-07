// src/scenes/DungeonScene.js
// STEP 5: main gameplay scene. WIRES DungeonGenerator into Phaser:
//   generation -> tileset textures -> tilemap layer -> collision -> spawn -> "G" regen
//
// Pipeline (each stage logs under the [Dungeon] tag while debugging):
//   1. DungeonGenerator.generate() returns { grid, cols, rows, tile, rooms, entrance, ... }
//   2. A dynamic tileset texture ('dungeon-tiles', 3 tiles of TILE px) is created with
//      Graphics.generateTexture BEFORE any tilemap exists.
//   3. The 2-D grid is flattened to the 1-D array NewRawLayerData expects and the
//      layer is created + rendered (this was the missing link before).
//   4. setCollisionBetween(WALL..) makes walls solid; physics.add.collider(player, layer).
//   5. Player spawns at the entrance room center: pixel = tile * TILE + TILE/2 semantics
//      (the generator works in world pixels already, so center px == spawn px).
//   6. "G" regenerates a brand-new layout and respawns the player in the new entrance.

import DungeonGenerator, { TILE as T, DUNGEON } from '../systems/DungeonGenerator.js';
import TouchControls from '../input/TouchControls.js';
import { PLAYER, COLORS } from '../config/constants.js';

const DEBUG = true; // temporary pipeline tracing - flip to false once verified
const log = (...a) => { if (DEBUG) console.log('[Dungeon]', ...a); };

export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('DungeonScene');
  }

  create() {
    const t = DUNGEON.TILE;

    // ── 0. Shared tileset texture (FLOOR / WALL / CORRIDOR), built BEFORE the map ──
    this.ensureTilesetTexture(t);

    // ── 1. Generate the dungeon ────────────────────────────────────────────────────
    this.generator = new DungeonGenerator();
    this.dungeon = this.generator.generate();

    const { grid, cols, rows, entrance } = this.dungeon;
    log('grid dims        ', `${cols} x ${rows} tiles (${cols * t}x${rows * t} px)`);
    log('rooms generated  ', this.dungeon.rooms.length,
        '| roles:', this.dungeon.rooms.map((r) => r.role).join(','));
    log('entrance rect(px)', `x=${entrance.rect.x} y=${entrance.rect.y} w=${entrance.rect.w} h=${entrance.rect.h}`,
        '| center=', entrance.center);

    // Sanity: count carved cells so we can tell generation from rendering failures.
    let floors = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x] !== T.WALL) floors++;
    log('carved tiles     ', floors, `(floor+corridor) of ${cols * rows}`);

    // ── 2. Build the tilemap + render the layer ────────────────────────────────────
    this.buildTilemap(grid, cols, rows, t);

    // ── 3. World bounds + camera ───────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, this.dungeon.worldWidth, this.dungeon.worldHeight);
    this.cameras.main.setBounds(0, 0, this.dungeon.worldWidth, this.dungeon.worldHeight);
    this.cameras.main.setBackgroundColor('#0d0b12');

    // ── 4. Player spawned at the ENTRANCE room center (pixel coords) ───────────────
    const spawnX = entrance.center.x; // px = tileX * TILE + TILE/2 equivalent
    const spawnY = entrance.center.y;
    log('spawn pixel      ', `${spawnX}, ${spawnY}`);
    this.spawnPlayer(spawnX, spawnY);

    // ── 5. Collision: WALL index 0 is solid, everything above is walkable ──────────
    this.groundLayer.setCollisionBetween(T.WALL, T.WALL, true, 'dungeon');
    this.physics.add.collider(this.player, this.groundLayer);
    log('collision        ', `layer "${this.groundLayer.name}" setCollisionBetween(${T.WALL},${T.WALL}) + collider OK`);

    // ── 6. Room markers (green entrance / red boss / yellow enemy spawns) ──────────
    this.markerLayer = this.add.layer().setDepth(5);
    this.drawMarkers();

    // ── 7. Input: WASD/arrows + "G" regenerate + touch controls ────────────────────
    this.keys = this.input.keyboard.addKeys('W,A,S,D,G,UP,LEFT,DOWN,RIGHT');
    this.touch = new TouchControls(this);

    // ── 8. HUD ─────────────────────────────────────────────────────────────────────
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

    log('scene ready      ', 'tilemap rendered, player spawned, colliders active. Press G to regenerate.');
  }

  /** Dynamic 3-tile tileset: [0]=WALL, [1]=FLOOR, [2]=CORRIDOR. Idempotent across restarts. */
  ensureTilesetTexture(tileSize) {
    if (this.textures.exists('dungeon-tiles')) return;
    const g = new Phaser.GameObjects.Graphics(this);

    // index 0: WALL - dark rock block with a lighter bevel border
    g.clear();
    g.fillStyle(0x2a2a2a, 1).fillRect(0, 0, tileSize, tileSize);
    g.lineStyle(2, 0x161616, 1).strokeRect(1, 1, tileSize - 2, tileSize - 2);
    g.lineStyle(1, 0x3f3f3f, 1).lineBetween(3, 3, tileSize - 4, 3);

    // index 1: FLOOR - room floor with subtle grid
    g.fillStyle(COLORS.FLOOR, 1).fillRect(tileSize, 0, tileSize, tileSize);
    g.lineStyle(1, COLORS.FLOOR_GRID, 1).strokeRect(tileSize + 1, 1, tileSize - 2, tileSize - 2);

    // index 2: CORRIDOR - slightly lighter floor
    g.fillStyle(0x4a4a4a, 1).fillRect(tileSize * 2, 0, tileSize, tileSize);
    g.lineStyle(1, 0x5a5a5a, 1).strokeRect(tileSize * 2 + 1, 1, tileSize - 2, tileSize - 2);

    g.generateTexture('dungeon-tiles', tileSize * 3, tileSize);
    g.destroy();
    log('tileset          ', "'dungeon-tiles' (3 x " + tileSize + 'px) created');
  }

  /** Convert the 2-D grid into a rendered Phaser tilemap layer. */
  buildTilemap(grid, cols, rows, tileSize) {
    // Flatten row-major: Phaser indexes data[y * width + x].
    const data = new Int32Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        data[y * cols + x] = grid[y][x]; // 0-based tile indices match TILE enum exactly
      }
    }

    this.map = this.make.tilemap({ data, tileWidth: tileSize, tileHeight: tileSize });
    // Tileset name must be unique per scene instance; NewRawLayerData rejects dupes on restart.
    const tilesetName = `dungeon-${Phaser.Utils.String.UUID().slice(0, 8)}`;
    this.tileset = this.map.addTilesetImage(tilesetName, 'dungeon-tiles', tileSize, tileSize, 0, 0);
    this.groundLayer = this.map.createLayer(tilesetName, this.tileset, 0, 0);
    this.groundLayer.name = 'dungeon';
    this.groundLayer.setDepth(-10);

    log('tilemap layer    ', `"${this.groundLayer.name}" created @ ${this.groundLayer.x},${this.groundLayer.y}`,
        `size ${this.map.widthInPixels}x${this.map.heightInPixels}px`);
  }

  /** Green entrance / red boss / yellow enemy-spawn markers over the map. */
  drawMarkers() {
    this.markerLayer.removeAll(true);
    const mk = (x, y, color, r = 10) =>
      this.add.image(x, y, 'ph-pixel').setTint(color).setScale(r * 2).setAlpha(0.85).into(this.markerLayer);

    for (const room of this.dungeon.rooms) {
      if (room.role === 'entrance') mk(room.center.x, room.center.y, 0x2ecc71, 14);
      else if (room.role === 'boss') mk(room.center.x, room.center.y, 0xe74c3c, 14);
    }
    for (const s of this.dungeon.enemySpawns) mk(s.x, s.y, COLORS.LOOT, 7);
  }

  /** Create (or recycle) the player body at pixel position (x, y). */
  spawnPlayer(x, y) {
    if (this.player) {
      if (this.playerCollider) this.physics.removeCollider(this.playerCollider, false);
      this.player.destroy();
    }
    this.player = this.physics.add
      .sprite(x, y, 'ph-player')
      .setScale(0.5) // 96px placeholder -> ~48px body, fits through 64px corridors
      .setDepth(10)
      .setCollideWorldBounds(true)
      .setDrag(1200);
    // Circle hitbox in SCALED (world) pixels: radius 24 ~= half of the 48px sprite.
    this.player.body.setCircle(24, 24, 24);
    this.playerCollider = this.physics.add.collider(this.player, this.groundLayer);
    log('player spawned   ', `at (${Math.round(this.player.x)}, ${Math.round(this.player.y)})`,
        '| entrance walkable:', this.generator.isWalkableWorld(x, y));
  }

  /** Full regeneration: new grid -> rebuild map/colliders -> respawn at new entrance. */
  regenerate() {
    log('REGENERATE       ', 'new layout requested (G)');
    this.dungeon = this.generator.generate();
    const { grid, cols, rows, entrance } = this.dungeon;

    let floors = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y][x] !== T.WALL) floors++;
    log('regen stats      ', `rooms=${this.dungeon.rooms.length} carved=${floors} entrance=(${entrance.center.x},${entrance.center.y})`);

    // Tear down old map + colliders, then rebuild.
    this.physics.removeAllColliders(this.groundLayer);
    this.map.destroyAllLayers();
    this.map.destroy();
    this.buildTilemap(grid, cols, rows, DUNGEON.TILE);
    this.groundLayer.setCollisionBetween(T.WALL, T.WALL, true, 'dungeon');
    this.physics.add.collider(this.player, this.groundLayer);

    this.drawMarkers();
    this.spawnPlayer(entrance.center.x, entrance.center.y);
  }

  update(time, delta) {
    const k = this.keys;
    let vx = 0;
    let vy = 0;

    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;

    this.touch.update();
    if (this.touch.joyPointerId !== null) {
      vx = this.touch.moveX;
      vy = this.touch.moveY;
    }

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * PLAYER.SPEED, (vy / len) * PLAYER.SPEED);
    }

    // "G" -> regenerate the dungeon and respawn in the new entrance room.
    if (Phaser.Input.Keyboard.JustDown(k.G)) this.regenerate();

    this.hud.setText([
      'ASHENFALL - DUNGEON (STEP 5)',
      `rooms        ${this.dungeon.rooms.length}`,
      `entrance px  ${Math.round(this.dungeon.entrance.center.x)}, ${Math.round(this.dungeon.entrance.center.y)}`,
      `pos          ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
      `fps          ${Math.round(this.game.loop.actualFps)}`,
      '',
      'WASD / arrows move | G regenerate | touch: joystick + attack',
    ].join('\n'));

    void time;
    void delta;
  }

  shutdown() {
    if (this.touch) this.touch.destroy();
  }
}
