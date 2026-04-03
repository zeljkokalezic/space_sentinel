# 🌌 Space Sentinel

**Space Sentinel** is a 3D isometric sci-fi roguelite survival game built right in the browser! Players control a central defensive core fighting off expanding waves of enemies while navigating a structured, node-based sector map inspired by *Slay the Spire*.

## 🛸 Gameplay Loop
- **Sector Map Navigation:** Traverse a branching graph of procedural encounters. Choose carefully between risky Elite combat, standard battles, repair stations, or systemic upgrade shops.
- **Dynamic Combat:** Fully simulated 3D physics-based arena combat where you manually dodge homing missiles, attract scrap with magnets, and mow down incoming geometric threats.
- **Deep Upgrades:** Gather glowing scrap dynamically from destroyed enemies to install robust permanent upgrades (like *Twin Autocannons, Scything Plasma, Point Defenses,* or *Energy Shields*).
- **Core Defense:** Endure until you reach the climax of each 15-node sector map culminating in an intense Sector Boss fight!

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

## 🌐 Deployment
This game is optimized to act as a purely static frontend site with zero backend server necessities. It is automatically compiled and hosted securely out to GitHub Pages via the `"deploy": "gh-pages -d dist"` script in our `package.json`.

**Play it live here:** [https://zeljkokalezic.github.io/space_sentinel/](https://zeljkokalezic.github.io/space_sentinel/)
