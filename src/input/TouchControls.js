// src/input/TouchControls.js
// Mobile virtual controls: a left-thumb joystick and a right-thumb attack button.
//
// Contract (STEP 4): scenes read `moveX/moveY` (normalised -1..1) and
// `attackJustPressed` from this class instead of binding pointers directly,
// so InputManager can absorb it later without touching gameplay code.
//
// The controls are anchored to the *screen* (scrollFactor 0) and reposition /
// rescale themselves whenever the game is resized or rotated, which keeps them
// thumb-sized in both portrait and landscape under Phaser.Scale.RESIZE.

import { TOUCH_CONTROLS, COLORS } from '../config/constants.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default class TouchControls {
  /**
   * @param {Phaser.Scene} scene
   * @param {(vec:{x:number,y:number}) => void} [onMove] optional analogue callback
   *        (fires when the vector changes; magnitude 0..1)
   */
  constructor(scene, onMove = null) {
    this.scene = scene;
    this.onMove = onMove;

    // ── State ─────────────────────────────────────────────────────────
    this.moveX = 0;
    this.moveY = 0;
    this.attackHeld = false;
    this._attackQueued = false;   // edge flag consumed by attackJustPressed()
    this.joyPointerId = null;
    this.attackPointerId = null;
    this.joyOrigin = new Phaser.Math.Vector2();
    this.radius = 80;             // computed in layout()

    // ── Graphics (depth 900: above world, below HUD text at 1000) ────
    const s = scene.scale;
    this.base = scene.add
      .image(0, 0, 'ph-joy-base')
      .setScrollFactor(0)
      .setDepth(900)
      .setAlpha(0.9);
    this.thumb = scene.add
      .image(0, 0, 'ph-joy-thumb')
      .setScrollFactor(0)
      .setDepth(901);
    this.attackBtn = scene.add
      .image(s.width, s.height, 'ph-btn-attack')
      .setScrollFactor(0)
      .setDepth(900);
    this.attackLabel = scene.add
      .text(0, 0, 'ATTACK', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(902);

    // ── Multi-touch zones ─────────────────────────────────────────────
    // Left half of the screen drives the joystick, right half the attack.
    // Two add.zone() hit areas would fight over shared pointers, so we route
    // raw pointer events by x-position + pointer id instead.
    this._down = (p) => this.onPointerDown(p);
    this._move = (p) => this.onPointerMove(p);
    this._up = (p) => this.onPointerUp(p);
    scene.input.on('pointerdown', this._down);
    scene.input.on('pointermove', this._move);
    scene.input.on('pointerup', this._up);
    scene.input.on('pointerupoutside', this._up);

    this._resize = () => this.layout();
    scene.scale.on('resize', this._resize);

    this.layout();
    this.refreshVisuals();
  }

  /** Is this a device we should show touch controls for? */
  static isTouchDevice(game) {
    const dev = game.device;
    const touch = dev.events ? dev.events.touch : (dev.input ? dev.input.touch : false);
    return !!(touch || dev.os.android || dev.os.iOS);
  }

  /** Re-anchor + rescale everything to the current game screen size. */
  layout() {
    const s = this.scene.scale;
    const w = s.width;
    const h = s.height;
    const minDim = Math.min(w, h);

    // Thumb-friendly radius: scales with the viewport but clamped to sane bounds.
    this.radius = clamp((TOUCH_CONTROLS.BASE_SIZE / 2) * (minDim / 720), TOUCH_CONTROLS.MIN_RADIUS, TOUCH_CONTROLS.MAX_RADIUS);
    const margin = clamp(minDim * TOUCH_CONTROLS.EDGE_MARGIN_FRACTION, 30, 120);

    // Park the joystick base at its home position (bottom-left).
    this.joyHome = new Phaser.Math.Vector2(margin + this.radius, h - margin - this.radius);
    this.baseRadiusPx = this.radius;
    this.base.setScale((this.radius * 2) / 256); // texture is 256px across
    this.thumb.setScale((this.radius * 0.55 * 2) / 128); // knob ≈ 55% of radius

    if (this.joyPointerId === null) {
      this.base.setPosition(this.joyHome.x, this.joyHome.y);
      this.thumb.setPosition(this.joyHome.x, this.joyHome.y);
    }

    // Attack button: bottom-right corner.
    const btnR = clamp(minDim * 0.11, 45, 85);
    this.btnRadiusPx = btnR;
    this.attackBtn.setPosition(w - margin - btnR, h - margin - btnR);
    this.attackBtn.setScale((btnR * 2) / 256);
    this.attackLabel
      .setPosition(this.attackBtn.x, this.attackBtn.y + btnR + 16)
      .setFontSize(clamp(minDim * 0.03, 12, 18));

    // Hit-test rectangles (screen space).
    this.joyZone = new Phaser.Geom.Rectangle(0, h * 0.35, w * 0.6, h * 0.65);
    this.attackZone = new Phaser.Geom.Rectangle(w * 0.5, h * 0.35, w * 0.5, h * 0.65);
  }

  onPointerDown(p) {
    if (p.wasTouch && this.attackZone.contains(p.x, p.y) && this.attackPointerId === null) {
      this.attackPointerId = p.id;
      this.attackHeld = true;
      this._attackQueued = true;
      this.scene.tweens.add({ targets: this.attackBtn, scale: this.attackBtn.scale * 0.9, duration: 60 });
      return;
    }
    if (this.joyPointerId === null && this.joyZone.contains(p.x, p.y)) {
      this.joyPointerId = p.id;
      // Floating origin: the stick appears under the thumb for comfortable reach.
      this.joyOrigin.set(p.x, p.y);
      this.base.setPosition(p.x, p.y);
      this.thumb.setPosition(p.x, p.y);
      this.updateVector(p.x, p.y);
    }
  }

  onPointerMove(p) {
    if (p.id === this.joyPointerId) this.updateVector(p.x, p.y);
  }

  onPointerUp(p) {
    if (p.id === this.joyPointerId) {
      this.joyPointerId = null;
      this.moveX = 0;
      this.moveY = 0;
      this.emitMove();
      this.returnJoyHome();
    }
    if (p.id === this.attackPointerId) {
      this.attackPointerId = null;
      this.attackHeld = false;
      this.scene.tweens.add({ targets: this.attackBtn, scale: this.btnRadiusPx * 2 / 256, duration: 90, ease: 'Back.Out' });
    }
  }

  updateVector(px, py) {
    let dx = px - this.joyOrigin.x;
    let dy = py - this.joyOrigin.y;
    const len = Math.hypot(dx, dy);
    const r = this.radius;
    if (len > r) {
      dx = (dx / len) * r;
      dy = (dy / len) * r;
    }
    this.thumb.setPosition(this.joyOrigin.x + dx, this.joyOrigin.y + dy);
    const mag = clamp(Math.hypot(dx, dy) / r, 0, 1);
    if (mag < 0.15) {
      this.moveX = 0;
      this.moveY = 0;
    } else {
      this.moveX = dx / r;
      this.moveY = dy / r;
    }
    this.emitMove();
  }

  emitMove() {
    if (this.onMove) this.onMove({ x: this.moveX, y: this.moveY });
  }

  returnJoyHome() {
    this.scene.tweens.add({
      targets: [this.base, this.thumb],
      x: this.joyHome.x,
      y: this.joyHome.y,
      duration: 120,
      ease: 'Quad.Out',
    });
  }

  /** Consume the ATTACK press edge (returns true once per press). */
  attackJustPressed() {
    const was = this._attackQueued;
    this._attackQueued = false;
    return was;
  }

  refreshVisuals() {
    this.base.setAlpha(this.joyPointerId === null ? 0.55 : 0.9);
    this.thumb.setTint(this.joyPointerId === null ? COLORS.PLAYER : 0xffffff);
  }

  update() {
    this.refreshVisuals();
  }

  destroy() {
    this.scene.input.off('pointerdown', this._down);
    this.scene.input.off('pointermove', this._move);
    this.scene.input.off('pointerup', this._up);
    this.scene.input.off('pointerupoutside', this._up);
    this.scene.scale.off('resize', this._resize);
    this.base.destroy();
    this.thumb.destroy();
    this.attackBtn.destroy();
    this.attackLabel.destroy();
  }
}
