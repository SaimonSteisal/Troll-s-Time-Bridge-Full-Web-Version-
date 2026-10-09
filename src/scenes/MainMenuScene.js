// src/scenes/MainMenuScene.js
// ENGINE FRAME — entry point shown to the player (Boot -> MainMenu).
//
// Rules enforced here:
//   - NO imports of other scene classes. Transitions use scene NAMES only
//     (this.scene.start('GameScene')).
//   - State flows through game.registry ONLY (playerState / gameState / settings).
//   - Input comes from the GLOBAL InputManager at registry.get('input')
//     (gamepad A / Enter via justPressed('confirm')) PLUS Phaser's native
//     pointer input for mouse/touch on the buttons themselves. The touch
//     joystick layer is explicitly detached while the menu is up.
//
// Header line rendered below the title ("MENU v2 · ...") — if you can see it,
// this scene is live.

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create() {
    const reg = this.game.registry;
    const input = reg.get('input'); // global InputManager — created once in Boot

    // Keep the virtual joystick/attack overlay OFF on menus.
    if (input) input.attachTouch(null);

    const w = this.scale.width;
    const h = this.scale.height;

    this.add
      .text(w / 2, h * 0.3, 'ASHENFALL', {
        fontFamily: 'monospace',
        fontSize: '72px',
        color: '#e8e6f0',
        stroke: '#4fc3f7',
        strokeWidth: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);

    // ── CONFIRMABLE HEADER LINE — proof that MainMenuScene is live ─────
    this.add
      .text(w / 2, h * 0.3 + 56, 'MENU v2 · engine frame online', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8f8aa3',
      })
      .setOrigin(0.5)
      .setDepth(10);

    // ── Buttons (native Phaser pointer input: mouse + touch) ────────────
    this.playBtn = this.makeButton(w / 2, h * 0.55, 'PLAY', () => this.onPlay());
    this.settingsBtn = this.makeButton(w / 2, h * 0.55 + 70, 'SETTINGS', () => this.onSettings());
    this.quitBtn = this.makeButton(w / 2, h * 0.55 + 140, 'QUIT', () => this.onQuit());

    this.settingsText = this.add
      .text(w / 2, h * 0.55 + 200, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#c9c4d8',
        align: 'center',
      })
      .setOrigin(0.5);
    this.refreshSettingsLabel();

    this.add
      .text(w / 2, h * 0.92, 'PLAY: click / tap / ENTER / gamepad A', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#6b6678',
      })
      .setOrigin(0.5);

    // Keyboard/gamepad confirm handled through the global InputManager.
    this.input.manager = input;
  }

  /** Rectangle + label button using Phaser's native interactive input. */
  makeButton(x, y, label, onClick) {
    const btnW = 260;
    const btnH = 52;
    const bg = this.add
      .rectangle(x, y, btnW, btnH, 0x1b1826)
      .setStrokeStyle(2, 0x4fc3f7, 0.9)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(x, y, label, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e8e6f0',
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x2a2740));
    bg.on('pointerout', () => bg.setFillStyle(0x1b1826));
    // 'pointerdown' fires for mouse clicks AND touch taps alike.
    bg.on('pointerdown', () => onClick());

    return { bg, txt };
  }

  update() {
    // Global InputManager: Enter / Space / E / gamepad-A == confirm.
    const input = this.input.manager;
    if (input && input.justPressed('confirm')) this.onPlay();
  }

  onPlay() {
    if (this._leaving) return; // pointerdown + same-frame key edge guard
    this._leaving = true;
    // Fresh run: reset per-run state, keep settings. Registry survives the hop.
    const gs = this.game.registry.get('gameState');
    gs.currentDungeonSeed = (Math.random() * 0xffffffff) >>> 0;
    gs.currentRoom = 'entrance';
    gs.dungeonCleared = false;
    this.game.registry.set('playerState', {
      hp: 100,
      maxHp: 100,
      gold: 0,
      pos: null,
    });
    this.scene.start('GameScene');
  }

  onSettings() {
    // STUB: cycles a settings value straight through the registry.
    const s = this.game.registry.get('settings');
    s.musicVolume = +(s.musicVolume >= 1 ? 0 : s.musicVolume + 0.25).toFixed(2);
    this.game.registry.set('settings', s);
    this.refreshSettingsLabel();
  }

  refreshSettingsLabel() {
    const s = this.game.registry.get('settings');
    this.settingsText.setText(
      `music ${Math.round(s.musicVolume * 100)}%  ·  sfx ${Math.round(s.sfxVolume * 100)}%  ·  invertY ${s.invertY}`
    );
  }

  onQuit() {
    // Web pages cannot force-close their own tab; "QUIT" clears the run state
    // (registry) and shows a confirmation. Closing the tab ends the session.
    this.game.registry.set('playerState', {
      hp: 100,
      maxHp: 100,
      gold: 0,
      pos: null,
    });
    const gs = this.game.registry.get('gameState');
    gs.currentRoom = 'menu';
    if (!this.quitNote) {
      this.quitNote = this.add
        .text(this.scale.width / 2, this.scale.height * 0.85, 'quit: close the tab to end the session', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#6b6678',
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.tweens.add({ targets: this.quitNote, alpha: { from: 0, to: 1 }, duration: 200 });
    }
  }
}
