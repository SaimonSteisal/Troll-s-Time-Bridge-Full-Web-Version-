# 🗡 Ashenfall

**Ashenfall** is a cross-platform **2D Diablo-like action RPG** built as a web game.
One codebase, four control schemes: **Keyboard + Mouse, Gamepad, Touch (virtual joystick)**.

> Current status: **STEP 1 — Scaffold complete & verified.** No gameplay yet.

---

## 🚀 Quick start

```bash
# 0) Requirements: Node.js >= 18
node -v

# 1) Install dependencies
npm install

# 2) Run the dev server (hot reload)
npm run dev
#    -> http://localhost:5173

# 3) Production build + local preview
npm run build
npm run preview      # serves ./dist on http://localhost:4173
```

### Testing on a phone / tablet
`vite.config.js` sets `server.host: true`, so the dev server is exposed on your LAN.
Open the printed `Network:` URL (e.g. `http://192.168.x.x:5173`) from a device on the
same Wi-Fi to verify touch input and mobile scaling.

### Testing a gamepad in the browser
Chrome/Edge only (the Gamepad API is not exposed in Safari). Press any button on the pad
once to "wake" it, then check the HUD line `gamepad ...` in the test scene.

---

## 🧱 Tech stack

| Concern        | Choice                | Why                                                                     |
| -------------- | --------------------- | ----------------------------------------------------------------------- |
| Engine         | Phaser **3.90.0**     | Mature Arcade Physics, Scale Manager and Input plugins                   |
| Bundler/dev    | Vite **5.4.11**       | Instant HMR, ESM, trivial static hosting                                 |
| Language       | JavaScript (ES2020)   | Zero build friction; TypeScript can be layered in later without a rewrite|
| Rendering      | WebGL → Canvas2D auto | `Phaser.AUTO` falls back gracefully on older mobile WebViews             |
| Art pipeline   | AI-generated sprites  | Prompts in `docs/`; procedural placeholders until real assets land       |

⚠️ **Version note:** Phaser **4.x** is now the npm `latest` tag. We deliberately pin
**3.90.0** — the final 3.x release — because every doc snippet, plugin and tutorial this
project relies on targets the 3.x API (notably `Physics.Arcade`, `Scale.FIT`, `input.gamepad`).
Do **not** run `npm update phaser`.

---

## 📂 Project structure

```text
ashenfall/
├── index.html                    # viewport hardening + #game-root mount point
├── vite.config.js                # base:'./' (itch.io/GH Pages), publicDir:'assets', es2020
├── package.json
├── .gitignore
├── docs/                         # GDD + AI asset prompts (STEP 2 / STEP 3)
├── assets/
│   ├── placeholders/             # curated placeholder art
│   └── generated/                # raw AI output (git-ignored)
└── src/
    ├── main.js                   # boots Phaser, registers scenes
    ├── config/
    │   ├── gameConfig.js         # scale mode, render flags, physics, fps
    │   └── constants.js          # ACTIONS vocabulary + all tunable numbers
    ├── scenes/
    │   ├── BootScene.js          # texture generation / asset loading
    │   └── ScaffoldTestScene.js  # STEP 1 verification harness
    ├── entities/                 # Player, Enemy, Loot      (STEP 5)
    ├── systems/                  # Combat, CameraShake, Particles, UI (STEP 5-6)
    └── input/                    # InputManager: unified device abstraction (STEP 4)
```

### Architecture rules (non-negotiable — these are what keep the project scalable)
1. **Entities never read devices.** Only `InputManager` touches keys/mouse/pad/touch.
   Gameplay code asks for abstract actions: `MOVE`, `ATTACK`, `INTERACT`, `DASH`, `PAUSE`.
2. **Scenes are wiring; systems are logic.** A scene mostly composes objects from
   `/systems` and `/entities`.
3. **All tuning numbers live in `src/config/constants.js`** — no magic numbers in behaviour code.
4. **Render from placeholder textures first**; real art is a drop-in replacement, not a refactor.

---

## 🗺 Roadmap (iterative workflow)

- [x] **STEP 1** — Repo init, Vite + Phaser scaffold, modular folders, README
- [ ] **STEP 2** — Scope questions → 1-page GDD *(awaiting your answers)*
- [ ] **STEP 3** — Asset strategy: AI image prompts + placeholder pipeline
- [ ] **STEP 4** — `InputManager`: Keyboard / Mouse / Gamepad / Touch virtual joystick
- [ ] **STEP 5** — Features one at a time: loop → input → movement → camera → enemy AI → combat → loot/UI
- [ ] **STEP 6** — Juice: screen shake, particles, UI tweens, SFX prompts

---

## ✅ STEP 1 verification checklist

Run `npm run dev` and confirm:

- [ ] Title **"Ashenfall"** appears, then auto-transitions into the test scene (WebGL, zero console errors).
- [ ] A tiled dark floor fills a world larger than the screen (2560×1440) and the **camera follows** the blue disc.
- [ ] **WASD / arrows** move the disc; it stops cleanly at world bounds.
- [ ] The HUD reports renderer, design size vs window size, FPS, touch capability and gamepad ID.
- [ ] Resize the browser window: the canvas **letterboxes (Scale.FIT)** instead of stretching.
- [ ] Open the LAN URL on a phone: touch works, page does not scroll or pinch-zoom.
- [ ] `R` restarts the scene.

Verified locally with `npm run build` (production bundle compiles clean) and a headless
Chromium run that confirms both scenes boot without JS errors.

---

## 🏷 Git: first commit + remote

```bash
git init -b main
git add .gitignore package.json package-lock.json vite.config.js index.html README.md src assets docs
git commit -m "chore: STEP 1 scaffold - Vite + Phaser 3.90 modular project"

# Link your GitHub repo (create it EMPTY first - no README/license, or the push will conflict):
git remote add origin git@github.com:<your-user>/ashenfall.git
git branch -M main
git push -u origin main
```
