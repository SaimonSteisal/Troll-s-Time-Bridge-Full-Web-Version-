// src/scenes/GameScene.js
// (moved from DungeonScene.js — the working gameplay scene: procedural dungeon
//  rendering + collision + WASD movement + camera follow. All of that logic is
//  UNCHANGED; only minimal engine-frame wiring was added: registry read/write,
//  global InputManager touch layer, ESC -> PauseScene.)
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

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    // ── ENGINE FRAME WIRING (read registry BEFORE create) ──────────────
    // Single source of truth — never globals, never other scene classes.
    const reg = this.game.registry;
    this.playerState = reg.get('playerState') || { hp: 100, maxHp: 100, gold: 0, pos: null };
    this.gameState = reg.get('gameState') || {};
    this.settings = reg.get('settings') || {};
    /** Global InputManager created ONCE in BootScene — read only, never re-made. */
    this.input.manager = reg.get('input');
    /** Optional spawn override from a future room/level system. */
    this.spawnOverride = data && data.spawn ? data.spawn : null;
  }

  create() {
    // Pure-logic generator; the scene only renders its plain-data output.
    this.generator = new DungeonGenerator();

    // ── ENGINE FRAME WIRING ────────────────────────────────────────────
    // Attach the virtual joystick + attack button through the GLOBAL
    // InputManager (which wraps the untouched TouchControls class).
    if (this.input.manager) this.input.manager.attachTouch(this);

    // ESC edge -> pause overlay (also handled via gamepad Start in update()).
    this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyEsc.on('down', () => this.togglePause());

    // On-screen pause button (mobile-friendly), bottom-centre, above touch layer.
    const pw = 120;
    const ph = 44;
    const pbx = this.scale.width / 2;
    const pby = this.scale.height - 60;
    this.pauseBtn = this.add
      .rectangle(pbx, pby, pw, ph, 0x1b1826, 0.8)
      .setStrokeStyle(2, 0x4fc3f7, 0.9)
      .setScrollFactor(0)
      .setDepth(950)
      .setInteractive();
    this.add
      .text(pbx, pby, 'PAUSE', { fontFamily: 'monospace', fontSize: '18px', color: '#e8e6f0' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(951);
    this.pauseBtn.on('pointerdown', () => this.togglePause());

    // PauseScene's "MAIN MENU" stops us directly: persist before shutdown.
    this.events.once('shutdown', () => this.persistPlayerState());

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

    // ── ENGINE FRAME WIRING: registry-driven spawn + HP ────────────────
    // A spawn override (e.g. from a future room-transition system) wins over
    // the entrance-room default; playerState.pos is applied only if it lands
    // on walkable ground of THIS dungeon (guards stale cross-run positions).
    if (this.spawnOverride) {
      this.player.setPosition(this.spawnOverride.x, this.spawnOverride.y);
    } else if (this.playerState && this.playerState.pos) {
      const p = this.playerState.pos;
      if (this.generator.isWalkableWorld(p.x, p.y)) this.player.setPosition(p.x, p.y);
    }
    if (this.playerState) {
      this.playerState.hp = this.playerState.hp ?? this.playerState.maxHp ?? 100;
      this.game.registry.set('playerState', this.playerState);
    }

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

    // ── ENGINE FRAME WIRING: pause gate + global-input edges ───────────
    const input = this.input.manager;
    if (input && input.justPressed('pause')) this.togglePause();
    if (this.gameState && this.gameState.paused) return;

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

    // Virtual joystick via the GLOBAL InputManager (wraps TouchControls).
    // Touch takes priority when a finger is on the stick — same behaviour as
    // the old scaffold scene, now routed through registry.get('input').
    if (input) {
      input.touch && input.touch.update();
      if (input.touch && input.touch.joyPointerId !== null) {
        vx = input.moveX;
        vy = input.moveY;
      }
    }

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * PLAYER.SPEED, (vy / len) * PLAYER.SPEED);
    } else {
      this.player.setVelocity(0, 0);
    }

    // Attack edge from the touch button (or keyboard E through 'confirm').
    if ((input && input.attackJustPressed()) || (input && input.justPressed('confirm'))) {
      this.onAttack();
    }

    // Persist live position to the registry every frame (cheap object reuse).
    if (this.playerState) {
      this.playerState.pos = { x: this.player.x, y: this.player.y };
    }

    this.updateHud();
  }

  // ── ENGINE FRAME API ─────────────────────────────────────────────────────

  /**
   * Launch the PauseScene overlay ON TOP of this scene (does not stop us).
   * GameScene's update() freezes via the registry `gameState.paused` flag;
   * PauseScene additionally calls scene.pause('GameScene') for a hard freeze.
   */
  pause() {
    if (this.scene.isActive('PauseScene')) return; // already paused
    const gs = this.game.registry.get('gameState');
    gs.paused = true;
    this.game.registry.set('gameState', gs);
    this.scene.launch('PauseScene');
  }

  /** Toggle the pause overlay (ESC / gamepad Start / on-screen button). */
  togglePause() {
    if (this.scene.isActive('PauseScene')) {
      // Let PauseScene own the resume path (it flips the registry flag and
      // resumes this scene) — never duplicate that logic here.
      const ps = this.scene.getScene('PauseScene');
      if (ps && typeof ps.resume === 'function') ps.resume();
    } else {
      this.pause();
    }
  }

  /** ATTACK feedback hook (pulse tween). Real combat arrives later (STEP 6). */
  onAttack() {
    if (!this.player) return;
    this.tweens.add({
      targets: this.player,
      scale: { from: 0.65, to: 0.5 },
      duration: 140,
      ease: 'Back.Out',
    });
  }

  /** Write meaningful gameplay state back to the registry (single source of truth). */
  persistPlayerState() {
    if (this.player && this.playerState) {
      this.playerState.pos = { x: this.player.x, y: this.player.y };
      this.game.registry.set('playerState', this.playerState);
    }
  }

  /** Called by future combat/room systems — death goes through the registry + bus. */
  notifyDeath() {
    const gs = this.game.registry.get('gameState');
    gs.deaths = (gs.deaths || 0) + 1;
    this.game.registry.set('gameState', gs);
    if (this.playerState) {
      this.playerState.hp = 0;
      this.persistPlayerState();
    }
    const bus = this.game.registry.get('bus');
    if (bus) bus.emit('player:died', this.playerState);
  }

  /** Called by future room-clear logic. */
  notifyDungeonCleared() {
    const gs = this.game.registry.get('gameState');
    gs.dungeonCleared = true;
    this.game.registry.set('gameState', gs);
    const bus = this.game.registry.get('bus');
    if (bus) bus.emit('dungeon:cleared', gs);
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
        `HP: ${this.playerState ? this.playerState.hp : '-'}  Seed: ${this.gameState ? this.gameState.currentDungeonSeed : '-'}`,
        `WASD/Arrows + joystick move — E/ATTACK pulse — G regenerate dungeon — ESC pause`,
      ].join('\n')
    );
  }

  shutdown() {
    // ENGINE FRAME: persist before teardown, and detach the global touch layer
    // so it never keeps dead GameObjects from a destroyed scene alive.
    this.persistPlayerState();
    const input = this.game.registry.get('input');
    if (input) input.attachTouch(null);
  }
}
