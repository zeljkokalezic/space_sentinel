# Space Sentinel - Project Architecture & AI Instructions

> **CRITICAL INSTRUCTION FOR ALL AI SESSIONS:**
> This file (`AGENTS.md`) serves as the core architectural map for this project. If you (the AI) make **any** structural changes to the codebase (such as creating new files, extracting major components, or adding new root dependencies), you MUST immediately update this document to reflect those changes.

## Codebase Overview
"Space Sentinel" is a Vite + React application wrapping a vanilla Three.js engine. The source code has been broken out into isolated directories to prevent main-loop engine cross-contamination. The engine has been refactored into a modular system architecture: `physics.js` delegates to individual system modules in `systems/`, and the renderer is split into 3D (Three.js) and 2D (Canvas HUD) concerns.

### `/src`
The core directory containing the React-Three.js bridge.
- `App.jsx`: **Orchestrator (~276 lines).** Owns React state `gameState` (`start`, `map`, `playing`, `shop`, `event`, `gameover`, `victory`, `dev`), `uiScrap`, `uiLevels`, `uiShipSkin`, `uiUnlockedSkins`, `mapStateVersion`, `notificationVersion`, `devMode`, `paused`, and `uiEmergencyBeacon`. Refs: `game` (mutable game state), `containerRef` (Three.js container), `canvasRef` (2D HUD canvas). Delegates game loop to `useGameLoop` hook and input handling to `useInput` hook. Contains `resetGame()`, `startGame()`, `nextSector()`, `continueGame()`, `launchDevMission()`, `buyUpgrade()`, `buySkin()`, `buyBeacon()`, and `effectiveSetState()`. Dev mode toggles via backtick key on start/gameover/victory screens and redirects map transitions back to the dev picker.
- `main.jsx`: Standard Vite React DOM initialization with StrictMode.

### `/src/hooks`
Custom React hooks that decompose App.jsx concerns.
- `useGameLoop.jsx`: Three.js scene init, animation frame loop, and resize handling. Returns `{ threeRef, statusRef, devModeRef, physicsCbs }` where `physicsCbs` is the callback object for `updatePhysics`. Manages `requestAnimationFrame` lifecycle and calls `updatePhysics()` + `drawFrame()` each tick.
- `useInput.jsx`: Keyboard and pointer event handlers. Returns `{ onPointerDown, onPointerMove, onPointerUp }` for attaching to the canvas container. Handles WASD/arrows, Q/E strafe, space (shop->map), ESC pause, B emergency beacon activation, backtick (dev mode toggle), and mouse/touch input for ship aiming and joystick.

### `/src/components`
Contains purely functional, isolated React GUI Overlays that render safely on top of the 3D canvas depending on the state of the game loop.
- `MapOverlay.jsx`: Sector map screen (Slay the Spire style). Handles node rendering, edge drawing, node-click dispatch logic, hazard/weather badges, repair-node beacon reset, and viewport-adaptive layout. Uses `enterNodeMission` from `engine/missionSetup.js` for mission initialization. Props: `game`, `setGameState`, `setUiScrap`, `setUiLevels`, `setUiShipSkin`, `setUiUnlockedSkins`, `setMapStateVersion`, `mapStateVersion`, `setUiEmergencyBeacon`.
- `StartScreen.jsx`: The initial sequence trigger. Props: `startGame`, `devMode`.
- `ShopOverlay.jsx`: Renders all system upgrades from `UPGRADE_DATA`, ship skins from `SHIP_SKINS`, and consumables such as emergency beacons with cost calculation, max-level detection, and affordance checking. Props: `uiScrap`, `uiLevels`, `buyUpgrade`, `setGameState`, `uiShipSkin`, `uiUnlockedSkins`, `buySkin`, `uiEmergencyBeacon`, `buyBeacon`, `activeBuff`.
- `EventScreen.jsx`: Renders interactive narrative encounters. Manages its own internal state for the selected random event from `EVENTS_DATA`. Executes choice callbacks then syncs UI state. Props: `gameRef`, `setGameState`, `setUiScrap`, `setUiLevels`.
- `DevMissionPicker.jsx`: Full-featured development mission selector. Supports 9 mission types (kill, collect, survive, escort, defend, sabotage, elite hunt, boss rush, mini-boss) with adjustable difficulty levels 1-20, hazard selection, and boss/mini-boss variant selection. Props: `onLaunch`, `onExit`.
- `VictoryScreen.jsx`: Handles end-of-sector boss clears, sector rank calculation, rewards, buff selection, and next-sector continuation. Props: `gameRef`, `startGame`, `nextSector`.
- `GameOverScreen.jsx`: Handles hull-breach resets. Props: `gameRef`, `startGame`.
- `PauseOverlay.jsx`: Pause menu overlay with resume/restart/mute/settings controls. Props include game refs/state setters from `App.jsx`.
- `PostMissionSummary.jsx`: Shows mission stats and grade during the post-mission transition.
- `AchievementNotification.jsx` / `AchievementPanel.jsx`: Achievement toast display and panel UI.
- `SettingsOverlay.jsx`: Settings UI for audio, gameplay difficulty, display, and accessibility options.
- `ErrorBoundary.jsx`: Class component wrapping the entire app in `main.jsx`. Catches uncaught React errors, displays error message with reload button. Prevents white-screen crashes.

### `/src/constants`
Static data designed to be completely safely modifiable without touching core game loops.
- `gameConfig.js`: Centralized game configuration object (`GAME_CONFIG`). Contains all magic numbers for player stats, weapon parameters (damage, cooldowns, speed), enemy types, spawn rates, and game balance values.
- `upgrades.js`: Contains `UPGRADE_DATA` with 10 upgrade/consumable types: autoAim, autocannon, plasma, missiles, hull, shield, thrusters, magnet, pointDefense, emergencyBeacon. Each has name, icon (lucide-react), description, baseCost, costMult, and maxLevel; consumables use `isConsumable`.
- `events.js`: Contains `EVENTS_DATA` array of randomized space encounter events. Each event has id, title, text, and choices with resolve callbacks that receive `gameRef`, `setUiScrap`, `setUiLevels`.
- `bosses.js`: Boss and mini-boss roster data. `BOSS_ROSTER` (3 full boss variants) and `MINIBOSS_ROSTER` (3 mini-boss variants). Each variant: id, name, title, introText, color, innerColor, geometry (box/octahedron/dodecahedron/tetrahedron/icosahedron), radius, HP config, speed, attackPatterns { phase1, phase2, phase3 }, deathColors, guaranteedDrops, scrapReward. Boss selection: `BOSS_ROSTER[level % BOSS_ROSTER.length]`.
- `attackPatterns.js`: Boss attack pattern function library (`ATTACK_PATTERNS` map). Each pattern: `(g, boss, angle, damage, speed) => void`. Patterns: single_aimed, spread_shot, spiral_barrage, burst_ring, double_aimed, wide_spread, zigzag_spread, orbiting_mines, homing_burst. Boss variants reference patterns by key in their `attackPatterns` config.

### `/src/engine`
Standalone simulation and rendering algorithms detached from React state.

#### Core modules
- `state.js`: Game state factory — `createGameState()` returns a fresh game state object with all defaults (player, scrap, wave, level, mission, map, arrays for enemies/projectiles/particles/pickups/effects/stars, levels, cooldowns, escort, beacon, sabotage, gauntlet, waveSurge, hazards, weather, emergencyBeacon, adaptiveDifficulty, keys, mouse, worldMouse). Defines the `GameState` typedef.
- `mapGenerator.js`: Defines `generateMap()`. Uses a 15x5 grid with 4 independent paths starting from columns [0, 1, 3, 4], each step moving up with possible diagonal drift, all converging on a boss node at the center of the final row. Assigns mission node types, hazard metadata, mini-boss nodes, and sector-level weather.
- `combat.js`: Low-level combat utilities — targeting helpers, projectile creation, particle creation, enemy death handling, directional shield checks, screen shake/hit stop triggers, shield restoration, player i-frames, combo milestones, damage numbers, and power-up aura triggers. No React imports.
- `targeting.js`: Shared hostile target selection for enemies, bosses, mini-bosses, and sabotage structures. Provides target collection and nearest-target helpers used by auto-aim, missiles, and HUD indicators.
- `spawner.js`: Enemy and mission generation — `spawnEnemy(g, level)` / wave formation spawning (pushes to `g.enemies`), `spawnMiniInterceptors()`, and `generateMission(level, nodeType)` (pure — returns mission descriptor for boss/elite/kill/collect/survive/escort/defend/sabotage/gauntlet/wave_surge/miniboss types). No React imports.
- `settings.js`: Persistent settings helpers (`getDefaultSettings`, `normalizeSettings`, `loadSettings`, `saveSettings`) backed by localStorage (`space_sentinel_settings`). Used by `createGameState()` and `SettingsOverlay.jsx`.
- `escortSetup.js`: Reusable escort mission initialization — `setupEscort(g, level)` initializes escort drone state; `resetEscort(g)` clears it. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `beaconSetup.js`: Reusable defend mission beacon initialization — `setupBeacon(g, level)` initializes beacon state; `resetBeacon(g)` clears it. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `sabotageSetup.js`: Reusable sabotage mission structure initialization — `setupSabotage(g, level)` spawns turret structures; `resetSabotage(g)` clears them. Used by both App.jsx (dev mode) and MapOverlay.jsx (normal play).
- `gauntletSetup.js`: Reusable gauntlet/wave-surge initialization — `setupGauntlet`, `resetGauntlet`, `setupWaveSurge`, `resetWaveSurge`.
- `bossSetup.js`: Boss fight initialization — `setupBoss(g, level)`, `resetBoss(g)`. Selects variant from `BOSS_ROSTER`, spreads properties, triggers intro effects + spawn sound.
- `minibossSetup.js`: Mini-boss fight initialization — `setupMiniboss(g, level)`, `resetMiniboss(g)`. Selects variant from `MINIBOSS_ROSTER`, spreads properties, triggers intro effects + spawn sound.
- `missionSetup.js`: Shared combat mission initialization — `setupCombatMission(g, mission, level)` resets per-mission state (player position, arrays, cooldowns); `enterNodeMission(g, level, nodeType, node)` generates + sets up a mission in one call, copying node hazards and sector weather. Used by both MapOverlay and App.jsx to avoid duplication.
- `sectorRank.js`: End-of-sector score/rank system, veteran-mode rewards, next-sector reset, and selected rank buffs.
- `screenShake.js`, `adaptiveDifficulty.js`, `difficulty.js`, `weaponSynergies.js`: Shared support systems for combat feedback, difficulty scaling, difficulty multipliers, and weapon synergy modifiers.

#### Physics (simulation)
- `physics.js`: Main simulation step orchestrator — `updatePhysics(dt, g, cbs)`. Delegates to individual system modules below. Handles transition timer (post-mission countdown), mission completion detection, and ties all systems together. React state changes delivered via callbacks `{ setGameState, setMapStateVersion }`.

##### `/src/engine/systems/`
Each system receives explicit parameters (not reading from global state) and mutates the game state arrays directly.
- `playerMovement.js`: Player ship movement — `updatePlayer(dt, g)`. Handles keyboard (WASD/arrows + Q/E strafe) and touch joystick input. W/S thrust forward/back, A/D rotate yaw, Q/E strafe left/right (perpendicular to ship facing). Touch joystick decomposes into forward + strafe components relative to ship yaw. Velocity: `vx = fwdX*thrust*speed + rightX*strafe*strafeSpeed`, `vy = fwdY*thrust*speed + rightY*strafe*strafeSpeed`. Strafe speed = forwardSpeed * `strafeSpeedRatio` (0.7) + thruster level bonus. World bounds clamping.
- `weapons.js`: Player weapon firing — `updateWeapons(dt, g)`. Handles autocannon, plasma, missiles, and pointDefense firing with cooldowns, damage scaling, and homing missile targeting.
- `projectiles.js`: Projectile lifecycle — `updateProjectiles(dt, g)`. Movement, homing behavior, collision detection with enemies, and hit particles.
- `enemies.js`: Enemy AI — `updateEnemies(dt, g, diffMult)`. Movement toward player, firing, and collision with player hull.
- `pickups.js`: Scrap magnet — `updatePickups(dt, g)`. Magnet attraction and collection when player is close enough.
- `particles.js`: Visual effects — `updateParticles(dt, g)` and `updateEffects(dt, g)`. Particle lifecycle, position updates, and fade-out.
- `attackWarnings.js`: Delayed attack warning indicators with callbacks used by elite/boss-style attacks.
- `enemyFire.js`: Enemy weapon firing helpers and elite variant attack behavior.
- `deathPulses.js`: Shockwave/death pulse effects and collision damage.
- `dynamicFov.js`: Camera FOV response to hits, boss deaths, and combat intensity.
- `weather.js`: Sector weather effects — solar flare, debris field, gravity anomaly, and EMI logic plus projectile/weapon modifiers.
- `cleanup.js`: Dead entity removal — `cleanup(dt, g)`. Periodic pool cleanup of dead enemies, projectiles, particles, pickups.
- `mission.js`: Mission logic — `updateTransition(dt, g, cbs)`, `createCompleteMission(g)`, `checkMissionProgress(g, dt)`. Mission completion detection, rewards calculation, map progression, and transition timer.
- `escort.js`: Escort drone — `updateEscort(dt, g, diffMult)`. Escort drone movement, evasion behavior, collision, and mission progress checks.
- `beacon.js`: Beacon defense — `updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)`. Beacon HP management, enemy projectile/ram collision, defense radius targeting, and mission completion checks.
- `sabotage.js`: Sabotage turrets — `updateSabotage(dt, g, currentDiffMult, completeMission)`. Structure firing at player, player projectile collision with structures, enemy targeting bias toward structures, and mission completion when all structures destroyed.
- `bossCore.js`: Shared boss/mini-boss AI — `updateBossCore(dt, boss, g, currentDiffMult, damageMult, onDeath, completeMission, setGameState)`. Handles movement (orbit/approach/charge), phase transitions (3 HP-based phases), attacks via ATTACK_PATTERNS lookup from `boss.attackPatterns`, charge attacks (phase 2+), player ram collision, and death (particles, power-up drops, scrap reward, mission completion). Boss-specific differences passed via `damageMult` (1 vs `C.miniboss.damagePercent`) and `onDeath` config (death colors, guaranteed drops, scrap value).
- `bossSignatureMechanics.js`: Per-boss signature mechanics including void zones, regen windows, and phase-shift decoys.
- `boss.js`: Boss wrapper — `updateBoss(dt, g, currentDiffMult, completeMission, setGameState)`. Delegates to `updateBossCore` with boss-specific config (full damage, guaranteed power-up drops, fixed scrap reward).
- `miniboss.js`: Mini-boss wrapper — `updateMiniboss(dt, g, currentDiffMult, completeMission, setGameState)`. Delegates to `updateBossCore` with scaled damage (`C.miniboss.damagePercent`), no guaranteed drops, level-scaled scrap reward.
- `powerups.js`: Power-up pickup & buff management — `updatePowerups(dt, g)`. Power-ups: `nuke` (instant kill all enemies), `repair` (restore HP), `shieldBoost` (temporary shield), `rapidFire` (reduced cooldowns), `damageSurge` (increased damage), `timeSlow` (slowed enemy movement). Dropped on enemy kill (5% chance) or boss death (guaranteed: shieldBoost + damageSurge). Active buffs stored in `g.activeBuffs` with per-buff timers.
- `audio.js`: Per-frame audio event detection — `updateAudio(dt, g)`. Compares current game state against previous frame (`g.audio._prev`) to detect transitions: new enemy deaths (explosion sound), new pickups collected (pickup sound), player HP/shield decreases (hit sounds). Manages dynamic soundtrack intensity (calm/tense/triumphant) based on enemy count and player HP. Wired into `physics.js` before cleanup.
- **Combo system** (distributed, no standalone file): Kill streak state in `state.js` (`g.combo`), increment on enemy kill via `combat.js` (`killEnemy`), timer decay + scrap multiplier on pickup collection in `pickups.js`, display in `renderer2d.js`, milestone sounds in `audio.js`. Config: `GAME_CONFIG.combo` — 3s timer window, milestone tiers at 5/10/15 kills for 1.5x/2x/3x scrap.

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

## Gauntlet & Wave Surge Mission Types
- **Gauntlet purpose:** Clear a fixed sequence of enemy waves with short delays between waves
- **Wave Surge purpose:** Survive a timed high-intensity spawn burst
- **State:** `g.gauntlet` (`active`, `currentWave`, `totalWaves`, `enemiesPerWave`, `enemiesSpawnedInWave`, `waveDelay`, `betweenWaves`) and `g.waveSurge` (`active`, `remaining`, `spawnRateMult`)
- **Config:** `GAME_CONFIG.gauntlet` and `GAME_CONFIG.waveSurge`
- **Setup:** `gauntletSetup.js` — `setupGauntlet`, `resetGauntlet`, `setupWaveSurge`, `resetWaveSurge`
- **System wiring:** `physics.js` manages gauntlet wave transitions/final completion and wave-surge countdown/spawn-rate changes; `mission.js` completes gauntlet when all waves are cleared and wave surge when the timer expires
- **Map integration:** `mapGenerator.js` can place `gauntlet` and `wave_surge` nodes; `spawner.js` returns matching mission descriptors
- **Rendering:** `renderer2d.js` displays mission progress/wave state through the existing mission HUD

## Emergency Beacon
- **Purpose:** One-use shop consumable that lets the player respawn once instead of taking a game over
- **Data:** `UPGRADE_DATA.emergencyBeacon` (`isConsumable: true`)
- **State:** `g.emergencyBeacon` — `{ purchased, activated, nodeId }`; mirrored to React via `uiEmergencyBeacon`
- **Purchase:** `ShopOverlay.jsx` renders the beacon item; `App.jsx` `buyBeacon(cost)` subtracts scrap and marks it purchased
- **Activation:** B key in `useInput.jsx` arms the beacon during gameplay when purchased and not already activated
- **Respawn:** `App.jsx` `effectiveSetState('gameover')` intercepts death when activated, restores HP/shield, clears combat arrays, returns to map, and consumes the beacon (`purchased=false`)
- **Reset:** Repair nodes in `MapOverlay.jsx` clear all beacon state so another beacon can be bought later

## Sector Rank / Veteran Progression
- **Purpose:** End-of-sector grading and next-sector continuity
- **Module:** `engine/sectorRank.js`
- **State:** `g.sector` tracks sector number, rank, score, A-rank streak, veteran mode, active buff, cleared/completed missions, HP totals, and mission timing arrays
- **Completion tracking:** `systems/mission.js` records every mission completion for sector rank and adaptive difficulty
- **Victory flow:** `VictoryScreen.jsx` calculates sector rank, applies rewards, offers A/S-rank buff choices, and calls `nextSector()`
- **Next sector:** `App.jsx` mutates the existing run into a fresh generated sector map while preserving player progression, scrap, upgrades, skins, achievements, stats, and selected sector state

## Sector Weather
- **Purpose:** Sector-wide modifiers that make regular missions play differently
- **State:** `g.weather` with active weather types and per-weather substates (`solarFlare`, `debris`, `gravityZones`, `emi`)
- **Config:** `GAME_CONFIG.weather`
- **System:** `systems/weather.js` — `initWeather`, `updateWeather`, `resetWeather`, projectile speed/block checks, weapon disable checks, and solar flare state helpers
- **Types:** Solar Flare, Debris Field, Gravity Anomaly, and EMI
- **Map integration:** `mapGenerator.js` assigns `map.weatherTypes`; `enterNodeMission()` copies those types onto normal missions so `setupCombatMission()` initializes weather
- **Rendering:** Weather warnings, debris/gravity indicators, and weather-specific HUD/radar feedback live in `renderer2d.js` / `renderer3d.js`

## Adaptive Difficulty
- **Purpose:** Adjust pressure based on recent player performance without replacing the explicit difficulty setting
- **Module:** `engine/adaptiveDifficulty.js`
- **State:** `g.adaptiveDifficulty` tracks pressure history, low/high pressure timers, rampage mode, high-HP mission streaks, spawn-rate multiplier, and enemy-aggression multiplier
- **Physics wiring:** `physics.js` updates pressure and passes adaptive aggression into enemy behavior; mission completion records high-HP streaks

## Combat Feedback & Elite Variant Systems
- **Attack warnings:** `systems/attackWarnings.js` renders delayed danger markers and executes queued attack callbacks
- **Enemy fire:** `systems/enemyFire.js` centralizes enemy weapon logic and elite variant firing behavior
- **Directional shields:** Tank elites use `combat.checkDirectionalShield()`; any hit against a charged side is absorbed and depletes that side
- **Death pulses:** `systems/deathPulses.js` handles expanding shockwaves and collision damage after special deaths
- **Dynamic FOV:** `systems/dynamicFov.js` adjusts camera FOV for hits, boss deaths, and boss presence
- **Weapon synergies:** `weaponSynergies.js` applies cross-weapon modifiers used by `weapons.js`, `projectiles.js`, and `combat.js`

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
- **Entity Cleanup:** `cleanup.js` uses filter-based GC on entity arrays (enemies, projectiles, particles, pickups, effects) at 5-second intervals

## Post-Mission Summary
- **Component:** `PostMissionSummary.jsx` — Shows mission stats during transition
- **Stats Displayed:** Enemies destroyed, scrap earned, time elapsed, accuracy, mission grade
- **Grade System:** S/A/B/C/D based on performance score
- **Timing:** Displays during `transitionTimer` countdown before map screen

## Boss Personality System
- **Purpose:** Each boss/mini-boss has unique identity (name, appearance, attacks, intro)
- **Data:** `constants/bosses.js` — `BOSS_ROSTER` (3 variants), `MINIBOSS_ROSTER` (3 variants)
- **Attack patterns:** `constants/attackPatterns.js` — 9 reusable pattern functions
- **Boss variants (full):** Void Reaper (red box, single->spread->spiral), Nexus Prime (purple dodecahedron, double->wide spread->orbiting mines), Phantom Warden (cyan octahedron, single->zigzag->homing burst)
- **Mini-boss variants:** Scout Alpha (orange box), Razor Wing (yellow tetrahedron), Iron Hull (gray icosahedron)
- **Selection:** `BOSS_ROSTER[level % BOSS_ROSTER.length]` (deterministic by level)
- **Setup:** `bossSetup.js` / `minibossSetup.js` — select variant, spread properties, trigger intro effects + spawn sound
- **AI:** `bossCore.js` resolves attack pattern from `boss.attackPatterns.phase{N}` via `ATTACK_PATTERNS` map
- **Rendering:**
  - 3D: Geometry (box/octahedron/dodecahedron/tetrahedron/icosahedron), per-variant colors
  - 2D: Boss name on HP bar, intro text (subtitle + big name) via `boss_intro` effect type
- **Audio:** `boss_spawn` (deep rumble + rising alarm), `boss_intro` (descending minor chord sting)
- **Adding new variants:** Add entry to `BOSS_ROSTER`/`MINIBOSS_ROSTER` with id, name, colors, geometry, attackPatterns
- **Adding new attacks:** Add function to `attackPatterns.js`, reference by key in variant config

## Boss Rage Mode
- **Purpose:** Dramatic visual and audio escalation when bosses enter phase 3 (final phase, ≤33% HP), signaling increased danger and creating tension
- **Trigger:** Automatically activated in `bossCore.js` when `newPhase === 3 && !boss.rage`
- **State:** `boss.rage` (boolean), `boss.rageAuraTimer` (seconds since rage started), `boss.rageEmberTimer` (cooldown for ember emission)
- **Config:** `GAME_CONFIG.boss.rage` — `rageColor: 0xff3333`, `auraBaseRadius: 80`, `auraMaxRadius: 120`, `auraPulsePeriod: 1.5`, `emberSpawnRate: 0.08`, `emberCount: 3`, `emberColor: 0xff6600`, `screenShakePreset: 'bigExplosion'`, `hitStopPreset: 'bossHit'`, `enragedPopupLife: 1.5`
- **Effects on activation:**
  - Screen shake (`bigExplosion` preset) + hit stop (`bossHit` preset)
  - Dual particle burst (rage color + boss normal color)
  - "⚠ ENRAGED" popup effect (red, shaking + pulsing, 1.5s lifetime)
  - Audio: `boss_rage` sound (3-layer: deep growl + harsh buzz + rising shriek)
- **Continuous while enraged:**
  - Ember particles: 3 per 0.08s, orange (0xff6600), radial emission from boss surface
  - 3D aura ring: Pulsing red ring (80-120 radius, sine wave on `rageAuraTimer`)
  - Radar indicator: Pulsing red ring around boss dot (larger dot when enraged)
- **Rendering:**
  - 3D: `renderer3d.js` — `THREE.RingGeometry` aura ring for boss + scaled-down for miniboss
  - 2D: `renderer2d.js` — `enraged` effect type (shaking red text), boss/miniboss radar dots with pulsing rage ring
- **Applies to both bosses and mini-bosses** (same rage config, scaled aura for minibosses at 70% size)
- **Audio:** `boss_rage` in `audio.js` — 3-layer sound: sawtooth growl (60-120Hz), square buzz (200-350Hz), sine shriek (400-1200Hz)

## Mini-Boss System
- **Purpose:** Scaled-down boss fight every 3 levels as intermediate challenge
- **State:** `g.miniboss` object with same structure as `g.boss` (active, x, y, hp, maxHp, phase, attackTimer, chargeTimer, chargeTarget, isCharging, radius, speed, fireCooldown, spiralAngle)
- **Config:** `GAME_CONFIG.miniboss` with `hpPercent: 0.4`, `damagePercent: 0.5`, `radius: 40`, `baseSpeed: 50`, `speedPerLevel: 2`, `scrapReward: 100`, `spawnInterval: 3`, `color: 0xf97316`
- **Setup:** `minibossSetup.js` — `setupMiniboss(g, level)`, `resetMiniboss(g)`
- **System:** `systems/miniboss.js` — `updateMiniboss(dt, g, currentDiffMult, completeMission, setGameState)`
- **Map integration:** `miniboss` node type placed every 3 levels in mapGenerator.js
- **Mission type:** `kill_miniboss` routed in missionSetup.js and spawner.js
- **Rendering:** 3D: per-variant geometry/color (from MINIBOSS_ROSTER), 2D: HP bar + boss name label
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

## Low HP Warning System
- **Purpose:** Visual and audio feedback when player HP drops below safe thresholds, creating tension and urgency
- **State:** `g.lowHpWarning { active, intensity (0-1), isCritical, pulseTimer, heartbeatTimer }`
- **Config:** `GAME_CONFIG.lowHpWarning` — `warningThreshold: 0.3` (30% HP), `criticalThreshold: 0.15` (15% HP), `pulsePeriod: 1.5` (seconds), `heartbeatInterval: 1.0` (seconds)
- **Module:** `lowHpWarning.js` — `getLowHpWarningLevel(hp, maxHp)` (pure), `updateLowHpWarning(dt, g)` (game loop)
- **Visual:** Red radial gradient vignette from screen edges (transparent at center). Pulsing via sine wave on `pulseTimer`. Intensity maps to alpha (0-0.7). Thicker border at critical (4px vs 2px). "⚠ LOW HULL" text at critical.
- **Audio:** Heartbeat sound (`SoundManager.play('heartbeat')`) — dual-layer sine oscillators (low thump + higher click). Interval halves when critical (1.0s → 0.5s).
- **Physics wiring:** Called in `physics.js` after screen shake decay, before escort/beacon/sabotage/boss systems. Null-guarded for test mocks.
- **Levels:** 0 = inactive (>30% HP), 1 = warning (15-30%), 2 = critical (≤15%)
- **Intensity:** Linear interpolation from 0 at warningThreshold to 1 at 0 HP

## Scrap Collection Effects
- **Purpose:** Visual and audio feedback when the player collects scrap, making the core resource loop more satisfying
- **State:** `g.scrapFloats` array — each entry: `{ x, y, text, life, maxLife, color, active }`
- **Config:** `GAME_CONFIG.scrapCollection` — `particleCount: 8`, `particleColor: 0xfbbf24`, `floatLife: 1.0`, `floatSpeed: 40`, `floatColor: '#fbbf24'`, `flashOpacity: 0.06`, `flashDuration: 0.1`, `flashMinValue: 3`, `maxFloats: 30`
- **Module:** `systems/pickups.js` — `triggerScrapCollection(g, x, y, value)` called when scrap is collected
- **Effects:** Golden burst particles at collection point, floating "+N" number that rises and fades, metallic "cha-ching" audio (`SoundManager.play('scrap_collect')`), screen flash for pickups >= flashMinValue
- **Rendering:** 2D floating numbers in `renderer2d.js` (projected from world to screen), screen flash via `g.screenFlash` (shared with combo celebration system)
- **Cleanup:** Inactive floats filtered in `systems/cleanup.js` every 2 seconds
- **Audio:** Dual-oscillator metallic ping — high sine sweep (1800→2400→1200Hz) + secondary shimmer (2800→1600Hz)

## Power-up Pickup Aura Rings
- **Purpose:** Expanding energy ring + floating buff name text when collecting power-ups, providing clear visual confirmation
- **State:** `g.powerupAuras` array — each entry: `{ active, x, y, color, type, icon, name, ringRadius, ringMaxRadius, ringLife, ringMaxLife, textY, textLife, textMaxLife }`
- **Config:** `GAME_CONFIG.powerupAura` — `expandSpeed: 300`, `maxRadius: 150`, `ringDuration: 0.8`, `lineWidth: 3`, `textDuration: 1.5`, `textFloatSpeed: 30`, `textFontSize: 14`, `maxAuras: 10`
- **Module:** `combat.js` — `triggerPowerupAura(g, type, color, x, y)` creates aura effect; `systems/particles.js` — `updatePowerupAuras(dt, g)` handles ring expansion + text float + cleanup
- **Trigger:** Called from `systems/powerups.js` when player enters power-up pickup radius
- **Visual:** Expanding ring (3D via `geoms.deathPulseRing` + 2D canvas arc), floating buff name with icon (e.g. "⚡ Rapid Fire"), type-matched colors, radar markers
- **Cleanup:** Dead auras filtered in `updatePowerupAuras` — ring stops at maxRadius, text floats until textLife expires, both must be expired to deactivate
- **Icon mapping:** `GAME_CONFIG.powerups[type]?.icon` with '✦' fallback; name formatted from camelCase via `/([a-z])([A-Z])/g`
