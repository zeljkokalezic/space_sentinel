# Fix Tests and Complete Test Suite

## Context
- Space Sentinel: Vite + React + Three.js game
- Test framework: Vitest (node environment, globals: true)
- Tests in `src/tests/`, engine code in `src/engine/` and `src/engine/systems/`
- Helper: `src/tests/helpers.js` exports `createTestGameState()` and `noop`
- Game state: `createGameState()` from `src/engine/state.js`
- Game config: `GAME_CONFIG` from `src/constants/gameConfig.js`
- Run tests: `npm run test:run`

## Current State
- 27 failing tests in: state.test.js (1), enemies.test.js (15), projectiles.test.js (11)
- 6 untested systems: weapons, pickups, particles, cleanup, mission, escort

## Tasks

### Phase 1: Fix Failing Tests

#### Task 1: Fix state.test.js - map objects independence test
- File: `src/tests/state.test.js`
- The test expects `map.x` and `map.y` to be independent between two game states
- Read the test, understand what's failing, fix the test to match actual behavior OR fix state.js if it's a real bug
- Verify: `npm run test:run -- src/tests/state.test.js`

#### Task 2: Fix enemies.test.js - 15 failing tests
- File: `src/tests/systems/enemies.test.js`
- Failing areas: enemy movement at player position, collision damage values, enemy death (inactive, particles, pickups), multiple enemy deaths
- Read `src/engine/systems/enemies.js` to understand actual behavior
- Fix tests to match actual implementation behavior
- Verify: `npm run test:run -- src/tests/systems/enemies.test.js`

#### Task 3: Fix projectiles.test.js - 11 failing tests
- File: `src/tests/systems/projectiles.test.js`
- Failing areas: enemy projectile hits player (HP reduction, shield absorption, particles, effects, gameover), homing missiles, radius-based collision, multiple projectiles, large dt
- Read `src/engine/systems/projectiles.js` to understand actual behavior
- Fix tests to match actual implementation behavior
- Verify: `npm run test:run -- src/tests/systems/projectiles.test.js`

### Phase 2: Add Missing System Tests

#### Task 4: Test weapons.js
- Source: `src/engine/systems/weapons.js`
- Create: `src/tests/systems/weapons.test.js`
- Test: autocannon firing, plasma firing, missile firing, point defense firing, cooldowns, damage values, auto-aim behavior
- Use TDD: write tests first, verify they work
- Verify: `npm run test:run -- src/tests/systems/weapons.test.js`

#### Task 5: Test pickups.js
- Source: `src/engine/systems/pickups.js`
- Create: `src/tests/systems/pickups.test.js`
- Test: magnet attraction, pickup collection, magnet range, scrap accumulation
- Verify: `npm run test:run -- src/tests/systems/pickups.test.js`

#### Task 6: Test particles.js
- Source: `src/engine/systems/particles.js`
- Create: `src/tests/systems/particles.test.js`
- Test: particle lifecycle (active->inactive), position updates, fade-out, effects updates
- Verify: `npm run test:run -- src/tests/systems/particles.test.js`

#### Task 7: Test cleanup.js
- Source: `src/engine/systems/cleanup.js`
- Create: `src/tests/systems/cleanup.test.js`
- Test: dead entity removal from enemies, projectiles, particles, pickups arrays
- Verify: `npm run test:run -- src/tests/systems/cleanup.test.js`

#### Task 8: Test mission.js
- Source: `src/engine/systems/mission.js`
- Create: `src/tests/systems/mission.test.js`
- Test: mission completion detection, transition timer, rewards calculation, mission progress checks for different mission types (kill, collect, survive, escort)
- Verify: `npm run test:run -- src/tests/systems/mission.test.js`

#### Task 9: Test escort.js
- Source: `src/engine/systems/escort.js`
- Create: `src/tests/systems/escort.test.js`
- Test: escort drone movement, evasion behavior, collision handling, escort health, escort death
- Verify: `npm run test:run -- src/tests/systems/escort.test.js`

### Phase 3: Final Verification

#### Task 10: Run full test suite and verify all passing
- Run: `npm run test:run`
- All tests must pass
- Report final test count and coverage summary
