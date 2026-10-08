// src/scenes/BootScene.js
// ENGINE FRAME — Boot is the STARTING scene. Responsibilities (and nothing else):
//   1. Generate all placeholder textures (unchanged from STEP 1 — GameScene and
//      TouchControls depend on them).
//   2. Seed game.registry with the single source of truth:
//        playerState / gameState / settings / input
//   3. Create the GLOBAL InputManager exactly ONCE and store it at
//        game.registry.set('input', manager)
//   4. Transition to MainMenuScene.
// No gameplay code lives here.

import { COLORS } from '../config/constants.js';
import InputManager from '../systems/InputManager.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.buildPlaceholderTextures();
    this.initRegistry();

    // Minimal boot flash so the handover reads as intentional; then straight
    // to the main menu (the first RENDERED gameplay-free screen is MainMenu).
    const label = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Ashenfall — booting...', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#8f8aa3',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: label, alpha: { from: 0, to: 1 }, duration: 200 });

    this.time.delayedCall(250, () => this.scene.start('MainMenuScene'));
  }

  /** Registry = single source of truth. Scenes read/write HERE, never globals. */
  initRegistry() {
    const reg = this.game.registry;

    reg.set('playerState', {
      hp: 100,
      maxHp: 100,
      gold: 0,
      pos: null, // {x, y} written by GameScene on shutdown / meaningful events
    });

    reg.set('gameState', {
      currentDungeonSeed: (Math.random() * 0xffffffff) >>> 0,
      currentRoom: 'entrance',
      dungeonCleared: false,
      deaths: 0,
    });

    reg.set('settings', {
      musicVolume: 0.7,
      sfxVolume: 0.8,
      invertY: false,
    });

    // Global InputManager — created ONCE, ever. All scenes read it via
    // game.registry.get('input'). Never instantiate it a second time.
    reg.set('input', new InputManager(this.game));

    // Loose-coupling event bus (Phaser.Events), e.g. bus.emit('player:died').
    reg.set('bus', new Phaser.Events.EventEmitter());
  }

  /** Coloured geometric placeholders. TODO: Replace with sprite sheets. */
  buildPlaceholderTextures() {
    const g = new Phaser.GameObjects.Graphics(this);

    // player body — bigger placeholder (96px) so it's clearly visible on phones.
    // NOTE: generateTexture() captures from (0,0), so shapes must be drawn in the
    // positive quadrant around the texture center (48, 48).
    g.clear().fillStyle(COLORS.PLAYER).fillCircle(48, 48, 44);
    g.lineStyle(4, 0xffffff, 0.85).strokeCircle(48, 48, 44);
    g.fillStyle(0xffffff, 1).fillCircle(48, 48, 10); // center dot marks the hitbox
    g.generateTexture('ph-player', 96, 96);

    // enemy body
    g.clear().fillStyle(COLORS.ENEMY).fillCircle(0, 0, 16);
    g.generateTexture('ph-enemy', 32, 32);

    // ── Virtual touch controls (drawn in the positive quadrant so
    //    generateTexture() captures them fully) ────────────────────────
    // joystick base: translucent ring, 256px reference size (scaled at runtime)
    g.clear();
    g.fillStyle(0xffffff, 0.1).fillCircle(128, 128, 120);
    g.lineStyle(6, COLORS.PLAYER, 0.85).strokeCircle(128, 128, 120);
    g.lineStyle(2, 0xffffff, 0.25).strokeCircle(128, 128, 70);
    g.generateTexture('ph-joy-base', 256, 256);

    // joystick thumb: solid knob, 128px reference size
    g.clear();
    g.fillStyle(COLORS.PLAYER, 0.95).fillCircle(64, 64, 48);
    g.lineStyle(5, 0xffffff, 0.9).strokeCircle(64, 64, 48);
    g.generateTexture('ph-joy-thumb', 128, 128);

    // attack button: big red/orange disc with a slash mark, 256px reference size
    g.clear();
    g.fillStyle(0x000000, 0.35).fillCircle(132, 136, 120); // drop shadow
    g.fillStyle(COLORS.ENEMY, 0.92).fillCircle(128, 128, 118);
    g.lineStyle(8, 0xffffff, 0.9).strokeCircle(128, 128, 118);
    g.lineStyle(16, 0xffffff, 0.95);
    g.beginPath();
    g.moveTo(80, 176);
    g.lineTo(176, 80);
    g.strokePath();
    g.generateTexture('ph-btn-attack', 256, 256);

    // loot gem
    g.clear().fillStyle(COLORS.LOOT).fillTriangle(-10, 8, 10, 8, 0, -12);
    g.generateTexture('ph-loot', 24, 24);

    // soft radial glow (used for lights / hit flashes) — centered in its 128px frame
    g.clear();
    for (let r = 64; r > 0; r -= 4) {
      g.fillStyle(0xffffff, 0.03).fillCircle(64, 64, r);
    }
    g.generateTexture('ph-glow', 128, 128);

    // 1px white -> tint/scale into health bars, hitboxes, particles
    g.clear().fillStyle(0xffffff, 1).fillRect(0, 0, 1, 1);
    g.generateTexture('ph-pixel', 1, 1);

    g.destroy();

    // Floor tile: seamless-ish dark stone block with a grid line.
    const size = 64;
    const fg = new Phaser.GameObjects.Graphics(this);
    fg.fillStyle(COLORS.FLOOR).fillRect(0, 0, size, size);
    fg.lineStyle(2, COLORS.FLOOR_GRID, 1).strokeRect(1, 1, size - 2, size - 2);
    fg.generateTexture('ph-tile-floor', size, size);
    fg.destroy();
  }
}
