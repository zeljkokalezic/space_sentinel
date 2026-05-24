# 🌌 Space Sentinel

**Space Sentinel** is a 3D isometric sci-fi roguelite survival game built right in the browser! Players control a central defensive core fighting off expanding waves of enemies while navigating a structured, node-based sector map inspired by *Slay the Spire*.

## 🛸 Gameplay Loop
- **Sector Map Navigation:** Traverse a branching graph of procedural encounters with combat, elite, mini-boss, gauntlet, wave-surge, escort, defend, sabotage, repair, event, shop, and boss nodes.
- **Dynamic Combat:** Fight in a fully simulated 3D arena with manual thrust/strafe controls, auto-aim upgrades, homing missiles, point defense, environmental hazards, sector weather, and elite enemy variants.
- **Progression:** Collect scrap, buy permanent upgrades, unlock ship skins, use one-shot emergency beacons, earn achievements, and carry your run into the next sector after each boss.
- **Sector Mastery:** Clear sectors for S/A/B/C/D ranks, unlock veteran rewards, choose temporary sector buffs, and push into harder maps with adaptive difficulty pressure.

## ✨ Current Features
- Procedural 15-row sector map with branching paths, hazards, sector weather, and boss finale.
- Multiple mission objectives: kill, collect, survive, escort, defend, sabotage, gauntlet, wave surge, elite hunt, mini-boss, and boss fights.
- Boss personality system with unique variants, attack patterns, rage mode, signature mechanics, and mini-boss encounters.
- Combat feedback systems: screen shake, hit stop, low HP warning, attack warnings, damage numbers, death pulses, scrap collection effects, and power-up aura rings.
- Save/load, auto-save, settings, accessibility options, achievements, pause menu, and a development mission picker.

## 💻 Technology Stack
- **Engine:** `Three.js` (Vanilla 3D WebGL physics & rendering loop).
- **UI & State:** `React 19` (overlayed interfaces, isolated components, seamless bridging).
- **Styling:** `Tailwind CSS V4` (glass-morphism, neon outlines, glowing dropshadows).
- **Icons:** `lucide-react` (clean vector iconography for overlays & maps).
- **Bundler:** `Vite` (Lightning-fast HMR and optimized static assets).

## 🚀 Running Locally

Ensure you have **Node.js** installed on your machine.

1. Clone or download this repository.
2. Install the necessary dependencies:
    ```bash
    npm install
    ```
3. Start the local Vite development server:
    ```bash
    npm run dev
    ```
4. Open the `http://localhost:5173/space_sentinel` link generated in your terminal!

## ✅ Verification
```bash
npm test -- --run
npm run lint
npm run build
```

## 🌐 Deployment
This game is optimized to act as a purely static frontend site with zero backend server necessities. It is deployed to GitHub Pages via the `gh-pages` npm package.

To deploy locally, run:
```bash
npm run deploy
```
This runs `vite build` (via `predeploy`) then pushes the `dist/` folder to the `gh-pages` branch.

**Play it live here:** [https://zeljkokalezic.github.io/space_sentinel/](https://zeljkokalezic.github.io/space_sentinel/)
