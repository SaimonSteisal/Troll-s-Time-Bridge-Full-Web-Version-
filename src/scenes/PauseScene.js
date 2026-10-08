// src/scenes/PauseScene.js
// ENGINE FRAME — STUB overlay scene. Launched ON TOP of GameScene with
//   this.scene.launch('PauseScene') (see GameScene.pause()).
//
// Contract:
//   - Reads/writes ONLY game.registry (no imports of other scene classes).
//   - While it is active, GameScene sees registry.get('gameState').paused === true
//     and freezes its update loop.
//   - RESUME  -> stops self + resumes the scene underneath.
//   - MENU    -> stops self + jumps back to MainMenuScene (GameScene shuts down,
//                persisting playerState first).
//   - ESC / gamepad-Start (via the global InputManager) toggles resume/pause too.

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  init() {
    // Single source of truth: declare ourselves paused before any frame runs.
    const gs = this.game.registry.get('gameState');
    gs.paused = true;
    this.game.registry.set('gameState', gs);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Dim the gameplay scene underneath (native pipeline render target keeps
    // the frozen world visible behind the overlay).
    this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6).setInteractive();

    this.add
      .text(w / 2, h * 0.35, 'PAUSED', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#e8e6f0',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.makeButton(w / 2, h * 0.5, 'RESUME', () => this.resume());
    this.makeButton(w / 2, h * 0.5 + 70, 'MAIN MENU', () => this.toMenu());

    this.add
      .text(w / 2, h * 0.5 + 140, 'ESC / Start toggles pause', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8f8aa3',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // Global InputManager (created once in BootScene) — never a second copy.
    this.input.manager = this.game.registry.get('input');

    // Freeze the world underneath without pausing THIS scene's input.
    this.scene.pause('GameScene');
  }

  makeButton(x, y, label, onClick) {
    const bg = this.add
      .rectangle(x, y, 260, 52, 0x1b1826)
      .setStrokeStyle(2, 0x4fc3f7, 0.9)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '22px', color: '#e8e6f0' })
      .setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0x2a2740));
    bg.on('pointerout', () => bg.setFillStyle(0x1b1826));
    bg.on('pointerdown', () => onClick());
    return bg;
  }

  update() {
    const input = this.input.manager;
    if (input && input.justPressed('pause')) this.resume();
  }

  resume() {
    if (this._leaving) return;
    this._leaving = true;
    const gs = this.game.registry.get('gameState');
    gs.paused = false;
    this.game.registry.set('gameState', gs);
    // Un-freeze the gameplay scene FIRST, then remove the overlay. (Ordering
    // matters: stopping this scene runs shutdown(), which clears the paused
    // flag — GameScene must already be back in the active list by then.)
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  toMenu() {
    if (this._leaving) return;
    this._leaving = true;
    const gs = this.game.registry.get('gameState');
    gs.paused = false;
    this.game.registry.set('gameState', gs);
    this.scene.stop('PauseScene'); // stop overlay (runs shutdown() -> clears flag)
    this.scene.stop('GameScene'); // GameScene.shutdown persists playerState
    this.scene.start('MainMenuScene');
  }

  shutdown() {
    // Safety net: never leave the registry claiming we are paused. This runs
    // whether the overlay is stopped from RESUME, MAIN MENU, or any future
    // scene-start transition — a stale `paused: true` would freeze GameScene.
    const gs = this.game.registry.get('gameState');
    if (gs && gs.paused) {
      gs.paused = false;
      this.game.registry.set('gameState', gs);
    }
    // If GameScene is still around but hard-paused, bring it back.
    if (this.scene.isActive('GameScene') === false && this.scene.isPaused('GameScene')) {
      this.scene.resume('GameScene');
    }
  }
}
