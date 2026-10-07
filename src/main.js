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
import ScaffoldTestScene from './scenes/ScaffoldTestScene.js';
import DungeonScene from './scenes/DungeonScene.js';

const game = new Phaser.Game({
  ...GAME_CONFIG,
  scene: [BootScene, ScaffoldTestScene, DungeonScene],
});

// Handy for debugging in the console: window.ashenfall.scene.getScene('ScaffoldTest')
window.ashenfall = game;

export default game;
