// src/scenes/ScaffoldTestScene.js
// STEP 1 verification scene. Proves: Vite dev server, Phaser WebGL boot, FIT scaling,
// world bounds + camera follow, and that all four input devices are detected.
// Real movement/combat arrives in STEP 4/5 via the InputManager abstraction.

import { WORLD, COLORS } from '../config/constants.js';

export default class ScaffoldTestScene extends Phaser.Scene {
  constructor() {
    super('ScaffoldTest');
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height);

    // ── Tiled placeholder floor (no binary assets needed) ──────────────
    const group = this.add.group();
    for (let y = 0; y < WORLD.height; y += 64) {
      for (let x = 0; x < WORLD.width; x += 64) {
        group.add(this.add.image(x + 32, y + 32, 'ph-tile-floor').setDepth(-10));
      }
    }

    // ── Placeholder player body ───────────────────────────────────────
    this.player = this.physics.add
      .sprite(WORLD.width / 2, WORLD.height / 2, 'ph-player')
      .setDepth(10)
      .setCollideWorldBounds(true)
      .setDrag(1200);
    this.player.body.setCircle(16);
    this.add.image(this.player.x, this.player.y, 'ph-glow').setDepth(9).setAlpha(0.35);

    // ── Camera follows the body, letterboxed to the world ─────────────
    this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor('#0d0b12');

    // ── HUD (debug readout of device detection) ───────────────────────
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

    // Raw key bindings live HERE only, as a scaffold smoke test.
    // STEP 4 moves all of this behind InputManager -> abstract ACTIONS.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,UP,LEFT,DOWN,RIGHT');
    this.input.on('pointerdown', () => this.pingInput());

    this.gamepadLabel = 'none';
    this.pingInput();
  }

  pingInput() {
    // Nudge the placeholder so you can SEE that the canvas has focus.
    this.tweens.add({
      targets: this.player,
      scale: { from: 1.25, to: 1 },
      duration: 140,
      ease: 'Back.Out',
    });
  }

  update(time, delta) {
    const k = this.keys;
    let vx = 0;
    let vy = 0;

    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;

    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * 260, (vy / len) * 260);
    } else if (this.player.body.velocity.lengthSq() > 0) {
      // Scaffold only: STEP 5 replaces this with exponential-approach interpolation.
      this.player.setVelocity(0, 0);
    }
    void time;
    void delta;

    if (Phaser.Input.Keyboard.JustDown(k.R)) this.scene.restart();

    this.refreshGamepadLabel();
    this.hud.setText(this.debugText());
  }

  refreshGamepadLabel() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const active = Array.from(pads || []).find((p) => p && p.connected);
    this.gamepadLabel = active ? active.id.slice(0, 28) : 'none';
  }

  debugText() {
    const s = this.scale;
    // DeviceInfo feature flags are nested differently across Phaser builds, so read
    // them defensively - a missing key must never crash the HUD.
    const dev = this.sys.game.device;
    const touch = dev.events ? dev.events.touch : (dev.input ? dev.input.touch : false);
    const mobile = !!(dev.os.android || dev.os.iOS || dev.os.cocoonJS);

    return [
      'ASHENFALL - STEP 1 SCAFFOLD',
      `renderer     ${this.game.renderer.type === Phaser.WEBGL ? 'WEBGL' : 'CANVAS'} (${this.game.renderer.type})`,
      `design       ${s.width} x ${s.height}   window ${window.innerWidth} x ${window.innerHeight}`,
      `scale mode   FIT + CENTER_BOTH`,
      `fps          ${Math.round(this.game.loop.actualFps)}`,
      `touch        ${touch ? 'yes' : 'no'}   mobile ${mobile ? 'yes' : 'no'}`,
      `gamepad      ${this.gamepadLabel}`,
      `pos          ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
      '',
      'WASD / arrows move | R restart | click to pulse',
    ].join('\n');
  }
}

void COLORS;
