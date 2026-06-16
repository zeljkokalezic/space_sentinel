# Space Sentinel - Project Architecture & AI Instructions

> **CRITICAL INSTRUCTION FOR ALL AI SESSIONS:**
> This file (`AGENTS.md`) serves as the core architectural map for this project. If you (the AI) make **any** structural changes to the codebase (such as creating new files, extracting major components, or adding new root dependencies), you MUST immediately update this document to reflect those changes.

## Codebase Overview
"Space Sentinel" is a Vite + React application wrapping a vanilla Three.js engine. Source code is broken into isolated directories to prevent main-loop engine cross-contamination. The engine uses a modular system architecture: `physics.js` delegates to individual system modules in `systems/`, and the renderer is split into 3D (Three.js) and 2D (Canvas HUD) concerns.

### `/src`
- `App.jsx`: **Orchestrator.** Owns all React state (`gameState`, player/UI state). Delegates game loop to `useGameLoop` and input to `useInput`. Contains `resetGame`, `startGame`, `nextSector`, `buyUpgrade`, `buySkin`, `buyBeacon`, and `effectiveSetState` (intercepts game over when emergency beacon is active). Dev mode via backtick key.
- `main.jsx`: Standard Vite React DOM init with StrictMode.

### `/src/hooks`
- `useGameLoop.jsx`: Three.js scene init, rAF loop, and resize handling. Returns `{ threeRef, statusRef, devModeRef, physicsCbs }`. Calls `updatePhysics()` + `drawFrame()` each tick; skips physics when paused.
- `useInput.jsx`: Keyboard and pointer event handlers. Returns pointer callbacks for the canvas container. Handles WASD/arrows, Q/E strafe, space, ESC pause, B beacon, backtick dev mode, and mouse/touch aiming.

### `/src/components`
Purely functional React GUI overlays rendered on top of the 3D canvas.
- `MapOverlay.jsx`: Sector map (Slay the Spire style). Node rendering, edge drawing, click dispatch, hazard/weather badges, repair-node beacon reset.
- `ShopOverlay.jsx`: Upgrades, ship skins, and consumables (emergency beacon).
- `EventScreen.jsx`: Interactive narrative encounters from `EVENTS_DATA`.
- `DevMissionPicker.jsx`: Dev mission selector — 9 mission types, difficulty 1-20, hazard selection, boss/mini-boss variants.
- `VictoryScreen.jsx`: End-of-sector rank, rewards, buff selection, next-sector continuation.
- `PostMissionSummary.jsx`: Mission stats and grade during post-mission transition.
- `PauseOverlay.jsx`: Resume/Restart/Mute/Settings controls.
- `AchievementNotification.jsx` / `AchievementPanel.jsx`: Achievement toasts and panel.
- `SettingsOverlay.jsx`: Audio, difficulty, display, and accessibility settings.
- `ErrorBoundary.jsx`: Wraps the app; catches uncaught React errors and prevents white-screen crashes.
- `StartScreen.jsx`, `GameOverScreen.jsx`: Start and game-over triggers.

### `/src/constants`
Static data — safe to modify without touching game loops.
- `gameConfig.js`: `GAME_CONFIG` — all magic numbers for player stats, weapons, enemies, spawn rates, and balance.
- `upgrades.js`: `UPGRADE_DATA` — 10 upgrade/consumable types with cost curves, icons, and max levels.
- `events.js`: `EVENTS_DATA` — random space encounter events with choice callbacks.
- `bosses.js`: `BOSS_ROSTER` (3 full bosses) and `MINIBOSS_ROSTER` (3 mini-bosses) with geometry, colors, HP config, and attack pattern keys.
- `attackPatterns.js`: `ATTACK_PATTERNS` map — 9 reusable boss attack functions referenced by key in variant configs.
- `skins.js`: `SHIP_SKINS` — 5 visual-only ship skins with hull/accent/engine colors and scrap costs.

### `/src/engine`
Standalone simulation and rendering — no React imports.

#### Core modules
- `state.js`: `createGameState()` — fresh game state with all defaults.
- `mapGenerator.js`: `generateMap()` — 15×5 grid, 4 paths converging on a boss node; assigns mission types, hazards, mini-boss nodes, and sector weather.
- `combat.js`: Targeting helpers, projectile/particle creation, enemy death handling, shield checks, screen shake/hit-stop, `applyDamageWithShield()`.
- `viewport.js`: `getViewportSize()` with SSR fallbacks. Extracted from `combat.js` to avoid import cycle with `relicSystem.js`.
- `pool.js`: Fixed-capacity entity pools. `createPools(g)` attaches `g.entityPools`; spawn helpers recycle objects and fall back to plain arrays in tests.
- `targeting.js`: Shared hostile target selection. `getEnemyTarget(g)` returns escort position when active, else player.
- `spawner.js`: `spawnEnemy()`, wave-formation spawning, and `generateMission()` (pure — returns mission descriptor).
- `settings.js`: Persistent settings helpers backed by `localStorage`.
- `missionSetup.js`: `setupCombatMission()` + `enterNodeMission()` — shared mission initialization entry point for both MapOverlay and App.jsx.
- `*Setup.js` files: `escortSetup`, `beaconSetup`, `sabotageSetup`, `gauntletSetup`, `bossSetup`, `minibossSetup`, `hazardSetup` — each exports `setup*` and `reset*` helpers.
- `sectorRank.js`: End-of-sector score/rank, veteran-mode rewards, next-sector reset, buff selection.
- `saveManager.js`: Auto-save on mission completion via `localStorage`. Saves player stats, scrap, upgrades, map, achievements, sector progression, skins, and beacon state.
- `achievements.js`: 13 achievements checked on mission completion; persisted to `localStorage`.
- `screenShake.js`, `adaptiveDifficulty.js`, `difficulty.js`, `weaponSynergies.js`, `lowHpWarning.js`: Shared support systems.

#### Physics (simulation)
- `physics.js`: Main simulation step — `updatePhysics(dt, g, cbs)`. Orchestrates all systems below. Handles mission completion detection and transition timer. React state changes delivered via `cbs` callbacks.

##### `/src/engine/systems/`
Each system receives explicit parameters and mutates game state arrays directly.
- `playerMovement.js`: WASD/arrows + Q/E strafe + touch joystick. Velocity decomposed into forward + strafe components relative to ship yaw.
- `weapons.js`: Autocannon, plasma, missiles, point defense — cooldowns, damage scaling, homing targeting.
- `projectiles.js`: Movement, homing behavior, collision with enemies, hit particles.
- `enemies.js`: Enemy AI — movement, firing, collision with player hull.
- `pickups.js`: Magnet attraction and scrap collection. `triggerScrapCollection()` spawns golden burst particles + floating "+N" text + audio.
- `particles.js` / `effects.js`: Particle lifecycle, position, fade-out; power-up aura ring expansion.
- `attackWarnings.js`: Delayed danger markers and queued attack callbacks.
- `enemyFire.js`: Enemy weapon logic and elite-variant firing behavior.
- `deathPulses.js`: Expanding shockwaves and collision damage after special deaths.
- `dynamicFov.js`: Camera FOV response to hits and boss presence.
- `weather.js`: Solar flare, debris field, gravity anomaly, EMI — projectile/weapon modifiers.
- `environmentalHazards.js`: Asteroid fields, gravity wells, plasma storms, EMP zones — spatial battlefield modifiers.
- `cleanup.js`: Dead entity recycling into `entityPools` each frame; array compaction fallback for tests.
- `mission.js`: Mission completion detection, reward calculation, map progression, transition timer.
- `escort.js`: Escort drone movement, evasion, collision, mission progress.
- `beaconSystem.js`: Beacon HP management, projectile/ram collision, defense radius targeting, mission completion.
- `sabotage.js`: Turret structures — firing at player, player projectile collision, mission completion when all destroyed.
- `bossCore.js`: Shared boss/mini-boss AI — orbit/approach/charge movement, 3 HP-based phases, attack pattern lookup, rage mode (phase 3), death handling.
- `bossSignatureMechanics.js`: Per-boss unique mechanics (void zones, regen windows, phase-shift decoys).
- `boss.js` / `miniboss.js`: Thin wrappers around `bossCore.js` with boss/miniboss-specific damage and drop config.
- `powerups.js`: Pickup & buff management — nuke, repair, shield boost, rapid fire, damage surge, time slow. Active buffs stored in `g.activeBuffs`.
- `waveAnnounce.js`: Wave announcement — "WAVE N" display with countdown beeps every 10 enemies spawned.
- `audio.js`: Per-frame audio event detection — enemy deaths, pickups, player damage, dynamic soundtrack intensity.

#### Rendering
- `renderer.js`: Barrel module — `drawFrame(threeObj, g, canvasEl, statusRef)` calls both renderers.
- `renderer3d.js`: Three.js scene setup + per-frame 3D rendering — chase camera, starfield, player ship (skin colors applied per-frame), enemies, projectiles, particles, hazards, boss/beacon/turret meshes. Provides `raycastToPlane()` and `projectToScreen()`.
- `renderer2d.js`: 2D HUD canvas — HP/shield/scrap bar, mission progress, radar, touch joystick, combo display, wave announcer, weather/hazard warnings, power-up aura text, scrap floats, boss HP bar, low-HP vignette.

---

## Adding New Mission Types — Checklist
When adding a new mission type, update ALL of the following:
1. `src/constants/gameConfig.js` — Add config block with all magic numbers
2. `src/engine/state.js` — Add state property + default factory + JSDoc
3. `src/engine/*Setup.js` — Create setup/reset functions
4. `src/engine/systems/*.js` — Create system update function
5. `src/engine/physics.js` — Wire system into game loop
6. `src/engine/missionSetup.js` — Add setup/reset routing + mutual reset logic
7. `src/engine/spawner.js` — Add to `generateMission()` + mission type array
8. `src/engine/mapGenerator.js` — Add to random node distribution weights
9. `src/engine/renderer3d.js` + `renderer2d.js` — Add 3D visuals + 2D HUD rendering
10. `src/App.jsx` — Add to `launchDevMission()` `nodeTypeMap`
11. `src/components/DevMissionPicker.jsx` — Add to `MISSION_TYPES` array + `COLOR_MAP`
12. `AGENTS.md` — Document the new mission type
13. Tests — Update existing test files + create dedicated system/setup tests
14. Run `npm test -- --run` (all pass) + `npm run build` (success)

## Deployment
Uses `gh-pages`. Run `npm run deploy` to build and publish to `gh-pages` branch. Live site: https://zeljkokalezic.github.io/space_sentinel/
