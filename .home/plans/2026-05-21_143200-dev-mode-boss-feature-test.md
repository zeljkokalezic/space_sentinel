# Dev Mode Testing for Boss Personality System

## Goal

Verify whether the existing dev mode supports testing the new boss personality feature (unique variants, attack patterns, intro effects, audio).

## Finding: Yes, dev mode already supports it

Dev mode routes through the same code paths as normal play. No code changes required.

## How it works

1. **DevMissionPicker** offers `kill_boss` (Boss Rush) and `kill_miniboss` (Mini-Boss) mission types
2. **`launchDevMission`** (App.jsx:76-105) maps type to node type, calls `generateMission(level, nodeType)`, then `setupCombatMission(g, mission, level)`
3. **`setupCombatMission`** routes `kill_boss` -> `setupBoss(g, level)`, `kill_miniboss` -> `setupMiniboss(g, level)`
4. **Setup functions** select variant via `ROSTER[level % ROSTER.length]`, spread all properties, trigger intro effects + audio

## Variant selection by level

Full bosses cycle through 3 variants:
| Level | Variant | Geometry | Color | Phase 1 -> 2 -> 3 |
|-------|---------|----------|-------|-------------------|
| 0, 3, 6, 9, ... | Void Reaper | box | red | single_aimed -> spread_shot -> spiral_barrage |
| 1, 4, 7, 10, ... | Nexus Prime | dodecahedron | purple | double_aimed -> wide_spread -> orbiting_mines |
| 2, 5, 8, 11, ... | Phantom Warden | octahedron | cyan | single_aimed -> zigzag_spread -> homing_burst |

Mini-bosses cycle through 3 variants (same level modulo logic):
| Level | Variant | Geometry | Color | Phase 1 -> 2 -> 3 |
|-------|---------|----------|-------|-------------------|
| 0, 3, 6, 9, ... | Scout Alpha | box | orange | single_aimed -> spread_shot -> burst_ring |
| 1, 4, 7, 10, ... | Razor Wing | tetrahedron | yellow | single_aimed -> double_aimed -> spread_shot |
| 2, 5, 8, 11, ... | Iron Hull | icosahedron | gray | single_aimed -> spread_shot -> wide_spread |

## Test checklist (manual, no code changes)

### 3D rendering
- [ ] Boss Rush, level 1: red box (Void Reaper)
- [ ] Boss Rush, level 2: purple dodecahedron (Nexus Prime)
- [ ] Boss Rush, level 3: cyan octahedron (Phantom Warden)
- [ ] Mini-Boss, level 1: orange box (Scout Alpha)
- [ ] Mini-Boss, level 2: yellow tetrahedron (Razor Wing)
- [ ] Mini-Boss, level 3: gray icosahedron (Iron Hull)

### 2D HUD
- [ ] HP bar shows boss name (not generic "BOSS")
- [ ] Intro text appears: subtitle + big name on screen
- [ ] Phase indicator updates

### Audio
- [ ] `boss_spawn`: deep rumble + rising alarm on entrance
- [ ] `boss_intro`: descending minor chord on name reveal

### Attack patterns
- [ ] Phase 1: basic attack fires
- [ ] Reduce HP to phase 2: attack pattern changes (more projectiles/different spread)
- [ ] Reduce HP to phase 3: new attack pattern + spiral/homing variants
- [ ] Compare Void Reaper phase 3 (spiral) vs Phantom Warden phase 3 (homing burst)

### Death
- [ ] Boss death particles use variant-specific colors
- [ ] Guaranteed power-up drops appear
- [ ] Mission completes, returns to dev picker

### Hazards + boss combo
- [ ] Boss Rush + Asteroid hazard: asteroids spawn, boss fight works
- [ ] Boss Rush + Gravity Well: gravity affects boss/projectiles
- [ ] Boss Rush + Plasma Storm: storm damages player + enemies

## Limitation

No explicit variant selector in dev picker -- variant is determined by `level % 3`. To test a specific variant, set level accordingly. This is functional but slightly inconvenient for rapid iteration.

## Optional improvement: add variant selector

If faster iteration is desired:
- Add a variant dropdown to `DevMissionPicker.jsx` when boss/miniboss selected
- Pass `variantIndex` to `launchDevMission`, override `ROSTER[level % length]`
- Files: `DevMissionPicker.jsx`, `App.jsx`, `bossSetup.js`, `minibossSetup.js`
- Effort: ~30 lines, low risk
