# Space Sentinel — Boss Fights, Power-Ups, and Combo System

## Goal

Add three interconnected systems to make combat more dynamic and rewarding:
1. **Boss fights** with multi-phase AI, unique abilities, and attack patterns
2. **Mid-mission power-ups** that drop from enemies/events with temporary buffs
3. **Combo/kill streak system** that rewards chain kills with escalating bonuses

These three systems reinforce each other: combos feel better during boss fights, power-ups help you survive, and bosses drop rare power-ups.

## Current Context

- 932 tests passing, build succeeding
- 6 mission types: kill, collect, survive, escort, defend, sabotage (+ kill_boss, kill_elite)
- 6 enemy types: fighter, interceptor, heavy, shooter, shielded, missile_boat
- 9 upgrades, 10 events, 13 achievements
- Modular engine architecture: systems/ for physics, setup files for missions
- No React imports in engine/
- Existing boss: just a kill counter (kill_boss type in spawner.js), no unique behavior

## Proposed Approach

### 1. Boss Fights (`engine/boss.js` + `engine/bossSetup.js` + `systems/boss.js`)

**Boss variants** (3 types, selected by level/sector):

| Boss | Phase 1 | Phase 2 (50% HP) | Phase 3 (25% HP) |
|------|---------|-------------------|-------------------|
| **Dreadnought** | Spread shot pattern, spawns fighters | Adds homing missiles, moves faster | Enrage mode: rapid fire + charge attacks |
| **Swarm Queen** | Spawns interceptor waves, slow movement | Spawns heavy units, shield pulses | Desperation: spawns enemies constantly |
| **Void Engine** | Gravity well pulls player/projectiles | Phase-shift: brief invincibility + teleport | Reality tear: screen-wide projectile burst |

**Boss state:** `g.boss` object with active, phase, hp, maxHp, x, y, radius, color, attackPattern, spawnTimer, phaseTransitionTimer.

**Phase transitions:** Visual + audio cue (screen shake, flash, sound), brief stun window where boss is vulnerable.

**Implementation:**
- `bossSetup.js`: `setupBoss(g, level, bossType)` - initialize boss state
- `systems/boss.js`: `updateBoss(dt, g, diffMult)` - boss AI, attack patterns, phase transitions, spawning
- Wire into `physics.js` alongside other systems
- Add to `missionSetup.js` for boss mission routing
- Render in `renderer3d.js` (large unique mesh per boss type) and `renderer2d.js` (boss HP bar)

### 2. Power-Ups (`systems/powerups.js`)

**Power-up types** (spawn from enemy kills ~5% chance, guaranteed from bosses):

| Power-up | Effect | Duration | Visual |
|----------|--------|----------|--------|
| **Rapid Fire** | 2x fire rate all weapons | 10s | Yellow glow on ship |
| **Shield Boost** | Full shield + 2x regen | 15s | Blue shield pulse |
| **Damage Surge** | 1.5x all damage | 12s | Red engine trail |
| **Time Slow** | Enemies move 50% slower | 8s | Purple screen tint |
| **Nuke** | Instant kill all on-screen enemies | Instant | White flash + explosion |
| **Repair** | Heal 30% max HP | Instant | Green heal particles |

**Power-up state:** `g.powerups` array (same pattern as pickups), `g.activeBuffs` object tracking active temporary effects.

**Implementation:**
- `systems/powerups.js`: `updatePowerups(dt, g)` - pickup detection, buff application, timer management
- Add spawn logic in `systems/enemies.js` on enemy death
- Add to `renderer3d.js` (floating icons) and `renderer2d.js` (active buff indicators)
- Config in `gameConfig.js`

### 3. Combo System (integrated into existing systems)

**Mechanics:**
- Kill an enemy -> combo counter +1, combo timer starts (3s)
- Kill another before timer expires -> combo +1, timer resets
- Timer expires -> combo resets to 0
- Combo multiplier: 1x (0-4), 1.5x (5-9), 2x (10-14), 3x (15+)
- Multiplier applies to scrap value from kills
- Visual feedback: combo counter on HUD, escalating color, screen flash at milestones

**Combo state:** `g.combo` object with count, timer, multiplier, lastKillTime.

**Implementation:**
- Add to `systems/enemies.js` on enemy death (increment combo, update multiplier)
- Add to `systems/pickups.js` (apply combo multiplier to scrap value)
- Add to `renderer2d.js` (combo counter display)
- Sound cue on combo milestones (5, 10, 15+)
- Config in `gameConfig.js`

## Files to Create

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/engine/systems/boss.js` | Boss AI, attacks, phases | ~200 |
| `src/engine/systems/powerups.js` | Power-up pickup + buff management | ~100 |
| `src/engine/bossSetup.js` | Boss initialization | ~60 |

## Files to Modify

| File | Changes |
|------|---------|
| `src/engine/state.js` | Add `boss`, `powerups`, `activeBuffs`, `combo` state + JSDoc |
| `src/engine/physics.js` | Wire `updateBoss`, `updatePowerups` into game loop; add combo decay |
| `src/engine/missionSetup.js` | Route boss missions through `setupBoss` |
| `src/engine/spawner.js` | Add boss type selection in `generateMission` for kill_boss |
| `src/engine/systems/enemies.js` | Add combo increment on kill; add power-up drop chance |
| `src/engine/systems/pickups.js` | Apply combo multiplier to scrap value |
| `src/engine/systems/projectiles.js` | Apply active buff modifiers (damage surge, time slow) |
| `src/engine/systems/weapons.js` | Apply active buff modifiers (rapid fire) |
| `src/engine/renderer3d.js` | Render boss (3 unique meshes), power-ups (floating icons), buff visuals |
| `src/engine/renderer2d.js` | Boss HP bar, combo counter, active buff indicators |
| `src/constants/gameConfig.js` | Boss stats, power-up configs, combo config |
| `src/engine/audio.js` | Add boss_phase_change, powerup_pickup, combo_milestone sounds |

## Tests / Validation

| Test file | Coverage |
|-----------|----------|
| `src/tests/systems/boss.test.js` | Phase transitions, attack patterns, spawn behavior, death |
| `src/tests/systems/powerups.test.js` | All 6 power-up effects, duration expiry, stacking |
| `src/tests/systems/combo.test.js` | Counter increment, timer decay, multiplier calculation |
| `src/tests/bossSetup.test.js` | Boss init for all 3 types, level scaling |
| `src/tests/spawner.test.js` | Updated for boss type selection |

**Validation:**
- `npm test -- --run` - all tests pass
- `npm run build` - build succeeds
- Manual test: boss fight with all 3 phases, power-up drops, combo counter visible

## Risks and Tradeoffs

1. **Boss complexity** - 3 boss types with 3 phases each = 9 unique behavior sets. Risk of scope creep. Mitigation: start with Dreadnought as MVP, add others iteratively.
2. **Buff stacking** - Multiple power-ups active simultaneously needs clean timer management. Mitigation: `activeBuffs` as a map with independent timers, no stacking of same type.
3. **Performance** - Boss spawning additional enemies adds entity count. Mitigation: existing spatial culling + cleanup handles this; cap boss-spawned enemies.
4. **Balance** - Combo + power-ups could make late game trivial. Mitigation: combo timer is strict (3s), power-ups are rare (5%), buffs have clear durations.
5. **Test surface** - ~300+ new lines of logic. Mitigation: TDD approach, test each system independently before integration.

## Step-by-Step Plan

1. **Combo system** (smallest, no new files) - Add combo state, increment on kill, decay timer, multiplier in pickups, HUD display. ~4 file changes.
2. **Power-ups** - Create powerups system, add drop logic, buff application, rendering. ~8 file changes.
3. **Boss fights** - Create boss system, 3 boss types with phases, attack patterns, rendering. ~12 file changes.
4. **Integration** - Wire everything together, test interactions (boss drops power-ups, combos work during boss fights).
5. **Audio** - Add new sound effects for boss phases, power-up pickups, combo milestones.
6. **Achievements** - Add boss-specific achievements (defeat all 3 boss types, max combo, etc.).
7. **Tests** - Dedicated test files for all 3 systems.

## Open Questions

- Should boss fights have a "weak point" mechanic (target specific areas for bonus damage)?
- Should power-ups be collectible in the shop (permanent passive versions)?
- Should combo multiplier affect damage or just scrap?
- How many sectors/bosses before we need more boss variants?
