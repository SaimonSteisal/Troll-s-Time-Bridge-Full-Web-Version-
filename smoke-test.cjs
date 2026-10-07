// Headless smoke test for DungeonScene using the prebuilt Phaser UMD bundle.
// It loads the REAL scene sources through src/main.js (bundled with esbuild),
// so what runs here is exactly what the browser runs under Vite.
//
// NOTE: `window` must exist BEFORE phaser.js is require()'d -- the UMD bundle
// touches `window.cordova` at module-init time (phaser.js:24602). The previous
// version of this file defined window *after* the require, which crashed the
// harness before it could test anything.
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', maxTouchPoints: 0, language: 'en', platform: 'linux', vendor: '' },
  configurable: true, writable: true,
});

function makeCtx() {
  const noop = () => {};
  return {
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', imageSmoothingEnabled: true, canvas: null,
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop,
    fill: noop, stroke: noop, clip: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    translate: noop, rotate: noop, scale: noop, transform: noop, setTransform: noop, resetTransform: noop,
    fillText: noop, strokeText: noop, drawImage: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    setLineDash: noop, getLineDash: () => [],
    measureText: (t) => ({ width: String(t).length * 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    putImageData: noop,
  };
}

function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), nodeType: 1, style: {}, children: [],
    clientWidth: 800, clientHeight: 600, parentElement: null, dataset: {},
    classList: { add(){}, remove(){}, contains(){return false;} },
    appendChild(c){ this.children.push(c); c.parentElement = this; return c; },
    removeChild(c){ this.children = this.children.filter(x=>x!==c); return c; },
    setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    getContext(type){ return type === '2d' ? (() => { const c = makeCtx(); c.canvas = el; return c; })() : null; }, focus(){},
    getBoundingClientRect(){ return {left:0,top:0,width:800,height:600,right:800,bottom:600}; },
  };
  if ((tag || '').toLowerCase() === 'canvas') {
    el.width = 300; el.height = 150;
    const ctx = makeCtx();
    ctx.canvas = el;
    el.getContext = (type) => (type === '2d' ? ctx : null); // WebGL unavailable -> Phaser falls back to Canvas/Headless
    el.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
  }
  return el;
}
const body = makeEl('body');
global.document = {
  body, documentElement: makeEl('html'), createElement: (t) => makeEl(t),
  createElementNS: (ns, t) => makeEl(t), getElementById: () => null,
  querySelector: () => null,
  addEventListener(){}, removeEventListener(){}, hidden: false, readyState: 'complete',
};
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 5);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.window = {
  innerWidth: 800, innerHeight: 600, devicePixelRatio: 1,
  document: global.document, navigator: global.navigator, location: { href: '' },
  addEventListener(){}, removeEventListener(){},
  requestAnimationFrame: global.requestAnimationFrame,
  cancelAnimationFrame: global.cancelAnimationFrame,
  // Phaser's TimeStep reads window.performance.now() — Node exposes
  // `performance` as a global but it is NOT automatically mirrored onto the
  // fake `window` object, so wire it in explicitly here.
  performance: globalThis.performance,
};
if (!global.window.performance) {
  global.window.performance = { now: () => Number(process.hrtime.bigint()) / 1e6 };
}
// Phaser's Device/Features checks read these off `window` (not the Node global),
// e.g. `Features.canvas = !!window['CanvasRenderingContext2D']`. Without them the
// harness dies with "Cannot create Canvas context, aborting." before any scene runs.
global.window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
global.window.HTMLCanvasElement = function HTMLCanvasElement() {};
global.window.Image = global.Image;
global.screen = { width: 800, height: 600, availWidth: 800, availHeight: 600 };
global.window.screen = global.screen;
global.self = global.window;

// Phaser's DeviceInfo feature-detection touches these at module-init time.
global.Image = class Image {
  constructor() { this.width = 1; this.height = 1; }
  set src(v) { if (this.onload) setTimeout(() => this.onload(), 0); }
  get src() { return ''; }
  addEventListener() {} removeEventListener() {}
};
global.AudioContext = undefined;
global.HTMLCanvasElement = function HTMLCanvasElement() {};
global.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
global.WebGLRenderingContext = function WebGLRenderingContext() {};

const Phaser = require('./node_modules/phaser/dist/phaser.js');

(async () => {
  // transpile the real entry point + all deps to CJS on the fly
  const esbuild = require('esbuild');
  const result = await esbuild.build({
    entryPoints: ['src/main.js'],
    alias: { phaser: './node_modules/phaser/dist/phaser.js' },
    bundle: true, format: 'cjs', write: false, platform: 'neutral',
    
    define: {
      'window': 'globalThis.window',
      'document': 'globalThis.document',
      'navigator': 'globalThis.navigator',
      'screen': 'globalThis.screen',
      'localStorage': 'undefined',
    },
  });
  const code = result.outputFiles[0].text;
  const moduleShim = { exports: {} };
  const fn = new Function(
    'module', 'exports', 'require', 'Phaser', 'window', 'document', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame',
    code,
  );
  fn(moduleShim, moduleShim.exports, require, Phaser, global.window, global.document,
     global.navigator, global.requestAnimationFrame, global.cancelAnimationFrame);
  global.Phaser = Phaser;
  const game = moduleShim.exports.default;
  if (!game || !game.scene) throw new Error('src/main.js did not export a Phaser.Game instance');

  // Boot -> ScaffoldTest starts itself after 600ms; hop straight into Dungeon.
  await new Promise((res) => game.events.once('ready', res));
  // SceneManager queues start/shutdown operations and only processes them on
  // the NEXT game step, so getScene()/isActive() are still empty right after
  // 'ready'. Let the loop run a few frames (Boot -> delayedCall -> queue),
  // then force-start Dungeon and pump more frames until its create() has run.
  const hop = () => new Promise((res) => setTimeout(res, 30));
  for (let i = 0; i < 12 && !game.scene.isActive('Boot'); i++) await hop();
  game.scene.stop('ScaffoldTest');
  if (!game.scene.isActive('Dungeon') && !game.scene.getScene('Dungeon')?.sys?.isActive()) {
    game.scene.start('Dungeon');
  }
  let scene = null;
  for (let i = 0; i < 50; i++) {
    await hop();
    scene = game.scene.getScene('Dungeon');
    if (scene && scene.dungeon) break;
  }
  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); };

  assert('create() ran without TypeError (this.dungeon set)', !!(scene && scene.dungeon));
  assert('no "add.canvas" call left in the source', !/add\.canvas\s*\(/.test(require('fs').readFileSync('src/scenes/DungeonScene.js','utf8')));
  assert('this.add.canvas does NOT exist (root cause confirmed)', typeof scene.add.canvas === 'undefined');
  assert('this.add.rectangle DOES exist (fix uses it)', typeof scene.add.rectangle === 'function');
  assert('wallGroup populated with rects', scene.wallGroup.getLength() > 100);
  assert('floorGroup populated with rects', scene.floorGroup.getLength() > 100);
  assert('player exists', !!scene.player);
  const tile = scene.dungeon.tile;
  const tx = Math.floor(scene.player.x / tile), ty = Math.floor(scene.player.y / tile);
  assert('spawn tile walkable (not inside a wall)', scene.generator.isWalkableTile(tx, ty));
  assert('rooms >= 8', scene.dungeon.rooms.length >= 8);
  assert('camera bounds match generated world', scene.cameras.main.bounds.width === scene.dungeon.worldWidth && scene.cameras.main.bounds.height === scene.dungeon.worldHeight);
  assert('physics bounds match generated world', scene.physics.world.bounds.width === scene.dungeon.worldWidth && scene.physics.world.bounds.height === scene.dungeon.worldHeight);
  assert('collider player<->walls wired', scene.physics.colliders.list.length >= 1);
  assert('wall bodies are STATIC', Array.from(scene.wallGroup.getChildren()).slice(0, 20).every(r => r.body && r.body.type === Phaser.STATIC_BODY));
  assert('HUD text present', !!scene.hud && typeof scene.hud.text === 'string' && scene.hud.text.length > 0);

  // simulate the "G" regeneration path
  const oldGrid = scene.dungeon.grid;
  scene.keys.G.isDown = true; scene.keys.G._justDown = true;
  Phaser.Input.Keyboard.JustDown = ((orig) => function (k) {
    if (k === scene.keys.G && k._justDown) { k._justDown = false; return true; }
    return orig.call(this, k);
  })(Phaser.Input.Keyboard.JustDown);
  scene.update(0, 16);
  assert('G regenerated dungeon (new grid)', scene.dungeon.grid !== oldGrid);
  const tx2 = Math.floor(scene.player.x / tile), ty2 = Math.floor(scene.player.y / tile);
  assert('spawn still walkable after regen', scene.generator.isWalkableTile(tx2, ty2));
  assert('only one collider after regen (no stacking)', scene.physics.colliders.list.length === 1);
  assert('wall count sane after regen', scene.wallGroup.getLength() > 100);

  let fail = 0;
  for (const [n, ok] of checks) { if (!ok) fail++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + n); }
  game.destroy(true);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SMOKE CRASH:', e); process.exit(2); });
