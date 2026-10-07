// src/scenes/DungeonScene.js
// STEP (Variant C): Procedural dungeon playground.
//
// Replaces the flat scaffold test world with a generated "Random Rooms +
// Corridors" dungeon rendered through Phaser's built-in tilemap system:
//
//   - 32x32 tiles, 63x63 grid (~2016px >= 2000x2000 world)
//   - one blank layer per tile type (WALL / FLOOR / CORRIDOR) so each can use
//     its own placeholder texture and collision setting
//   - arcade collision against the WALL layer only
//   - player spawns at the entrance room center (green marker), boss room is
//     red, future enemy spawn rooms are yellow
//   - [G] regenerates the layout and respawns the player at the new entrance
//   - 150x150 minimap (top-right): explored floor in light gray, unexplored in
//     black, player as a white dot; areas reveal as you walk near them
//
// Movement keeps using the Player entity (lerp model); TouchControls stays for
// mobile testing.

import { WORLD, TILE, DUNGEON_COLORS } from '../config/constants.js';
import DungeonGenerator from '../systems/DungeonGenerator.js';
import Player from '../entities/Player.js';
import TouchControls from '../input/TouchControls.js';

const TS = 32;                    // tile size px
const REVEAL_RADIUS_PX = 176;     // minimap exploration radius around the player
const MINIMAP_SIZE = 150;         // px (requirement)

export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('Dungeon');
  }

  create() {
    // ── Placeholder tile textures (procedural, no binary assets) ───────────
    this.buildTileTextures();

    // ── Generator + first layout ────────────────────────────────────────────
    this.generator = new DungeonGenerator();

    // ── Blank tilemap: one layer per tile id. Each layer gets its own tiny
    // 1-tile tileset so the three tile types can use different placeholder
    // textures and independent collision settings. gid = 1 => local tile index
    // 1 is what we stamp with putTileAt(1, ...).
    this.map = this.make.tilemap({
      tileWidth: TS,
      tileHeight: TS,
      width: this.generator.cols,
      height: this.generator.rows,
    });
    this.tsWall = this.map.addTilesetImage('dt-wall', 'dt_wall', TS, TS, 0, 0, 1);
    this.tsFloor = this.map.addTilesetImage('dt-floor', 'dt_floor', TS, TS, 0, 0, 1);
    this.tsCorr = this.map.addTilesetImage('dt-corridor', 'dt_corridor', TS, TS, 0, 0, 1);

    this.layerWall = this.map.createBlankLayer('walls', this.tsWall);
    this.layerFloor = this.map.createBlankLayer('floors', this.tsFloor);
    this.layerCorr = this.map.createBlankLayer('corridors', this.tsCorr);

    for (const l of [this.layerWall, this.layerFloor, this.layerCorr]) {
      l.setDepth(-10);
    }
    // Only WALL collides; floors/corridors stay non-colliding by default.
    this.layerWall.setCollision([1], true, true);

    // ── Marker layer (room role circles) ────────────────────────────────────
    this.markers = this.add.graphics().setDepth(1);

    // ── World + camera bounds match the 2000x2000 world ─────────────────────
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.setBackgroundColor('#0d0b12');

    // ── HUD (scrollFactor 0 => screen space) ────────────────────────────────
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

    // ── Minimap (screen-space container, top-right corner) ──────────────────
    this.minimapScale = MINIMAP_SIZE / WORLD.width; // world px -> minimap px
    this.explored = new Uint8Array(this.generator.cols * this.generator.rows);
    this.mmCanvas = this.add
      .canvas(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
      .setScrollFactor(0)
      .setDepth(999)
      .setOrigin(0, 0);
    this.mmCtx = this.mmCanvas.getContext();
    this.mmFrame = 0;
    this.layoutVersion = 0; // bumped on every regeneration -> forces a redraw
    this.positionMinimap();
    this.scale.on('resize', () => this.positionMinimap());

    // ── Input: WASD/arrows move, G regenerates, R restarts the scene ────────
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,G,UP,LEFT,DOWN,RIGHT');
    this.touch = new TouchControls(this);

    // One-time listener (created in create(), destroyed with the scene).
    this.input.keyboard.on('keydown-G', () => this.generateDungeon());

    this.generateDungeon(); // builds map tiles + spawns the player inside
  }

  /** Regenerate layout, rebuild tile layers, respawn player at the entrance. */
  generateDungeon(seed) {
    const desc = this.generator.generate(seed ?? Math.floor(Math.random() * 0xffffffff));

    // Wipe old tiles and stamp the new ones into the right layer per tile id.
    this.layerWall.removeAllTiles(0, 0, desc.cols, desc.rows);
    this.layerFloor.removeAllTiles(0, 0, desc.cols, desc.rows);
    this.layerCorr.removeAllTiles(0, 0, desc.cols, desc.rows);
    for (let ty = 0; ty < desc.rows; ty++) {
      for (let tx = 0; tx < desc.cols; tx++) {
        const t = desc.tiles[ty * desc.cols + tx];
        if (t === TILE.WALL) this.layerWall.putTileAt(1, tx, ty);
        else if (t === TILE.FLOOR) this.layerFloor.putTileAt(1, tx, ty);
        else this.layerCorr.putTileAt(1, tx, ty);
      }
    }

    this.drawMarkers(desc.rooms);

    // Fresh exploration state for the minimap.
    this.explored.fill(0);
    this.layoutVersion++;

    // (Re)spawn the player at the new entrance, then bind wall collision to it.
    this.spawnPlayerAtEntrance();
    if (this.wallCollider) this.wallCollider.destroy();
    this.wallCollider = this.physics.add.collider(this.player, this.layerWall);
  }

  /** Destroy + recreate the player at the entrance room center. */
  spawnPlayerAtEntrance() {
    const spawn = this.generator.getEntranceSpawn();
    if (this.player) this.player.destroy();
    this.player = new Player(this, spawn.x, spawn.y);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.centerOn(spawn.x, spawn.y);
  }

  /** Green entrance / red boss / yellow enemy-spawn circles at room centers. */
  drawMarkers(rooms) {
    const g = this.markers;
    g.clear();
    for (const r of rooms) {
      const hex =
        r.role === 'entrance'
          ? DUNGEON_COLORS.ENTRANCE
          : r.role === 'boss'
            ? DUNGEON_COLORS.BOSS
            : DUNGEON_COLORS.ENEMY_SPAWN;
      const color = Phaser.Display.Color.HexStringToColor(hex).color;
      g.fillStyle(color, 0.45).fillCircle(r.cx, r.cy, 26);
      g.lineStyle(4, color, 0.95).strokeCircle(r.cx, r.cy, 26);
    }
  }

  // ── Placeholder tile textures (drawn once, reused across regenerations) ───
  buildTileTextures() {
    if (this.textures.exists('dt_wall')) return;
    const g = new Phaser.GameObjects.Graphics(this);

    // FLOOR: #3a3a3a with a subtle grid pattern (lighter inner lines).
    const floor = Phaser.Display.Color.HexStringToColor(DUNGEON_COLORS.FLOOR).color;
    const floorGrid = Phaser.Display.Color.HexStringToColor(DUNGEON_COLORS.FLOOR_GRID).color;
    g.clear().fillStyle(floor, 1).fillRect(0, 0, TS, TS);
    g.lineStyle(1, floorGrid, 1).strokeRect(0.5, 0.5, TS - 1, TS - 1);
    g.lineStyle(1, floorGrid, 0.45);
    g.beginPath();
    g.moveTo(TS / 2, 1);
    g.lineTo(TS / 2, TS - 1);
    g.moveTo(1, TS / 2);
    g.lineTo(TS - 1, TS / 2);
    g.strokePath();
    g.generateTexture('dt_floor', TS, TS);

    // CORRIDOR: same family but slightly lighter (#4a4a4a).
    const corr = Phaser.Display.Color.HexStringToColor(DUNGEON_COLORS.CORRIDOR).color;
    g.clear().fillStyle(corr, 1).fillRect(0, 0, TS, TS);
    g.lineStyle(1, floorGrid, 1).strokeRect(0.5, 0.5, TS - 1, TS - 1);
    g.generateTexture('dt_corridor', TS, TS);

    // WALL: #2a2a2a fill with a darker border effect + bevel shading.
    const wall = Phaser.Display.Color.HexStringToColor(DUNGEON_COLORS.WALL).color;
    const border = Phaser.Display.Color.HexStringToColor(DUNGEON_COLORS.WALL_BORDER).color;
    g.clear().fillStyle(wall, 1).fillRect(0, 0, TS, TS);
    g.lineStyle(3, border, 1).strokeRect(1.5, 1.5, TS - 3, TS - 3);
    g.fillStyle(0xffffff, 0.05).fillRect(3, 3, TS - 6, 4); // faint top highlight
    g.generateTexture('dt_wall', TS, TS);

    g.destroy();
  }

  update(time, delta) {
    const k = this.keys;

    // ── Input: keyboard first, virtual joystick overrides when in use ───────
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
    this.player.update({ x: vx, y: vy }, delta);

    // Attack: touch button edge -> placeholder pulse (real combat targets enemies next).
    if (this.touch.attackJustPressed()) this.player.attack(this);

    // ── Dungeon regeneration: G key (listener added once in create) ─────────
    if (Phaser.Input.Keyboard.JustDown(k.R)) this.scene.restart();

    // ── Minimap: reveal around the player + throttled redraw ────────────────
    this.revealAround(this.player.x, this.player.y);
    if (++this.mmFrame % 6 === 0) this.drawMinimap();

    this.hud.setText(this.debugText());
    void time;
  }

  /** Mark tiles within REVEAL_RADIUS_PX of (x,y) as explored. */
  revealAround(x, y) {
    const cols = this.generator.cols;
    const rows = this.generator.rows;
    const cx = Math.floor(x / TS);
    const cy = Math.floor(y / TS);
    const rad = Math.ceil(REVEAL_RADIUS_PX / TS);
    for (let ty = Math.max(0, cy - rad); ty <= Math.min(rows - 1, cy + rad); ty++) {
      for (let tx = Math.max(0, cx - rad); tx <= Math.min(cols - 1, cx + rad); tx++) {
        const dx = tx - cx;
        const dy = ty - cy;
        if (dx * dx + dy * dy <= rad * rad) this.explored[ty * cols + tx] = 1;
      }
    }
  }

  positionMinimap() {
    const pad = 12;
    this.mmCanvas.setPosition(this.scale.width - MINIMAP_SIZE - pad, pad);
  }

  /** Explored floor/corridor = light gray, walls = mid gray, unexplored = black. */
  drawMinimap() {
    const ctx = this.mmCtx;
    const cols = this.generator.cols;
    const rows = this.generator.rows;
    const tiles = this.generator.tiles;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // One pixel per tile (63x63 fits comfortably in 150x150 with room to spare).
    const px = MINIMAP_SIZE / cols;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const i = ty * cols + tx;
        if (!this.explored[i]) continue;
        const t = tiles[i];
        ctx.fillStyle = t === TILE.WALL ? '#555555' : t === TILE.CORRIDOR ? '#cfcfcf' : '#a8a8a8';
        ctx.fillRect(tx * px, ty * px, Math.ceil(px), Math.ceil(px));
      }
    }

    // Room role markers (only once their room has been discovered a bit).
    for (const r of this.generator.rooms) {
      const ti = Math.floor(r.cy / TS) * cols + Math.floor(r.cx / TS);
      if (!this.explored[ti]) continue;
      ctx.fillStyle =
        r.role === 'entrance'
          ? DUNGEON_COLORS.ENTRANCE
          : r.role === 'boss'
            ? DUNGEON_COLORS.BOSS
            : DUNGEON_COLORS.ENEMY_SPAWN;
      ctx.beginPath();
      ctx.arc((r.cx / WORLD.width) * MINIMAP_SIZE, (r.cy / WORLD.height) * MINIMAP_SIZE, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player: white dot.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((this.player.x / WORLD.width) * MINIMAP_SIZE, (this.player.y / WORLD.height) * MINIMAP_SIZE, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, MINIMAP_SIZE - 2, MINIMAP_SIZE - 2);
  }

  debugText() {
    const d = this.generator.getDescription();
    const reached = this.generator.verifyConnectivity();
    return [
      'ASHENFALL - PROCEDURAL DUNGEON (VARIANT C)',
      `seed         ${d.seed}`,
      `rooms        ${d.rooms.length} (reachable: ${reached})`,
      `tiles        ${d.cols}x${d.rows} @ ${TS}px`,
      `player       ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
      `fps          ${Math.round(this.game.loop.actualFps)}`,
      '',
      'WASD/arrows move | G regenerate | R restart | left half: joystick',
    ].join('\n');
  }

  shutdown() {
    if (this.touch) this.touch.destroy();
    this.scale.off('resize', () => this.positionMinimap());
  }
}
