# Space Sentinel - Project Architecture & AI Instructions

> **CRITICAL INSTRUCTION FOR ALL AI SESSIONS:**
> This file (`AGENTS.md`) serves as the core architectural map for this project. If you (the AI) make **any** structural changes to the codebase (such as creating new files, extracting major components, or adding new root dependencies), you MUST immediately update this document to reflect those changes.

## Codebase Overview
"Space Sentinel" is a Vite + React application wrapping a vanilla Three.js engine. The source code has been broken out into isolated directories to prevent main-loop engine cross-contamination.

### `/src`
The core directory containing the React-Three.js bridge.
- `App.jsx`: **Orchestrator (314 lines).** Owns React state `gameState` (`start`, `map`, `playing`, `shop`, `event`, `gameover`, `victory`, `dev`), `uiScrap`, `uiLevels`, `mapStateVersion`, and `devMode`. Refs: `game` (mutable game state), `threeRef` (Three.js scene), `canvasRef` (2D HUD canvas), `containerRef` (Three.js container), `reqRef` (animation frame), `statusRef` (synced gameState ref), `devModeRef` (synced devMode ref). Contains `resetGame()`, `startGame()`, `launchDevMission()`, `buyUpgrade()`, the `useEffect` game loop calling `updatePhysics()` and `drawFrame()`, plus keyboard/pointer/resize event wiring. Dev mode toggles via backtick key on start/gameover/victory screens and redirects map transitions back to the dev picker.
- `main.jsx`: Standard Vite React DOM initialization with StrictMode.

### `/src/components`
Contains purely functional, isolated React GUI Overlays that render safely on top of the 3D canvas depending on the state of the game loop.
- `MapOverlay.jsx`: Sector map screen (Slay the Spire style). Handles node rendering, edge drawing, node-click dispatch logic, and viewport-adaptive layout (row/column sizing based on screen dimensions). Props: `game`, `setGameState`, `setUiScrap`, `setUiLevels`, `setMapStateVersion`.
- `StartScreen.jsx`: The initial sequence trigger. Props: `startGame`, `devMode`.
- `ShopOverlay.jsx`: Renders all system upgrades from `UPGRADE_DATA` with cost calculation, max-level detection, and affordance checking. Props: `uiScrap`, `uiLevels`, `buyUpgrade`, `setGameState`.
- `EventScreen.jsx`: Renders interactive narrative encounters. Manages its own internal state for the selected random event from `EVENTS_DATA`. Executes choice callbacks then syncs UI state. Props: `gameRef`, `setGameState`, `setUiScrap`, `setUiLevels`.
- `DevMissionPicker.jsx`: Full-featured development mission selector. Supports 6 mission types (kill, collect, survive, escort, elite hunt, boss rush) with adjustable difficulty levels 1-20. Each mission type has color-coded cards with icons. Props: `onLaunch`, `onExit`.
- `VictoryScreen.jsx`: Handles end-of-sector boss clears. Props: `gameRef`, `startGame`.
- `GameOverScreen.jsx`: Handles hull-breach resets. Props: `gameRef`, `startGame`.

### `/src/constants`
Static data designed to be completely safely modifiable without touching core game loops.
- `upgrades.js`: Contains `UPGRADE_DATA` with 9 upgrade types: autoAim, autocannon, plasma, missiles, hull, shield, thrusters, magnet, pointDefense. Each has name, icon (lucide-react), description, baseCost, costMult, and maxLevel.
- `events.js`: Contains `EVENTS_DATA` array of randomized space encounter events. Each event has id, title, text, and choices with resolve callbacks that receive `gameRef`, `setUiScrap`, `setUiLevels`.

### `/src/engine`
Standalone simulation and rendering algorithms detached from React state.
- `mapGenerator.js`: Defines `generateMap()`. Uses a 15x5 grid with 4 independent paths starting from columns [0, 1, 3, 4], each step moving up with possible diagonal drift, all converging on a boss node at the center of the final row.
- `combat.js`: Low-level combat utilities — `getNearestEnemy(x, y, enemies)` (pure), `fireProjectile(g, x, y, angle, speed, damage, type, pierceCount)` (mutates `g.projectiles`), `createParticles(g, x, y, count, color, speed, life)` (mutates `g.particles`). No React imports.
- `spawner.js`: Enemy and mission generation — `spawnEnemy(g, level)` (pushes to `g.enemies`), `generateMission(level, nodeType)` (pure — returns mission descriptor for boss/elite/kill/collect/survive types). No React imports.
- `physics.js`: Main simulation step — `updatePhysics(dt, g, cbs)`. Contains the entire per-frame physics loop: transition timer handling (post-mission countdown to map/victory), mission completion detection and rewards, player movement (WASD/touch), enemy AI, weapons firing (autocannon/plasma/missiles/pointDefense), projectile updates, collision detection, pickup magnetism, particle updates, escort drone logic, and ship rotation toward mouse. React state changes delivered via callbacks `{ setGameState, setMapStateVersion }`.
- `renderer.js`: Three.js rendering and 2D HUD — `initThreeScene(containerEl)` returns scene object with camera, renderer, geometries cache, and materials. `drawFrame(threeObj, g, canvasEl, statusRef)` handles chase camera following player, star field, player ship with dynamic turrets that update based on weapon levels (mesh caching via Map), enemies, projectiles, particles, pickups, escort drone, and 2D HUD overlay on canvas. `raycastToPlane()` and `projectToScreen()` for world/screen coordinate conversion. No React imports.
