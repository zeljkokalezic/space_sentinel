# Test Suite Implementation Plan

## Overview
Add a comprehensive Vitest test suite for the Space Sentinel game engine. The engine is already well-structured with pure functions and modular systems, making it ideal for unit testing.

## Test Framework
- **Vitest** — Native Vite integration, ES modules, fast
- **Testing utilities** — Custom game state factory helpers

## Tasks

### Task 1: Setup Vitest configuration and test infrastructure
- Install `vitest` as devDependency
- Create `vite.config.js` (or update existing) with test config
- Create `src/tests/helpers.js` with test utilities:
  - `createTestState()` — creates game state with `performance.now` mocked
  - `createTestEnemy(x, y, type)` — factory for test enemies
  - `createTestProjectile(x, y, angle, type)` — factory for test projectiles
  - `createTestParticle(x, y)` — factory for test particles
  - `createTestPickup(x, y)` — factory for test pickups
- Add `"test": "vitest"` script to package.json
- Run `npm test -- --run` to verify empty suite passes

### Task 2: Test `state.js` — Game state factory
- Test `createGameState()` returns correct default values:
  - Player defaults (x=0, y=0, hp=300, maxHp=300, shield=20, speed=120)
  - Scrap starts at 200
  - Wave starts at 1, level starts at 1
  - All arrays are empty (enemies, projectiles, particles, pickups, effects)
  - Stars array has 800 entries
  - Levels object has correct defaults
  - Cooldowns object has correct defaults
  - Escort defaults (active=false)
  - Map is generated (non-null, has nodes and edges)
- Test each call returns independent state (no shared references)

### Task 3: Test `mapGenerator.js` — Sector map generation
- Test `generateMap()` returns correct structure:
  - Has `nodes` array, `edges` array
  - `currentRow` starts at -1, `currentNodeId` is null
- Test node properties:
  - Each node has `id`, `row`, `col`, `type`, `status`
  - First row nodes are 'available', others are 'locked'
  - Boss node exists at last row, center column
  - Repair nodes exist at second-to-last row
  - Shop nodes exist at midpoint row
- Test edge connectivity:
  - Every non-first-row node has at least one incoming edge
  - Boss node is reachable from all paths
- Test node type distribution:
  - Mix of combat, event, shop, repair, elite, boss nodes
  - Valid node types only

### Task 4: Test `combat.js` — Combat utilities
- Test `getNearestEnemy()`:
  - Returns closest active enemy
  - Skips inactive enemies
  - Returns null for empty list
  - Handles single enemy
- Test `fireProjectile()`:
  - Adds projectile to g.projectiles
  - Correct velocity based on angle and speed
  - Correct radius per type (plasma=12, missile=8, default=5)
  - Missile type sets target to random active enemy
  - Enemy missile type sets target to player
  - `isEnemy` flag set correctly for enemy_* types
  - Pierce count defaults to 0
- Test `createParticles()`:
  - Creates correct number of particles
  - Each particle has correct properties (vx, vy, vz, life, color, active)
  - Particles spread in random directions

### Task 5: Test `spawner.js` — Mission and enemy generation
- Test `generateMission()` for each node type:
  - 'boss' -> kill_boss with target=1
  - 'elite' -> kill_elite with level-scaled target
  - 'kill' -> kill mission with level-scaled target
  - 'collect' -> collect mission with level-scaled target
  - 'survive' -> survive mission with level-scaled target
  - 'escort' -> escort mission
  - 'combat' -> random type (but deterministic for level 1 and 2)
- Test `spawnEnemy()`:
  - Adds enemy to g.enemies
  - Enemy spawned within spawn radius range
  - Enemy type determined by roll + eliteBonus
  - Enemy stats scaled by difficulty multiplier
  - All enemies have required properties

### Task 6: Test `systems/playerMovement.js` — Player movement
- Test keyboard input handling:
  - A/Left rotates yaw positive
  - D/Right rotates yaw negative
  - W thrusts forward (positive thrust)
  - S thrusts backward (negative thrust)
- Test movement physics:
  - Velocity updated based on yaw and thrust
  - Position updated based on velocity
  - Velocity damping/friction
- Test world bounds clamping:
  - Player stays within bounds
- Test touch joystick input (when available)
- Test no input = no movement (velocity damping only)

### Task 7: Test `systems/projectiles.js` — Projectile lifecycle
- Test projectile movement (position updated by velocity * dt)
- Test projectile lifetime expiry (active=false after lifetime)
- Test collision detection with enemies:
  - Projectile hits enemy within radius
  - Enemy HP reduced by projectile damage
  - Piercing projectiles hit multiple enemies
  - Non-piercing projectiles deactivated on hit
  - Hit particles created on collision
- Test homing missile behavior (steers toward target)
- Test inactive projectiles skipped

### Task 8: Test `systems/enemies.js` — Enemy AI
- Test enemy movement toward player
- Test enemy firing (projectiles created based on cooldown)
- Test enemy collision with player (player HP reduced)
- Test different enemy types have different behaviors
- Test inactive enemies skipped

### Task 9: Test `systems/weapons.js` — Player weapons
- Test autocannon firing (cooldown, damage, spread)
- Test plasma weapon firing (when unlocked)
- Test missile firing (when unlocked, homing)
- Test point defense system (when unlocked)
- Test cooldown management

### Task 10: Test `systems/pickups.js` — Scrap magnet
- Test magnet attraction (pickups move toward player when in range)
- Test pickup collection (scrap added when player close enough)
- Test collected pickups removed from pool

### Task 11: Test `systems/particles.js` and `systems/effects.js` — Visual effects
- Test particle lifecycle (position updates, life decreases, deactivation)
- Test effect lifecycle
- Test inactive particles/effects skipped

### Task 12: Test `systems/cleanup.js` — Entity cleanup
- Test dead entities removed after cleanup interval
- Test cleanup timer accumulation
- Test cleanup only runs periodically (not every frame)

### Task 13: Test `systems/mission.js` — Mission logic
- Test mission completion detection for each type:
  - Kill: current kills >= target
  - Collect: current scrap >= target
  - Survive: totalTime >= target
  - Escort: drone reaches destination
- Test `checkMissionProgress()` updates mission.current
- Test `createCompleteMission()` creates completion effect
- Test transition timer countdown and callbacks

### Task 14: Test `systems/escort.js` — Escort drone
- Test escort movement toward destination
- Test escort evasion behavior when threatened
- Test escort collision handling
- Test escort respawn mechanics
- Test escort mission progress tracking

### Task 15: Test `constants/gameConfig.js` and `constants/upgrades.js` — Configuration validation
- Test GAME_CONFIG has all required sections
- Test all numeric values are positive
- Test UPGRADE_DATA has all 9 upgrade types
- Test each upgrade has required fields (name, description, baseCost, costMult, maxLevel)
- Test cost scaling produces reasonable values

### Task 16: Integration tests — Full physics step
- Test `updatePhysics()` runs a full frame without errors
- Test a simple kill mission can be completed:
  - Create state, enter mission, simulate frames, verify completion
- Test player death (HP reaches 0) triggers game over state
- Test scrap collection flows through the system

## Execution Order
Tasks 1-5 are independent foundation. Tasks 6-14 can run in parallel. Task 15 is quick validation. Task 16 is final integration.
