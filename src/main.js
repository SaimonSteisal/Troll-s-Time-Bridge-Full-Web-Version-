// src/main.js
// Entry point. Registers the global `Phaser` for the scene files (they use it directly)
// and boots the game with the shared config.

import Phaser from 'phaser';

// The scenes are written against the classic global `Phaser` namespace, which keeps
// them readable and matches every Phaser doc snippet you'll paste in later steps.
window.Phaser = Phaser;
globalThis.Phaser = Phaser;

import { GAME_CONFIG } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import GameScene from './scenes/GameScene.js';
import PauseScene from './scenes/PauseScene.js';

// ENGINE FRAME scene order (skeleton): Boot -> Menu -> Game, with Pause as a
// sleeping overlay launched on demand. The FIRST scene in the array is the
// starting scene Phaser boots into.
const game = new Phaser.Game({
  ...GAME_CONFIG,
  scene: [BootScene, MainMenuScene, GameScene, PauseScene],
});

// Handy for debugging in the console: window.ashenfall.scene.getScene('GameScene')
window.ashenfall = game;

export default game;
