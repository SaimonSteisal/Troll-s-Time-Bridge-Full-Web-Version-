// Headless smoke test for the STEP 5 dungeon pipeline (Boot -> DungeonScene).
// Runs the REAL dist bundle (built by Vite from src/) inside jsdom with a stubbed
// canvas, then asserts every stage: generation -> tilemap layer -> collision -> spawn -> regen.
import fs from 'fs';
import { createRequire } from 'module';
const OUT = '/tmp/dungeon-results.txt';
fs.writeFileSync(OUT, 'script start\n');
const say = (s) => fs.appendFileSync(OUT, s + '\n');
process.on('uncaughtException', e => say('UNCAUGHT: ' + (e.stack || e.message)));
process.on('unhandledRejection', e => say('REJECTION: ' + (e?.stack || String(e))));

const { JSDOM } = createRequire(import.meta.url)('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="game-root"></div></body></html>', {
  pretendToBeVisual: true, url: 'http://localhost/',
});
global.window = dom.window;
global.document = dom.window.document;
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (!(k in global)) { try { global[k] = dom.window[k]; } catch (e) {} }
}
global.self = dom.window;
global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = id => clearTimeout(id);
// Stub canvas contexts: Phaser only needs them not to throw in CANVAS mode headless.
const ctxStub = () => new Proxy({
  canvas: null,
  measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
  getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
}, { get(t, p) { if (p in t) return t[p]; return () => undefined; }, set() { return true; } });
global.HTMLCanvasElement.prototype.getContext = function () { const c = ctxStub(); c.canvas = this; return c; };

// The exact bundle the browser loads (dist is built from src/).
const PhaserMod = await import('./dist/assets/phaser-CaWnzXme.js');
const Phaser = PhaserMod.default ?? globalThis.Phaser;
if (!Phaser?.Scene) { say('FATAL: Phaser did not load'); process.exit(1); }
say('phaser loaded: ' + Phaser.VERSION);

const appMod = await import('./dist/assets/index-BcOmyNuh.js');
const game = appMod.default ?? window.ashenfall;
if (!game) { say('FATAL: game instance not exported'); process.exit(1); }

setTimeout(() => {
  const scene = game.scene.getScene('DungeonScene');
  say('--- assertions ---');
  say('scene exists: ' + !!scene);
  if (!scene) { say('STILL ACTIVE SCENES: ' + game.scene.getScenes(true).map(s => s.sys.settings.key).join(',')); process.exit(1); }

  const d = scene.dungeon;
  say('grid dims: ' + d.cols + 'x' + d.rows + ' | rooms: ' + d.rooms.length + ' | entrance center px: ' + JSON.stringify(d.entrance.center));

  // Tilemap rendering
  say('groundLayer exists: ' + !!scene.groundLayer + ' | rendered layer object: ' + !!scene.groundLayer.layer);
  say('map size px: ' + scene.map.widthInPixels + 'x' + scene.map.heightInPixels);
  const sampleIdx = [];
  for (let i = 0; i < 5; i++) sampleIdx.push(scene.groundLayer.layers[0].data[i]);
  say('first tile indices (row-major): ' + sampleIdx.join(',') + ' (expect 0=WALL shell)');
  let floorSeen = 0; for (const t of scene.groundLayer.tiles) if (t && t.index > 0) floorSeen++;
  say('tile objects with index>0 on layer: ' + floorSeen + ' (floors/corridors are being put into tiles)');

  // Collision
  const cw = scene.groundLayer.collision;
  say('collision WALL(0)=solid: ' + (cw?.[0]?.[0] === true) + ' | FLOOR(1) walkable: ' + (cw?.[0]?.[1] !== true) + ' | CORRIDOR(2) walkable: ' + (cw?.[0]?.[2] !== true));
  say('physics colliders active: ' + game.physics.world.colliders.list.filter(c => c.active).length);

  // Spawn
  say('player exists: ' + !!scene.player + ' | pos: ' + Math.round(scene.player.x) + ',' + Math.round(scene.player.y));
  const atEntrance = Math.abs(scene.player.x - d.entrance.center.x) < 1 && Math.abs(scene.player.y - d.entrance.center.y) < 1;
  say('player at entrance center: ' + atEntrance);
  say('spawn tile walkable: ' + scene.generator.isWalkableWorld(scene.player.x, scene.player.y));

  // Regeneration ("G" key handler calls regenerate())
  const before = JSON.stringify(d.grid);
  const oldLayer = scene.groundLayer;
  scene.regenerate();
  say('regenerate changed grid: ' + (JSON.stringify(scene.dungeon.grid) !== before));
  say('regenerate rebuilt layer: ' + (scene.groundLayer !== oldLayer) + ' | old layer destroyed: ' + !oldLayer.tileset);
  say('player respawned at new entrance: ' + (Math.abs(scene.player.x - scene.dungeon.entrance.center.x) < 1));
  say('collider re-added after regen: ' + (game.physics.world.colliders.list.filter(c => c.active).length >= 1));

  game.destroy(false);
  process.exit(0);
}, 4000);
