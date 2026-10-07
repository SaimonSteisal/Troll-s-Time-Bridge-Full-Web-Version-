// src/scenes/BootScene.js
// STEP 1 placeholder: generates every texture we need procedurally so the scaffold
// runs with zero binary assets. STEP 3 replaces these with real AI-generated sprites.

import { COLORS, WORLD } from '../config/constants.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.buildPlaceholderTextures();

    const label = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, 'Ashenfall', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#e8e6f0',
      })
      .setOrigin(0.5);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, 'Scaffold OK - booting test scene...', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8f8aa3',
      })
      .setOrigin(0.5);

    // tiny fade-in so the handover to the next scene reads as intentional
    this.tweens.add({ targets: [label], alpha: { from: 0, to: 1 }, duration: 300 });

    this.time.delayedCall(600, () => this.scene.start('ScaffoldTest'));
  }

  /** Coloured geometric placeholders. TODO: Replace with sprite sheets. */
  buildPlaceholderTextures() {
    const g = new Phaser.GameObjects.Graphics(this);

    // player body
    g.clear().fillStyle(COLORS.PLAYER).fillCircle(0, 0, 16);
    g.generateTexture('ph-player', 32, 32);

    // enemy body
    g.clear().fillStyle(COLORS.ENEMY).fillCircle(0, 0, 16);
    g.generateTexture('ph-enemy', 32, 32);

    // loot gem
    g.clear().fillStyle(COLORS.LOOT).fillTriangle(-10, 8, 10, 8, 0, -12);
    g.generateTexture('ph-loot', 24, 24);

    // soft radial glow (used for lights / hit flashes)
    g.clear();
    for (let r = 64; r > 0; r -= 4) {
      g.fillStyle(0xffffff, 0.03).fillCircle(0, 0, r);
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

    // Pre-fill a static world so camera bounds have something to look at.
    void WORLD;
  }
}
