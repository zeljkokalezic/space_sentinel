---
name: space-sentinel-planning
description: "Use when planning, implementing, or debugging features in the Space Sentinel game project. Encodes project architecture, conventions, test commands, and validation steps."
version: 1.0.0
author: Space Sentinel Team
license: MIT
metadata:
  hermes:
    tags: [planning, space-sentinel, game-dev, threejs, react, vitest]
    related_skills: [plan, subagent-driven-development, writing-plans]
---

# Space Sentinel Planning Skill

## Overview

Space Sentinel is a Vite + React + Three.js space shooter game with a modular engine architecture. This skill encodes project conventions, file locations, test commands, and implementation patterns to ensure consistent planning and development.

## Project Architecture

### Source Layout
```
src/
├── App.jsx                    # React orchestrator (~182 lines), owns gameState
├── main.jsx                   # Vite React entry
├── hooks/
│   ├── useGameLoop.jsx        # Three.js scene init, rAF loop, resize
│   └── useInput.jsx           # Keyboard + pointer events
├── components/                # Pure React UI overlays (7 components)
│   ├── MapOverlay.jsx         # Sector map (Slay the Spire style)
│   ├── StartScreen.jsx        # Initial sequence
│   ├── ShopOverlay.jsx        # 9 upgrade types
│   ├── EventScreen.jsx        # Random encounters
│   ├── DevMissionPicker.jsx   # Dev mode: 7 mission types, levels 1-20
│   ├── VictoryScreen.jsx      # Boss clear
│   └── GameOverScreen.jsx     # Hull breach reset
├── constants/
│   ├── gameConfig.js          # GAME_CONFIG: all magic numbers
│   ├── upgrades.js            # UPGRADE_DATA: 9 upgrades
│   └── events.js              # EVENTS_DATA: random encounters
├── engine/                    # Standalone simulation (no React imports)
│   ├── state.js               # createGameState() factory + GameState typedef
│   ├── physics.js             # updatePhysics(dt, g, cbs) orchestrator
│   ├── combat.js              # fireProjectile, createParticles, getNearestEnemy
│   ├── spawner.js             # spawnEnemy, generateMission
│   ├── mapGenerator.js        # 15x5 grid, 4 paths to boss
│   ├── missionSetup.js        # setupCombatMission, enterNodeMission
│   ├── difficulty.js          # difficulty multipliers
│   ├── renderer.js            # Barrel: re-exports 3d + 2d
│   ├── renderer3d.js          # Three.js scene + draw3DFrame
│   ├── renderer2d.js          # Canvas HUD + draw2DFrame
│   ├── audio.js               # SoundManager (Web Audio API, 13 sounds)
│   ├── *Setup.js              # Per-mission setup modules (escort, beacon, sabotage)
│   └── systems/               # Per-system update functions (12 systems)
└── tests/                     # Vitest test suite (21 test files, 730 tests)
```

### Mission Types (7 total)
| Type | Purpose | Setup Module | System |
|------|---------|-------------|--------|
| kill | Destroy N enemies | missionSetup.js | mission.js |
| collect | Collect N scrap | missionSetup.js | mission.js |
| survive | Survive N seconds | missionSetup.js | mission.js |
| escort | Protect moving drone | escortSetup.js | escort.js |
| defend | Protect stationary beacon | beaconSetup.js | beacon.js |
| sabotage | Destroy N turrets | sabotageSetup.js | sabotage.js |
| boss | Fight Sentinel Core | missionSetup.js | mission.js |

### Game State Flow
1. `App.jsx` owns React state (`gameState`, `uiScrap`, `uiLevels`, `mapStateVersion`, `devMode`)
2. `useGameLoop` manages rAF loop, calls `updatePhysics(dt, g, cbs)` + `drawFrame()`
3. `physics.js` delegates to individual systems in `systems/`
4. Systems mutate game state `g` directly (no React imports)
5. React state sync via callbacks `cbs = { setGameState, setMapStateVersion }`

## Implementation Patterns

### Adding a New Mission Type (14-step checklist)
1. `src/constants/gameConfig.js` — Add config block with all magic numbers
2. `src/engine/state.js` — Add state property + default + JSDoc
3. `src/engine/*Setup.js` — Create setup/reset functions
4. `src/engine/systems/*.js` — Create system update function
5. `src/engine/physics.js` — Wire system into game loop
6. `src/engine/missionSetup.js` — Add setup/reset routing + mutual reset logic
7. `src/engine/spawner.js` — Add to `generateMission()` + mission type array
8. `src/engine/mapGenerator.js` — Add to random node distribution weights
9. `src/engine/renderer3d.js` + `renderer2d.js` — Add 3D visuals + 2D HUD
10. `src/App.jsx` — Add to `launchDevMission()` `nodeTypeMap`
11. `src/components/DevMissionPicker.jsx` — Add to `MISSION_TYPES` + `COLOR_MAP`
12. `AGENTS.md` — Document the new mission type
13. Tests — Update existing + create dedicated system/setup tests
14. Run `npm test -- --run` (all pass) + `npm run build` (success)

### Adding a New System Module
1. Create `src/engine/systems/<name>.js` with `update<Name>(dt, g, ...params)`
2. Wire into `physics.js` `updatePhysics()` call chain
3. Pass explicit params (no reading from global state)
4. Mutate `g` arrays directly
5. Add tests to `src/tests/systems/<name>.test.js`

### Adding a New Upgrade
1. Add entry to `UPGRADE_DATA` in `src/constants/upgrades.js`
2. Include: name, icon (lucide-react), description, baseCost, costMult, maxLevel
3. Add game config magic numbers to `GAME_CONFIG`
4. Wire into `App.jsx` `buyUpgrade()` if custom logic needed
5. Add to `ShopOverlay.jsx` if custom rendering

### Adding Sound Effects
1. Add sound definition to `src/engine/audio.js` SoundManager
2. Use procedural Web Audio API (oscillators, noise buffers)
3. Wire trigger in relevant system (`systems/audio.js` for per-frame, or direct in weapons/projectiles/enemies)
4. Add test to `src/tests/audio.test.js` or `src/tests/systems/audio.test.js`

## Commands

### Validation (run after every change)
```bash
npm test -- --run          # Run all 730 tests (must all pass)
npm run build              # Production build (must succeed)
npm run deploy             # Build + push to gh-pages
```

### Development
```bash
npm run dev                # Vite dev server
npx vitest src/tests/path/to/test.test.js  # Single test file
```

## Conventions

### Engine Code Rules
- **No React imports** in `src/engine/` — engine is framework-agnostic
- **Explicit params** — systems receive `dt`, `g`, and needed callbacks as arguments
- **Direct mutation** — systems mutate `g` arrays directly (not immutable updates)
- **JSDoc typedefs** — `state.js` defines the `GameState` typedef
- **Delta time** — all movement/simulation uses `dt` parameter (seconds)

### Test Conventions
- Tests live in `src/tests/` (mirrors engine structure)
- Vitest with `node` environment, globals enabled
- Helper functions in `src/tests/helpers.js`
- Mock React callbacks with vi.fn()
- Target: 80%+ coverage on engine and constants

### Rendering
- 3D: Three.js chase camera, dynamic mesh caching via Map
- 2D: Canvas overlay for HUD (HP bar, scrap, radar, mission progress)
- Both renderers receive explicit params, no shared state

### Deployment
- GitHub Pages via `gh-pages` package
- Base path: `/space_sentinel/`
- Live: https://zeljkokalezic.github.io/space_sentinel/

## Common Pitfalls

1. **Forgetting mutual reset** — When adding a mission type, ensure `missionSetup.js` resets other mission states to prevent cross-contamination
2. **Missing dev mode wiring** — New missions need entries in `App.jsx` `launchDevMission()` `nodeTypeMap`
3. **React in engine** — Never import React inside `src/engine/`; use callbacks for state sync
4. **Missing map weights** — New mission types need weights in `mapGenerator.js` or they never appear in normal play
5. **Sound memory leaks** — One-shot audio nodes must disconnect after envelope; use setTimeout pattern
6. **Delta time units** — All systems expect `dt` in seconds, not milliseconds
7. **State factory** — New state properties must be added to `createGameState()` or they're undefined on reset

## Verification Checklist

After any feature implementation:
- [ ] `npm test -- --run` passes (all tests green)
- [ ] `npm run build` succeeds
- [ ] New mission appears in DevMissionPicker (dev mode)
- [ ] New mission appears in normal map play
- [ ] Game state resets cleanly between missions
- [ ] AGENTS.md updated if architecture changed
- [ ] No React imports leaked into engine/
