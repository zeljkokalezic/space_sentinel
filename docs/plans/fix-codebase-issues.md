# Fix Codebase Issues - Implementation Plan

## Overview

Fix all bugs, code quality issues, and missing tests identified during codebase analysis.

## Tasks

### Task 1: Fix enemies.js bugs
**Location:** `src/engine/systems/enemies.js`

Two bugs:
1. **Line 64:** Hardcoded damage text `'20'` in collision effect — should show actual computed damage value
2. **Line 67:** Particles spawned at `g.player.x, g.player.y` instead of collision point (enemy position) — particles should appear where the collision happens (the enemy's position)

**Steps:**
- Fix line 64: compute actual damage (before shield absorption) and display that
- Fix line 67: spawn particles at `e.x, e.y` (enemy position) instead of player position
- Run: `npx vitest run src/tests/systems/enemies.test.js` — verify tests still pass (or update if they check exact behavior)

### Task 2: Extract duplicate difficulty calculation to shared utility
**Locations:** `src/engine/physics.js` (line 41), `src/engine/spawner.js` (line 79)

Both files compute the same formula:
```js
0.5 + (g.level * 0.15) + Math.pow(g.level, 1.6) * 0.04 + g.totalTime / 100
```

**Steps:**
- Create `src/engine/difficulty.js` with:
  - `calculateDifficultyMultiplier(level, totalTime)` — returns the difficulty multiplier
- Import and use in `physics.js` and `spawner.js`
- Run: `npx vitest run` — verify no regressions
- Commit: `git add -A && git commit -m "refactor: extract duplicate difficulty calc to shared utility"`

### Task 3: Extract duplicate enemy firing logic from escort.js
**Locations:** `src/engine/systems/enemies.js` (lines 38-49), `src/engine/systems/escort.js` (lines 153-169)

The escort system duplicates the shooter/missile_boat firing logic that already exists in enemies.js. This violates DRY.

**Steps:**
- Create `src/engine/systems/enemyFire.js` with:
  - `fireEnemyWeapons(dt, enemy, targetX, targetY, distanceToTarget, currentDiffMult, gameState)` — handles cooldown decrement, range check, and fires appropriate projectiles for shooter/missile_boat types
- Refactor `enemies.js` to use this function for its firing section
- Refactor `escort.js` to use this function instead of the duplicated block
- Run: `npx vitest run` — verify no regressions
- Commit: `git add -A && git commit -m "refactor: extract duplicate enemy firing logic to shared function"`

### Task 4: Fix orphaned createGameState and App.jsx inline reset
**Locations:** `src/engine/state.js`, `src/App.jsx`

`createGameState()` exists in state.js but App.jsx builds the game state inline (lines 35-73 of App.jsx). The two copies can drift. Also, `performance.now()` in state.js breaks in Node.js tests, and `devMode` field is missing from the inline reset.

**Steps:**
- Fix `state.js`: make `lastTime` accept a parameter (default to 0 for test safety, or use `typeof performance !== 'undefined' ? performance.now() : 0`)
- Refactor `App.jsx`: replace the inline reset object (lines 35-73) with `createGameState()` call, then apply any App-specific overrides (like `scrap: 200`, `levels` object which should match)
- Ensure `devMode` field is added to state with default `false`
- Run: `npx vitest run` — verify tests still pass
- Commit: `git add -A && git commit -m "refactor: use createGameState factory in App.jsx, fix Node.js compat"`

### Task 5: Add missing unit tests for physics.js, combat.js, mapGenerator.js
**Locations:** `src/tests/` (new files)

Currently untested pure/utility modules:
- `src/engine/combat.js`: `getNearestEnemy`, `fireProjectile`, `createParticles`
- `src/engine/mapGenerator.js`: `generateMap` — verify structure, node counts, boss position, path connectivity
- `src/engine/physics.js`: `updatePhysics` — integration test verifying it calls systems in order (mock systems, verify call sequence)

**Steps:**
- Create `src/tests/combat.test.js` (note: combat.test.js already exists — check what it covers, extend if needed)
- Create `src/tests/mapGenerator.test.js` (note: mapGenerator.test.js already exists — check what it covers, extend if needed)
- Create `src/tests/physics.test.js` (new file)
- Use test helpers from `src/tests/helpers.js`
- Run: `npx vitest run` — verify all tests pass
- Commit: `git add -A && git commit -m "test: add missing unit tests for combat, mapGenerator, physics"`

## Dependencies

- Tasks 1-3 are independent and can run in parallel
- Task 4 depends on nothing (just state.js + App.jsx)
- Task 5 should run after Task 2 (difficulty extraction) so tests reference the correct module
