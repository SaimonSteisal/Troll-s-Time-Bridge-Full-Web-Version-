// src/systems/InputManager.js
// Global input manager — created ONCE in BootScene, stored at
//   game.registry.get('input')
// Every scene READS it (never instantiates a second copy):
//   - GameScene: joystick / attack via the TouchControls layer + ESC edge
//   - MainMenuScene: gamepad-A + Enter as PLAY via justPressed('confirm')
//
// It wraps the EXISTING, WORKING TouchControls class (src/input/TouchControls.js)
// so no touch/joystick code is rewritten. On scenes where touch UI makes no
// sense (e.g. the menu) call `attachTouch(null)` to detach the overlay.

import TouchControls from '../input/TouchControls.js';

// NOTE: Phaser key names are NOT prefixed with "KEY_" (that is the DOM
// KeyboardEvent.code style). KeyCodes uses 'ENTER', 'SPACE', 'ESC', 'E'...
const KEY_ALIASES = {
  confirm: ['ENTER', 'SPACE', 'E'], // E doubles as ATTACK on keyboard
  pause: ['ESC'],
};

export default class InputManager {
  /** @param {Phaser.Game} game */
  constructor(game) {
    this.game = game;
    /** @type {TouchControls|null} touch overlay bound to the currently attached scene */
    this.touch = null;
    this._attachedScene = null;
    this._prev = {}; // previous-frame digital button states, keyed by action
    this._justDown = {}; // current-frame rising edges

    // Wake the browser Gamepad API up on first real gamepad event and keep a
    // reference to the most recently active pad (raw polling below).
    if (game.input && game.input.gamepad) {
      game.input.gamepad.on('down', (_pad, _index, event) => {
        const id = event && event.pad ? event.pad.id : null;
        if (id != null) this._lastPadId = id;
      });
    }

    // Sample once per frame (rising-edge detection for keyboard + gamepad).
    this._sampleBound = () => this._sample();
    game.events.on('preupdate', this._sampleBound);
  }

  // ── Touch layer management ────────────────────────────────────────────────

  /**
   * Attach the virtual joystick + attack button to `scene` (pass null to
   * detach, e.g. while the main menu is showing). Idempotent: re-attaching to
   * the same scene does nothing.
   */
  attachTouch(scene) {
    if (this._attachedScene === scene) return;
    if (this.touch) {
      this.touch.destroy();
      this.touch = null;
    }
    this._attachedScene = scene;
    if (scene) this.touch = new TouchControls(scene);
  }

  /** Analogue move vector from the virtual stick: {x, y}, magnitude 0..1. */
  get moveX() {
    return this.touch ? this.touch.moveX : 0;
  }

  get moveY() {
    return this.touch ? this.touch.moveY : 0;
  }

  /** True once per press of the virtual ATTACK button (edge, consumed). */
  attackJustPressed() {
    return this.touch ? this.touch.attackJustPressed() : false;
  }

  // ── Unified digital actions (keyboard + gamepad) ─────────────────────────

  _activePad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    let chosen = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      // Prefer the pad that last fired a Phaser gamepad event.
      if (this._lastPadId && p.id === this._lastPadId) return p;
      if (!chosen) chosen = p;
    }
    return chosen;
  }

  _sample() {
    const kb = this.game.input.keyboard;

    // --- gather raw digital state per action -------------------------------
    const down = {};
    for (const action of Object.keys(KEY_ALIASES)) down[action] = false;

    if (kb) {
      // Cache one Phaser key object per code — addKey() must NOT be called
      // every frame (it would allocate listeners endlessly).
      if (!this._keys) {
        this._keys = {};
        for (const codes of Object.values(KEY_ALIASES)) {
          for (const code of codes) {
            const kc = Phaser.Input.Keyboard.KeyCodes[code];
            if (kc !== undefined) this._keys[code] = kb.addKey(kc);
          }
        }
      }
      for (const [action, codes] of Object.entries(KEY_ALIASES)) {
        for (const code of codes) {
          const key = this._keys[code];
          if (key && key.isDown) down[action] = true;
        }
      }
    }

    const pad = this._activePad();
    if (pad) {
      // Standard mapping: 0 = A / cross = confirm, 9 = Start / options = pause.
      if (pad.buttons[0] && pad.buttons[0].pressed) down.confirm = true;
      if (pad.buttons[9] && pad.buttons[9].pressed) down.pause = true;
    }

    // --- rising edges -------------------------------------------------------
    for (const action of Object.keys(down)) {
      this._justDown[action] = down[action] && !this._prev[action];
      this._prev[action] = down[action];
    }
    this.padConnected = !!pad;
  }

  /** Rising-edge test for an abstract action ('confirm' | 'pause'). */
  justPressed(action) {
    return !!this._justDown[action];
  }

  /** Held-state test for an abstract action. */
  isDown(action) {
    return !!this._prev[action];
  }

  destroy() {
    this.attachTouch(null);
  }
}
