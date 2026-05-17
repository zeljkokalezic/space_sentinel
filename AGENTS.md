# Space Sentinel - Project Architecture & AI Instructions

> **CRITICAL INSTRUCTION FOR ALL AI SESSIONS:**
> This file (`AGENTS.md`) serves as the core architectural map for this project. If you (the AI) make **any** structural changes to the codebase (such as creating new files, extracting major components, or adding new root dependencies), you MUST immediately update this document to reflect those changes.

## Codebase Overview
"Space Sentinel" is a Vite + React application wrapping a vanilla Three.js engine. The source code has been broken out into isolated directories to prevent main-loop engine cross-contamination. The engine has been refactored into a modular system architecture: `physics.js` delegates to individual system modules in `systems/`, and the renderer is split into 3D (Three.js) and 2D (Canvas HUD) concerns.

### `/src`
The core directory containing the React-Three.js bridge.
- `App.jsx`: **Orchestrator (~199 lines).** Owns React state `gameState` (`start`, `map`, `playing`, `shop`, `event`, `gameover`, `victory`, `dev`), `uiScrap`, `uiLevels`, `uiShipSkin`, `uiUnlockedSkins`, `mapStateVersion`, and `devMode`. Refs: `game` (mutable game state), `containerRef` (Three.js container), `canvasRef` (2D HUD canvas). Delegates game loop to `useGameLoop` hook and input handling to `useInput` hook. Contains `resetGame()`, `startGame()`, `continueGame()`, `launchDevMission()`, `buyUpgrade()`, `buySkin()`. Dev mode toggles via backtick key on start/gameover/victory screens and redirects map transitions back to the dev picker.
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
- `DevMissionPicker.jsx`: Full-featured development mission selector. Supports 7 mission types (kill, collect, survive, escort, defend, sabotage, elite hunt, boss rush) with adjustable difficulty levels 1-20. Each mission type has color-coded cards with icons. Props: `onLaunch`, `onExit`.
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
- `state.js`: Game state factory — `createGameState()` returns a fresh game state object with all defaults (player, scrap, wave, level, mission, map, arrays for enemies/projectiles/particles/pickups/effects/stars, levels, cooldowns, escort, beacon, sabotage, hazards, keys, mouse, worldMouse). Defines the `GameState` typedef.
- `mapGenerator.js`: Defines `generateMap()`. Uses a 15x5 grid with 4 independent paths starting from columns [0, 1, 3, 4], each step moving up with possible diagonal drift, all converging on a boss node at the center of the final row.
- `combat.js`: Low-level combat utilities — `getNearestEnemy(x, y, enemies)` (pure), `fireProjectile(g, x, y, angle, speed, damage, type, pierceCount)` (mutates `g.projectiles`), `createParticles(g, x, y, count, color, speed, life)` (mutates `g.particles`). No React imports.
- `targeting.js`: Shared hostile target selection for enemies, bosses, mini-bosses, and sabotage structures. Provides target collection and nearest-target helpers used by auto-aim, missiles, and HUD indicators.
- `spawner.js`: Enemy and mission generation — `spawnEnemy(g, level)` (pushes to `g.enemies`), `generateMission(level, nodeType)` (pure — returns mission descriptor for boss/elite/kill/collect/survive/escort/defend/sabotage types). No React imports.
- `settings.js`: Persistent settings helpers (`getDefaultSettings`, `normalizeSettings`, `loadSettings`, `saveSettings`) backed by localStorage (`space_sentinel_settings`). Used by `createGameState()` and `SettingsOverlay.jsx`.
- `escortSetup.js`: Reusable escort mission initialization — `setupEscort(g, level)` initializes escort drone state; `resetEscort(g)` clears it. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `beaconSetup.js`: Reusable defend mission beacon initialization — `setupBeacon(g, level)` initializes beacon state; `resetBeacon(g)` clears it. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `sabotageSetup.js`: Reusable sabotage mission structure initialization — `setupSabotage(g, level)` spawns turret structures; `resetSabotage(g)` clears them. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
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
- `sabotage.js`: Sabotage turrets — `updateSabotage(dt, g, currentDiffMult, completeMission)`. Structure firing at player, player projectile collision with structures, enemy targeting bias toward structures, and mission completion when all structures destroyed.

#### Rendering
- `renderer.js`: **Barrel module** — re-exports from renderer3d.js and renderer2d.js. Provides `drawFrame(threeObj, g, canvasEl, statusRef)` which calls both 3D and 2D renderers.
- `renderer3d.js`: Three.js scene setup and per-frame 3D rendering — `initThreeScene(containerEl)` returns scene object with camera, renderer, geometries cache, and materials. `draw3DFrame(threeObj, g)` handles chase camera following player, star field, player ship with dynamic turrets (mesh caching via Map), enemies, projectiles, particles, pickups, escort drone. `raycastToPlane()` and `projectToScreen()` for world/screen coordinate conversion. No React imports.
- `renderer2d.js`: 2D HUD overlay rendering on canvas — `draw2DFrame(camera, g, canvasEl, statusRef, projectFn)`. Renders top bar (HP/shield/scrap), mission progress bar, radar display, and touch joystick. No React imports, no Three.js scene logic.

## Pause Menu
- **Key:** ESC toggles pause during gameplay
- **State:** `g.paused` boolean in game state
- **Behavior:** Pauses game loop (skips `updatePhysics`), shows PauseOverlay with Resume/Restart/Mute buttons
- **Component:** `PauseOverlay.jsx` — renders when `gameState === 'playing'` and `g.paused` is true
- **Input:** ESC key handler in `useInput.jsx` toggles `g.paused`
- **Game Loop:** `useGameLoop.jsx` checks `!game.current?.paused` before calling `updatePhysics`

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

## Sabotage Mission Type
- **Purpose:** Destroy N enemy turret structures scattered across the map
- **State:** `g.sabotage` object with `active`, `structures` array (each: `x`, `y`, `hp`, `maxHp`, `radius`, `fireCooldown`, `active`)
- **Config:** `GAME_CONFIG.sabotage` with `baseStructures`, `structuresPer2Levels`, `maxStructures`, `structureHp`, `hpPerLevel`, `structureRadius`, `fireCooldown`, `projectileDamage`, `projectileSpeed`, `spawnSpreadMin`, `spawnSpreadMax`, `protectRadius`, `color`, `scrapPerDestroy`
- **Setup:** `sabotageSetup.js` — `setupSabotage(g, level)`, `resetSabotage(g)`
- **System:** `systems/sabotage.js` — `updateSabotage(dt, g, currentDiffMult, completeMission, setGameState)`
- **Gameplay mechanics:**
  - Structures spawn in a ring around player at mission start (count scales with level, capped at 8)
  - Each structure fires projectiles at the player on a fixed cooldown
  - Player projectiles damage structures; destroyed structures spawn particles + scrap pickup
  - Enemies within protectRadius target structures instead of player
  - All structures destroyed completes the mission
  - Structure HP scales with level (structureHp + level * hpPerLevel)
- **Rendering:**
  - 3D: Octagonal wireframe cylinder (orange, 0xf97316) with slow rotation
  - 2D: HP bar + "TURRET [X HP]" label + radar square marker
- **Mission completion:** Destroy all structures

## Adding New Mission Types — Checklist
When adding a new mission type, update ALL of the following:
1. `src/constants/gameConfig.js` — Add config block with all magic numbers
2. `src/engine/state.js` — Add state property + default factory + JSDoc
3. `src/engine/*Setup.js` — Create setup/reset functions (e.g., `sabotageSetup.js`)
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
The project uses `gh-pages` for GitHub Pages hosting. Run `npm run deploy` to build and publish to the `gh-pages` branch. This runs `npm run build` (via `predeploy`) then pushes `dist/` to the branch. Live site: https://zeljkokalezic.github.io/space_sentinel/

## Audio System
- **Module:** `engine/audio.js` — Procedural Web Audio API sound generation
- **SoundManager:** Singleton with `play()`, `setMuted()`, `setVolume()`
- **SFX Types:** shoot, enemy_shoot, player_hit, shield_hit, pickup, explosion, mission_complete, game_over
- **Soundtrack:** Implemented inside `engine/audio.js` — ambient soundtrack layers with oscillators + LFO modulation
- **Mute Button:** Top-right HUD button (also in PauseOverlay)

## Achievement System
- **Module:** `engine/achievements.js` — 13 achievements tracking player milestones
- **Persistence:** localStorage (`space_sentinel_achievements`)
- **Checking:** Runs on mission completion via `checkAchievements()`
- **Notifications:** `AchievementNotification.jsx` — Toast-style popups with 6s display timer
- **Stats Tracked:** enemiesDestroyed, totalScrap, surviveMissions, escortMissions, defendMissions, sabotageMissions, bossesDefeated, upgradesMaxed, level
- **Achievements:** first_blood, veteran, slayer, scavenger, millionaire, survivor, escort_expert, defender, saboteur, boss_slayer, level_10, level_25, upgrade_master

## Save/Load System
- **Module:** `engine/saveManager.js` — Persistent game progress
- **Auto-save:** Triggers on every mission completion
- **Storage:** localStorage (`space_sentinel_autosave` for auto, `space_sentinel_save` for manual)
- **Continue Button:** Appears on StartScreen when auto-save exists
- **Saved Data:** Player stats, scrap, level, upgrades, map state, achievements, persistent stats

## Settings System
- **Component:** `SettingsOverlay.jsx` — Accessed from Pause Menu
- **Module:** `engine/settings.js` — settings defaults, normalization, load/save helpers
- **Persistence:** localStorage (`space_sentinel_settings`)
- **Audio:** Master volume, SFX volume, music volume sliders
- **Gameplay:** Difficulty (easy/normal/hard)
- **Display:** Particle quality (low/medium/high), FPS counter toggle, screen shake toggle
- **Accessibility:** Colorblind mode (none/protanopia/deuteranopia/tritanopia), reduced motion, high contrast

## Wave Patterns System
- **Module:** `engine/spawner.js` — Wave-based enemy spawning with formation support
- **Patterns:** single, spread, swarm, vee, box, circle, line, diamond, cross
- **Wave Config:** `GAME_CONFIG.waves` defines wave composition with pattern, enemy types, and timing
- **Formation Spawning:** `spawnWave()` places enemies in geometric patterns relative to spawn point

## Wave Announcer System
- **Purpose:** Visual and audio announcement between enemy spawn waves
- **Config:** `GAME_CONFIG.waveAnnouncer` — `enemiesPerWave: 10`, `announcementDuration: 2`
- **State:** `g.waveAnnounce` — `{ active, wave, timer }`; `g.waveCount` (total waves completed); `g.enemiesSpawnedThisWave` (counter)
- **System:** `engine/systems/waveAnnounce.js` — `updateWaveAnnounce(dt, g)` decrements timer, plays countdown beeps at integer boundaries (2, 1), plays wave_start on completion
- **Audio:** Three new sounds in `engine/audio.js`:
  - `wave_announce` — ascending tone sweep (not used by system; available for manual trigger)
  - `countdown_beep` — short 880Hz sine beep for countdown digits
  - `wave_start` — sharp square-wave attack sound when wave begins
- **Visual:** `engine/renderer2d.js` renders "WAVE N" centered on screen with red glow + white text, countdown digit below, fade in/out based on timer progress
- **Behavior:**
  - Every 10 enemies spawned = 1 wave completed
  - First wave (waveCount === 1) has NO announcement — enemies spawn immediately
  - From wave 2 onward: 2-second announcement blocks spawning, shows "WAVE N" text, plays countdown beeps at 2s and 1s, plays wave_start sound when countdown ends
  - spawnCooldown continues decrementing during announcement but spawnEnemy is skipped
- **Backwards Compatible:** Both `updateWaveAnnounce` and `spawnEnemy` guard against missing `g.waveAnnounce` state for test compatibility

## Performance Optimizations
- **Spatial Culling:** `cleanup.js` removes entities beyond 3000 units from player
- **Render Distance:** `renderer3d.js` skips rendering entities beyond 1800 units
- **LOD:** Distant enemies (>1000 units) rendered at 80% scale
- **Object Pooling:** `engine/pool.js` for reusable entity objects (projectiles, particles)

## Post-Mission Summary
- **Component:** `PostMissionSummary.jsx` — Shows mission stats during transition
- **Stats Displayed:** Enemies destroyed, scrap earned, time elapsed, accuracy, mission grade
- **Grade System:** S/A/B/C/D based on performance score
- **Timing:** Displays during `transitionTimer` countdown before map screen

## Mini-Boss System
- **Purpose:** Scaled-down boss fight every 3 levels as intermediate challenge
- **State:** `g.miniboss` object with same structure as `g.boss` (active, x, y, hp, maxHp, phase, attackTimer, chargeTimer, chargeTarget, isCharging, radius, speed, fireCooldown, spiralAngle)
- **Config:** `GAME_CONFIG.miniboss` with `hpPercent: 0.4`, `damagePercent: 0.5`, `radius: 40`, `baseSpeed: 50`, `speedPerLevel: 2`, `scrapReward: 100`, `spawnInterval: 3`, `color: 0xf97316`
- **Setup:** `minibossSetup.js` — `setupMiniboss(g, level)`, `resetMiniboss(g)`
- **System:** `systems/miniboss.js` — `updateMiniboss(dt, g, currentDiffMult, completeMission, setGameState)`
- **Map integration:** `miniboss` node type placed every 3 levels in mapGenerator.js
- **Mission type:** `kill_miniboss` routed in missionSetup.js and spawner.js
- **Rendering:** 3D: orange wireframe box (smaller than boss), 2D: HP bar + "MINI-BOSS" label
- **Map overlay:** Skull icon with orange border for miniboss nodes
- **Dev picker:** `kill_miniboss` mission type with yellow card

## Ship Customization (Skins)
- **Purpose:** Visual-only ship skins purchasable with scrap in shop
- **Data:** `src/constants/skins.js` — `SHIP_SKINS` array with 5 entries (id, name, hullColor, accentColor, engineGlow, cost)
- **State:** `g.shipSkin` (active skin index), `g.unlockedSkins` (boolean array, derived from SHIP_SKINS.cost === 0)
- **Shop:** `ShopOverlay.jsx` shows skin cards with color preview; buy/equip via `buySkin(index)` in App.jsx
- **Rendering:** `renderer3d.js` applies skin colors per-frame: hullColor to ship mesh, accentColor to shield, engineGlow to thruster exhaust meshes
- **Default skin (index 0) always unlocked, cost 0**

## Environmental Hazards
- **Purpose:** Dynamic battlefield modifiers that layer on top of existing mission types, adding spatial variety and strategic depth
- **State:** `g.hazards` array — each entry: `{ type, x, y, radius, active, id, ...type-specific props }`
- **Config:** `GAME_CONFIG.environmentalHazards` with per-hazard sub-configs (asteroidField, gravityWell, plasmaStorm, empZone) plus `baseChance`, `chancePerLevel`, `maxChance`, `maxHazardsPerMission`
- **Setup:** `hazardSetup.js` — `setupHazards(g, level, hazardTypes)`, `resetHazards(g)`
- **System:** `systems/environmentalHazards.js` — `updateEnvironmentalHazards(dt, g, setGameState)` returns boolean (true if gameover)
- **Gameplay mechanics:**
  - **Asteroid Field:** Stationary obstacles that block player/enemy movement (push-back collision) and absorb projectiles (spawn impact particles). Count scales with level (5-15).
  - **Gravity Well:** Pulls player, enemies, and projectiles toward center. Strength scales with level. Inverse-distance falloff (stronger at center, weaker at edge).
  - **Plasma Storm:** Moving damage zone that damages player (shield first, then hull) and enemies (2x multiplier). Storm respawns at new edge position after duration expires.
  - **EMP Zone:** Periodically disables all weapons (player and enemy) for a set duration when player is within radius. Creates vulnerability windows.
- **Map integration:** `mapGenerator.js` assigns hazard types to combat/elite/escort/defend/sabotage nodes based on level-scaled probability (10% base + 2% per row). Level 9+ nodes can get 2 hazards. Boss/miniboss nodes excluded.
- **Mission setup:** `missionSetup.js` calls `setupHazards` after mission-specific setup if `mission.hazardTypes` is present; calls `resetHazards` otherwise.
- **Rendering:**
  - 3D: Asteroids (gray icosahedron wireframes), Gravity Wells (concentric purple spinning rings + center sphere), Plasma Storms (purple translucent disc + edge ring), EMP Zones (yellow hexagonal outline + center sphere, opacity flickers when active)
  - 2D: Radar markers (gray dots, purple circles, purple zone circles, yellow hexagons), HUD warning text when player enters hazardous zone
- **Map overlay:** Hazard icon badges on affected nodes (Mountain, Wind, CloudLightning, Hexagon from lucide-react) with legend entries
- **Dev picker:** Hazard selector (None/Asteroids/Gravity/Plasma/EMP) passed to `launchDevMission` in App.jsx
- **Adding new hazard types:** Update `gameConfig.js`, add new update branch in `systems/environmentalHazards.js`, add spawn logic in `hazardSetup.js`, add 3D/2D rendering, update DevMissionPicker `HAZARD_OPTIONS`
