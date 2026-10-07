// src/entities/Player.js
// The player body with SMOOTH lerp movement + animation feedback.
// Consumes ONLY abstract input vectors (joystick / keyboard resolved by the
// scene) - it never touches raw devices.
//
// Movement model:
//   target velocity = joystick vector (x,y in -1..1, snapped to 8 directions)
//                     * PLAYER.SPEED (px/s)
//   actual velocity = lerp(current, target, PLAYER.MOVE_LERP) every frame
// -> releasing the stick sets the target to (0,0), so the very same lerp gives a
//    smooth deceleration instead of a hard stop.

import { PLAYER, COMBAT, WORLD, ATTACK_FX, COLORS } from '../config/constants.js';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x world spawn X
   * @param {number} y world spawn Y
   */
  constructor(scene, x, y) {
    super(scene, x, y, 'ph-player');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // ── Body ───────────────────────────────────────────────────────────
    this.setScale(PLAYER.SCALE);
    this.setDepth(10);
    this.setCollideWorldBounds(true);
    this.setDrag(0); // deceleration comes from the lerp, not physics drag
    this.setMaxVelocity(PLAYER.SPEED * 1.5);
    // The 96px texture draws its circle centred at (48,48): offset the body by
    // (texture - 2*radius)/2 so the hitbox matches the art.
    const off = (PLAYER.TEXTURE - PLAYER.RADIUS * 2) / 2;
    this.body.setCircle(PLAYER.RADIUS, off, off);

    // ── Colour state (tints multiply the placeholder art) ──────────────
    this._idleRGB = Player.toRGB(PLAYER.IDLE_TINT);     // green while idle
    this._moveRGB = Player.toRGB(PLAYER.MOVING_TINT);   // brighter green while moving
    this._curRGB = { ...this._idleRGB };
    this.setTint(Player.fromRGB(this._curRGB));

    // ── Read-only state for the scene + debug overlay ──────────────────
    this.inputVec = new Phaser.Math.Vector2(0, 0); // last applied input (8-way, normalised)
    this.moveFactor = 0;                           // 0..1 current speed / SPEED
    this.moving = false;
    this.attackCooldownMs = 0;                     // ms left before the next swing
    this.lastAttackAtMs = -COMBAT.ATTACK_COOLDOWN_MS;

    // ── Attached visuals (world space, follow the player) ──────────────
    this.glow = scene.add.image(x, y, 'ph-glow').setDepth(9).setAlpha(0.35);
    this.dirDot = scene.add.circle(x, y, 7, 0xffffff, 0.9).setDepth(11);

    this._bobPhase = 0;
    this._squashUntil = 0; // while > now, the attack punch tween owns scaleX/Y

    this.on('destroy', () => {
      this.glow.destroy();
      this.dirDot.destroy();
    });
  }

  /** 0xRRGGBB -> {r,g,b} */
  static toRGB(hex) {
    return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
  }

  static fromRGB({ r, g, b }) {
    return (((Math.round(r) & 0xff) << 16) | ((Math.round(g) & 0xff) << 8) | (Math.round(b) & 0xff)) >>> 0;
  }

  /**
   * Snap an analogue vector to one of the 8 compass directions (up/down/left/
   * right + diagonals) while keeping its magnitude, so partial stick travel
   * still feels proportional.
   */
  static snapTo8(vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len < 1e-6) return { x: 0, y: 0, mag: 0 };
    const step = 45 * RAD;
    const angle = Math.round(Math.atan2(vy, vx) / step) * step;
    return { x: Math.cos(angle), y: Math.sin(angle), mag: Math.min(len, 1) };
  }

  /**
   * One frame of smoothed movement + feedback.
   * @param {{x:number,y:number}} vec normalised joystick/key vector (-1..1)
   * @param {number} deltaMs frame delta in milliseconds
   */
  update(vec, deltaMs) {
    const dt = Math.min(deltaMs || 16.67, 50) / 1000; // clamp long frames (tab switch)

    // 1) Direction: 8-way snap of the incoming analogue vector.
    const dir = Player.snapTo8(vec.x, vec.y);
    this.inputVec.set(dir.x, dir.y);

    // 2) Target velocity (px/s) + per-frame lerp -> smooth accel / decel.
    const tvx = dir.x * PLAYER.SPEED * dir.mag;
    const tvy = dir.y * PLAYER.SPEED * dir.mag;
    const v = this.body.velocity;
    v.x = Phaser.Math.Linear(v.x, tvx, PLAYER.MOVE_LERP);
    v.y = Phaser.Math.Linear(v.y, tvy, PLAYER.MOVE_LERP);

    // Kill micro-jitter once fully released so the idle state is crisp.
    if (dir.mag === 0 && v.lengthSq() < PLAYER.STOP_EPSILON * PLAYER.STOP_EPSILON) {
      v.set(0, 0);
    }

    // 3) Attack cooldown bookkeeping (time-based, frame-rate independent).
    if (this.attackCooldownMs > 0) {
      this.attackCooldownMs = Math.max(0, this.attackCooldownMs - deltaMs);
    }

    // 4) Animation feedback derived from the ACTUAL velocity (not the input),
    //    so tilt/bob/tint reflect what really happens on screen.
    const speed = v.length();
    this.moveFactor = Math.min(speed / PLAYER.SPEED, 1);
    this.moving = speed > PLAYER.STOP_EPSILON;
    this.animate(dt, this.scene.time.now);

    this.glow.setPosition(this.x, this.y);
  }

  animate(dt, sceneTimeMs) {
    const v = this.body.velocity;

    // ── Tilt toward the movement direction (smoothed, shortest arc) ────
    let targetRot = this._targetRot || 0;
    if (this.moving) {
      // atan2 gives the screen-space heading; sprite "forward" is up (-Y) so +90.
      let a = Math.atan2(v.y, v.x) * DEG + 90;
      a = Phaser.Math.Angle.WrapDegrees(a); // keep within +/-180
      targetRot = a;
      // If we wrapped through +/-180, shift the current angle by 360 so the
      // rotation eases along the short path instead of spinning around.
      if (Math.abs(targetRot - this.rotation) > 180) {
        this.rotation += targetRot > this.rotation ? 360 : -360;
      }
    } else {
      targetRot = 0; // stand straight again
      if (Math.abs(targetRot - this.rotation) > 180) this.rotation += 360;
    }
    this._targetRot = targetRot;
    this.rotation = Phaser.Math.Linear(this.rotation, targetRot, PLAYER.ATTACK_LERP);
    if (!this.moving && Math.abs(this.rotation) < 0.5) this.rotation = 0;

    // ── Bobbing: scale pulse whose rate scales with speed ──────────────
    // The attack "punch" tween temporarily owns scaleX/Y (_squashUntil), so we
    // skip our bob writes while it plays - two writers on one property fight.
    this._bobPhase += dt * PLAYER.BOB_SPEED * (0.4 + this.moveFactor);
    const bob = Math.sin(this._bobPhase * Math.PI * 2) * PLAYER.BOB_AMP_PX * this.moveFactor;
    const s = PLAYER.SCALE;
    if (sceneTimeMs >= this._squashUntil) {
      this.setScale(s, s + bob / 40);
    }

    // ── Tint: idle green <-> brighter green (lerped) ───────────────────
    const to = this.moving ? this._moveRGB : this._idleRGB;
    this._curRGB.r = Phaser.Math.Linear(this._curRGB.r, to.r, PLAYER.ATTACK_LERP);
    this._curRGB.g = Phaser.Math.Linear(this._curRGB.g, to.g, PLAYER.ATTACK_LERP);
    this._curRGB.b = Phaser.Math.Linear(this._curRGB.b, to.b, PLAYER.ATTACK_LERP);
    this.setTint(Player.fromRGB(this._curRGB));

    // ── Facing dot rides the tilt so direction reads even when idle ────
    const ang = (this.rotation - 90) * RAD;
    const d = PLAYER.RADIUS * s * 0.95;
    this.dirDot.setPosition(this.x + Math.cos(ang) * d, this.y + Math.sin(ang) * d);
  }

  /**
   * Attempt an attack. Returns true if the swing went through (cooldown free).
   * @param {Phaser.Scene} scene
   */
  attack(scene) {
    if (!this.canAttack()) return false;

    this.attackCooldownMs = COMBAT.ATTACK_COOLDOWN_MS;
    this.lastAttackAtMs = scene.time.now;

    this.spawnAttackFx(scene);
    return true;
  }

  canAttack() {
    return this.attackCooldownMs <= 0;
  }

  /** Cooldown progress: 0 = just swung, 1 = ready again. */
  cooldownProgress() {
    if (this.attackCooldownMs <= 0) return 1;
    return 1 - this.attackCooldownMs / COMBAT.ATTACK_COOLDOWN_MS;
  }

  /** Expanding ring + flash around the player (placeholder combat juice). */
  spawnAttackFx(scene) {
    const r = PLAYER.RADIUS * PLAYER.SCALE;
    const ring = scene.add
      .circle(this.x, this.y, r, 0x000000, 0)
      .setStrokeStyle(8, COLORS.ATTACK_FX, 0.95)
      .setDepth(12);
    const flash = scene.add
      .image(this.x, this.y, 'ph-glow')
      .setDepth(12)
      .setScale(2.2)
      .setTint(COLORS.ATTACK_FX)
      .setAlpha(0.85);

    scene.tweens.add({
      targets: ring,
      radius: r * ATTACK_FX.RADIUS_FACTOR,
      alpha: 0,
      duration: ATTACK_FX.DURATION_MS,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
    scene.tweens.add({
      targets: flash,
      scale: 3.4,
      alpha: 0,
      duration: ATTACK_FX.DURATION_MS,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy(),
    });

    // squash-and-stretch punch on the body itself. The tween owns scaleX/Y for
    // its lifetime; _squashUntil keeps the bob code from fighting it.
    this._squashUntil = scene.time.now + 150;
    scene.tweens.add({
      targets: this,
      scaleX: PLAYER.SCALE * 1.18,
      scaleY: PLAYER.SCALE * 0.82,
      duration: 70,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => this.setScale(PLAYER.SCALE, PLAYER.SCALE),
    });
  }

  /** Safety net: keep the player inside the world even if physics misses an edge. */
  clampToWorld() {
    const pad = PLAYER.RADIUS * PLAYER.SCALE;
    this.x = Phaser.Math.Clamp(this.x, pad, WORLD.width - pad);
    this.y = Phaser.Math.Clamp(this.y, pad, WORLD.height - pad);
  }
}
