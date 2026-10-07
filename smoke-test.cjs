// Headless smoke test for DungeonScene using the prebuilt Phaser UMD bundle.
// Node 20 has a built-in navigator; override before Phaser loads.
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0, language: 'en', platform: 'linux', vendor: '' }, configurable: true, writable: true });
const self = globalThis;
const Phaser = require('./node_modules/phaser/dist/phaser.js');

// --- minimal DOM so headless boot works ---
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), nodeType: 1, style: {}, children: [],
    clientWidth: 800, clientHeight: 600, parentElement: null, dataset: {},
    classList: { add(){}, remove(){}, contains(){return false;} },
    appendChild(c){ this.children.push(c); c.parentElement = this; return c; },
    removeChild(c){ this.children = this.children.filter(x=>x!==c); return c; },
    setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    getContext(){ return null; }, focus(){}, getBoundingClientRect(){ return {left:0,top:0,width:800,height:600}; },
  };
  return el;
}
const body = makeEl('body');
global.document = {
  body, documentElement: makeEl('html'), createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t), getElementById: () => null,
  addEventListener(){}, removeEventListener(){}, hidden: false, readyState: 'complete',
};
global.window = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  addEventListener(){}, removeEventListener(){}, navigator: global.navigator, location: { href: '' } };
global.navigator = global.navigator || { userAgent: 'node', maxTouchPoints: 0, language: 'en' };
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 5);
global.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = global.requestAnimationFrame;
window.cancelAnimationFrame = global.cancelAnimationFrame;

(async () => {
  // transpile scene + deps to CJS on the fly with esbuild
  const esbuild = require('esbuild');
  const fs = require('fs');
  const result = await esbuild.build({
    entryPoints: ['src/scenes/DungeonScene.js'],
    bundle: true, format: 'cjs', write: false, platform: 'neutral',
    define: { 'window': 'globalThis.__win__' },
    external: [],
  });
  globalThis.__win__ = window;
  const code = result.outputFiles[0].text;
  const moduleShim = { exports: {} };
  const fn = new Function('module', 'exports', 'require', 'Phaser', 'window', 'document', 'navigator', code);
  fn(moduleShim, moduleShim.exports, require, Phaser, window, global.document, global.navigator);
  const DungeonScene = moduleShim.exports.default;

  const game = new Phaser.Game({
    type: Phaser.HEADLESS, width: 800, height: 600,
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
    scene: [DungeonScene],
    active: true,
  });

  await new Promise((res) => game.events.once('ready', res));
  const scene = game.scene.getScene('Dungeon');
  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); };

  assert('scene created (no TypeError)', scene && scene.dungeon);
  assert('wallGroup populated', scene.wallGroup.getLength() > 100);
  assert('player exists', !!scene.player);
  const tile = scene.dungeon.tile;
  const tx = Math.floor(scene.player.x / tile), ty = Math.floor(scene.player.y / tile);
  assert('spawn tile walkable (not inside wall)', scene.generator.isWalkableTile(tx, ty));
  assert('camera bounds match world', scene.cameras.main.bounds.width === scene.dungeon.worldWidth && scene.cameras.main.bounds.height === scene.dungeon.worldHeight);
  assert('physics bounds match world', scene.physics.world.bounds.width === scene.dungeon.worldWidth);
  assert('collider player<->walls wired', scene.physics.colliders.list.length >= 1);
  assert('wall bodies are STATIC', Array.from(scene.wallGroup.getChildren()).slice(0, 20).every(r => r.body && r.body.type === Phaser.STATIC_BODY));
  assert('this.add.canvas does NOT exist (root cause)', typeof scene.add.canvas === 'undefined');
  assert('this.add.rectangle DOES exist (fix)', typeof scene.add.rectangle === 'function');

  // simulate G regeneration
  const oldGrid = scene.dungeon.grid;
  const oldWallCount = scene.wallGroup.getLength();
  scene.keys.G.isDown = true; scene.keys.G._justDown = true;
  Phaser.Input.Keyboard.JustDown = ((orig) => function (k) { if (k === scene.keys.G && k._justDown) { k._justDown = false; return true; } return orig.call(this, k); })(Phaser.Input.Keyboard.JustDown);
  scene.update(0, 16);
  assert('G regenerated dungeon', scene.dungeon.grid !== oldGrid || scene.wallGroup.getLength() === oldWallCount);
  const tx2 = Math.floor(scene.player.x / tile), ty2 = Math.floor(scene.player.y / tile);
  assert('spawn still walkable after regen', scene.generator.isWalkableTile(tx2, ty2));
  assert('only one collider after regen (no stacking)', scene.physics.colliders.list.length === 1);

  let fail = 0;
  for (const [n, ok] of checks) { if (!ok) fail++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); }
  game.destroy(true);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SMOKE CRASH:', e); process.exit(2); });
