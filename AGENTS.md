# Space Sentinel - Project Architecture & AI Instructions

> **CRITICAL INSTRUCTION FOR ALL AI SESSIONS:**
> This file (`AGENTS.md`) serves as the core architectural map for this project. If you (the AI) make **any** structural changes to the codebase (such as creating new files, extracting major components, or adding new root dependencies), you MUST immediately update this document to reflect those changes.

## Codebase Overview
"Space Sentinel" is a Vite + React application wrapping a vanilla Three.js engine. The source code has been broken out into isolated directories to prevent main-loop engine cross-contamination. The engine has been refactored into a modular system architecture: `physics.js` delegates to individual system modules in `systems/`, and the renderer is split into 3D (Three.js) and 2D (Canvas HUD) concerns.

### `/src`
The core directory containing the React-Three.js bridge.
- `App.jsx`: **Orchestrator (~182 lines).** Owns React state `gameState` (`start`, `map`, `playing`, `shop`, `event`, `gameover`, `victory`, `dev`), `uiScrap`, `uiLevels`, `mapStateVersion`, and `devMode`. Refs: `game` (mutable game state), `containerRef` (Three.js container), `canvasRef` (2D HUD canvas). Delegates game loop to `useGameLoop` hook and input handling to `useInput` hook. Contains `resetGame()`, `startGame()`, `launchDevMission()`, `buyUpgrade()`. Dev mode toggles via backtick key on start/gameover/victory screens and redirects map transitions back to the dev picker.
- `main.jsx`: Standard Vite React DOM initialization with StrictMode.

### `/src/hooks`
Custom React hooks that decompose App.jsx concerns.
- `useGameLoop.jsx`: Three.js scene init, animation frame loop, and resize handling. Returns `{ threeRef, statusRef, devModeRef, physicsCbs }` where `physicsCbs` is the callback object for `updatePhysics`. Manages `requestAnimationFrame` lifecycle and calls `updatePhysics()` + `drawFrame()` each tick.
- `useInput.jsx`: Keyboard and pointer event handlers. Returns `{ onPointerDown, onPointerMove, onPointerUp }` for attaching to the canvas container. Handles WASD/arrows, space (shop->map), backtick (dev mode toggle), and mouse/touch input for ship aiming and joystick.

### `/src/components`
Contains purely functional, isolated React GUI Overlays that render safely on top of the 3D canvas depending on the state of the game loop.
- `MapOverlay.jsx`: Sector map screen (Slay the Spire style). Handles node rendering, edge drawing, node-click dispatch logic, and viewport-adaptive layout. Uses `enterNodeMission` from `engine/missionSetup.js` for mission initialization. Props: `game`, `setGameState`, `setUiScrap`, `setUiLevels`, `setMapStateVersion`.
- `StartScreen.jsx`: The initial sequence trigger. Props: `startGame`, `devMode`.
- `ShopOverlay.jsx`: Renders all system upgrades from `UPGRADE_DATA` with cost calculation, max-level detection, and affordance checking. Props: `uiScrap`, `uiLevels`, `buyUpgrade`, `setGameState`.
- `EventScreen.jsx`: Renders interactive narrative encounters. Manages its own internal state for the selected random event from `EVENTS_DATA`. Executes choice callbacks then syncs UI state. Props: `gameRef`, `setGameState`, `setUiScrap`, `setUiLevels`.
- `DevMissionPicker.jsx`: Full-featured development mission selector. Supports 6 mission types (kill, collect, survive, escort, elite hunt, boss rush) with adjustable difficulty levels 1-20. Each mission type has color-coded cards with icons. Props: `onLaunch`, `onExit`.
- `VictoryScreen.jsx`: Handles end-of-sector boss clears. Props: `gameRef`, `startGame`.
- `GameOverScreen.jsx`: Handles hull-breach resets. Props: `gameRef`, `startGame`.

### `/src/constants`
Static data designed to be completely safely modifiable without touching core game loops.
- `gameConfig.js`: Centralized game configuration object (`GAME_CONFIG`). Contains all magic numbers for player stats, weapon parameters (damage, cooldowns, speed), enemy types, spawn rates, and game balance values.
- `upgrades.js`: Contains `UPGRADE_DATA` with 9 upgrade types: autoAim, autocannon, plasma, missiles, hull, shield, thrusters, magnet, pointDefense. Each has name, icon (lucide-react), description, baseCost, costMult, and maxLevel.
- `events.js`: Contains `EVENTS_DATA` array of randomized space encounter events. Each event has id, title, text, and choices with resolve callbacks that receive `gameRef`, `setUiScrap`, `setUiLevels`.

### `/src/engine`
Standalone simulation and rendering algorithms detached from React state.

#### Core modules
- `state.js`: Game state factory — `createGameState()` returns a fresh game state object with all defaults (player, scrap, wave, level, mission, map, arrays for enemies/projectiles/particles/pickups/effects/stars, levels, cooldowns, escort, keys, mouse, worldMouse). Defines the `GameState` typedef.
- `mapGenerator.js`: Defines `generateMap()`. Uses a 15x5 grid with 4 independent paths starting from columns [0, 1, 3, 4], each step moving up with possible diagonal drift, all converging on a boss node at the center of the final row.
- `combat.js`: Low-level combat utilities — `getNearestEnemy(x, y, enemies)` (pure), `fireProjectile(g, x, y, angle, speed, damage, type, pierceCount)` (mutates `g.projectiles`), `createParticles(g, x, y, count, color, speed, life)` (mutates `g.particles`). No React imports.
- `spawner.js`: Enemy and mission generation — `spawnEnemy(g, level)` (pushes to `g.enemies`), `generateMission(level, nodeType)` (pure — returns mission descriptor for boss/elite/kill/collect/survive types). No React imports.
- `escortSetup.js`: Reusable escort mission initialization — `setupEscort(g, level)` initializes escort drone state; `resetEscort(g)` clears it. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `beaconSetup.js`: Reusable defend mission beacon initialization — `setupBeacon(g, level)` initializes beacon state; `resetBeacon(g)` clears it. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `missionSetup.js`: Shared combat mission initialization — `setupCombatMission(g, mission, level)` resets per-mission state (player position, arrays, cooldowns); `enterNodeMission(g, level, nodeType)` generates + sets up a mission in one call. Used by both MapOverlay and App.jsx to avoid duplication.

#### Physics (simulation)
- `physics.js`: Main simulation step orchestrator — `updatePhysics(dt, g, cbs)`. Delegates to individual system modules below. Handles transition timer (post-mission countdown), mission completion detection, and ties all systems together. React state changes delivered via callbacks `{ setGameState, setMapStateVersion }`.

##### `/src/engine/systems/`
Each system receives explicit parameters (not reading from global state) and mutates the game state arrays directly.
- `playerMovement.js`: Player ship movement — `updatePlayer(dt, g)`. Handles keyboard (WASD/arrows) and touch joystick input, thrust, acceleration, yaw, and world bounds clamping.
- `weapons.js`: Player weapon firing — `updateWeapons(dt, g)`. Handles autocannon, plasma, missiles, and pointDefense firing with cooldowns, damage scaling, and homing missile targeting.
- `projectiles.js`: Projectile lifecycle — `updateProjectiles(dt, g)`. Movement, homing behavior, collision detection with enemies, and hit particles.
- `enemies.js`: Enemy AI — `updateEnemies(dt, g, diffMult)`. Movement toward player, firing, and collision with player hull.
- `pickups.js`: Scrap magnet — `updatePickups(dt, g)`. Magnet attraction and collection when player is close enough.
- `particles.js`: Visual effects — `updateParticles(dt, g)` and `updateEffects(dt, g)`. Particle lifecycle, position updates, and fade-out.
- `cleanup.js`: Dead entity removal — `cleanup(dt, g)`. Periodic pool cleanup of dead enemies, projectiles, particles, pickups.
- `mission.js`: Mission logic — `updateTransition(dt, g, cbs)`, `createCompleteMission(g)`, `checkMissionProgress(g, dt)`. Mission completion detection, rewards calculation, map progression, and transition timer.
- `escort.js`: Escort drone — `updateEscort(dt, g, diffMult)`. Escort drone movement, evasion behavior, collision, and mission progress checks.
- `beacon.js`: Beacon defense — `updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)`. Beacon HP management, enemy projectile/ram collision, defense radius targeting, and mission completion checks.

#### Rendering
- `renderer.js`: **Barrel module** — re-exports from renderer3d.js and renderer2d.js. Provides `drawFrame(threeObj, g, canvasEl, statusRef)` which calls both 3D and 2D renderers.
- `renderer3d.js`: Three.js scene setup and per-frame 3D rendering — `initThreeScene(containerEl)` returns scene object with camera, renderer, geometries cache, and materials. `draw3DFrame(threeObj, g)` handles chase camera following player, star field, player ship with dynamic turrets (mesh caching via Map), enemies, projectiles, particles, pickups, escort drone. `raycastToPlane()` and `projectToScreen()` for world/screen coordinate conversion. No React imports.
- `renderer2d.js`: 2D HUD overlay rendering on canvas — `draw2DFrame(camera, g, canvasEl, statusRef, projectFn)`. Renders top bar (HP/shield/scrap), mission progress bar, radar display, and touch joystick. No React imports, no Three.js scene logic.

## Defend Mission Type
- **Purpose:** Protect a stationary beacon from enemy attacks for a set duration
- **State:** `g.beacon` object with `active`, `x`, `y`, `hp`, `maxHp`, `radius`, `color`
- **Config:** `GAME_CONFIG.beacon` with `baseHp`, `hpPerLevel`, `spawnSpread`, `radius`, `defenseRadius`, `color`
- **Setup:** `beaconSetup.js` — `setupBeacon(g, level)`, `resetBeacon(g)`
- **System:** `systems/beacon.js` — `updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)`
- **Gameplay mechanics:**
  - Beacon spawns at fixed position (spawnSpread distance from player)
  - Enemy projectiles hitting beacon reduce its HP (10 * difficulty multiplier)
  - Enemy ramming reduces both beacon and enemy HP
  - Enemies within defenseRadius target beacon instead of player
  - Beacon destroyed (HP <= 0) triggers game over
  - Defend timer counts up; reaching target completes the mission
  - Beacon HP scales with level (baseHp + level * hpPerLevel)
- **Rendering:**
  - 3D: Wireframe tetrahedron + shield ring (cyan, 0x22d3ee)
  - 2D: HP bar + "BEACON [X HP]" label + radar diamond marker
- **Mission completion:** Survive until defend timer reaches target duration

## Deployment
The project uses `gh-pages` for GitHub Pages hosting. Run `npm run deploy` to build and publish to the `gh-pages` branch. This runs `npm run build` (via `predeploy`) then pushes `dist/` to the branch. Live site: https://zeljkokalezic.github.io/space_sentinel/
