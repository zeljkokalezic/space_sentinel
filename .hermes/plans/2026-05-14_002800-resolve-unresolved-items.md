# Plan: Resolve Unresolved Items — Space Sentinel

## Goal
Address the three unresolved items from previous sessions:
1. **Defend mission (beacon) — no test coverage**
2. **Save/Load system — no test coverage + physics test stderr**
3. **Pause Overlay — shallow tests, no React component tests**

Secondary gap: **SettingsOverlay.jsx — no tests**

## Current State

| Module | Exists | Tests | Coverage |
|--------|--------|-------|----------|
| `beaconSetup.js` | ✓ | ✗ | 0% |
| `systems/beacon.js` | ✓ | ✗ | 0% |
| `saveManager.js` | ✓ | ✗ | 0% |
| `PauseOverlay.jsx` | ✓ | `pause.test.js` (22 tests) | Shallow — state toggle only |
| `SettingsOverlay.jsx` | ✓ | ✗ | 0% |
| `audio.test.js` | ✓ | 68 tests | Good |
| `systems/audio.test.js` | ✓ | 42 tests | Good |

Test suite: **818 tests pass** across 25 files. Physics test shows stderr `Failed to save game` because `saveManager.js` calls `localStorage` which doesn't exist in the Node test environment.

## Approach

### Phase 1: Mock localStorage in test helpers
The `saveManager.js` uses `localStorage` extensively. Physics tests call `autoSave()` on mission completion, which fails silently in Node. Need to mock it.

**Files to change:**
- `src/tests/helpers.js` — Add `setupLocalStorageMock()` and `clearLocalStorageMock()` utilities

### Phase 2: Beacon (Defend Mission) Tests
Two test files needed, following the pattern of `sabotageSetup.test.js` (152 lines) and `systems/sabotage.test.js`.

**File: `src/tests/beaconSetup.test.js`** (~120-150 tests)
- `setupBeacon()` — beacon active, HP calculation (base + level * perLevel), position offset from player, radius
- `resetBeacon()` — clears active, HP, maxHp
- Edge cases: level 1 vs level 25 HP scaling

**File: `src/tests/systems/beacon.test.js`** (~80-100 tests)
- Early return: inactive beacon, completed mission
- Enemy projectile collision: damage calculation (10 * diffMult), particle spawn, effect spawn
- Enemy ramming: cooldown behavior, mutual damage (beacon -15, enemy -20)
- Beacon destroyed: HP <= 0 triggers gameover, explosion particles
- Enemy targeting: within defenseRadius targets beacon, outside targets player
- Integration: full tick with multiple enemies + projectiles

### Phase 3: Save/Load Tests
**File: `src/tests/saveManager.test.js`** (~100-120 tests)
- `createSaveData()` — all fields serialized correctly, achievements Set → array
- `saveGame()` / `loadGame()` — roundtrip with localStorage mock
- `applySaveData()` — player stats, scrap, level, upgrades merge, map restore
- `hasSave()` / `deleteSave()` — existence check and cleanup
- `getSaveInfo()` — returns partial info without full load
- `autoSave()` / `loadAutoSave()` — auto slot behavior
- Edge cases: corrupted JSON, missing fields, empty state

### Phase 4: Fix Physics Test Stderr
After localStorage mock is in helpers, update physics tests to use it so the `Failed to save game` stderr disappears.

**File: `src/tests/physics.test.js`** — Add `beforeEach`/`afterEach` for localStorage mock

### Phase 5: Pause Overlay — Deeper Tests
The existing `pause.test.js` tests state toggling. Add tests that verify the actual game loop behavior through `useGameLoop` patterns.

**File: `src/tests/pause.test.js`** — Add ~10 tests:
- `updatePhysics` skipped when paused (import real physics, verify no state mutation)
- Resume after pause restores normal tick
- Pause during combat preserves exact state (positions, HP, arrays)

### Phase 6: SettingsOverlay Tests (lower priority)
**File: `src/tests/settingsOverlay.test.js`** (~40-60 tests)
- Settings persistence (localStorage)
- Volume sliders: master, SFX, music
- Difficulty selection
- Display toggles: particles, FPS, shake
- Accessibility: colorblind, reduced motion, contrast

## Files Summary

| Action | File | Est. Lines |
|--------|------|------------|
| Modify | `src/tests/helpers.js` | +30 |
| Create | `src/tests/beaconSetup.test.js` | ~150 |
| Create | `src/tests/systems/beacon.test.js` | ~100 |
| Create | `src/tests/saveManager.test.js` | ~120 |
| Modify | `src/tests/physics.test.js` | +10 |
| Modify | `src/tests/pause.test.js` | +30 |
| Create | `src/tests/settingsOverlay.test.js` | ~60 |

**Net new tests: ~500** (818 → ~1300)

## Validation
```bash
npm test -- --run          # All tests pass, no stderr
npm run build              # Production build succeeds
```

## Risks
- **localStorage mock scope** — Need to ensure mock is isolated per test file. Use `beforeEach`/`afterEach` pattern.
- **SettingsOverlay imports React** — Testing React components requires `@testing-library/react` or similar. If not installed, skip component rendering tests and test the localStorage persistence logic directly.
- **Beacon system imports `createParticles` from `combat.js`** — Ensure test state has `g.particles` array initialized.

## Open Questions
- Should we install `@testing-library/react` for component tests, or stick with unit tests only? Current test suite has zero React component tests — all are engine-level.
