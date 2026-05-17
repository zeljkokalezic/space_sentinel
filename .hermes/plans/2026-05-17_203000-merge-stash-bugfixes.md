# Merge All Stash Bugfixes Into Single Commit

## Goal

Merge all 5 local stashes into a single coherent commit, resolving overlapping changes and conflicts. The stashes contain renderer optimizations, gameplay bugfixes, config additions, and test updates.

## Current State

- **Branch:** `main` (clean working tree)
- **HEAD:** `cbc7266` fix: add player projectile collision vs mini-boss and boss
- **Stashes (5 total):**

| Stash | Message | Files | Lines |
|-------|---------|-------|-------|
| `stash@{0}` | renderer bug fixes: turret leak, laser crosstalk, raycast GC, radar labels, skin cache, LOD scale, misc cleanups | 3 | +67/-43 |
| `stash@{1}` | fix: renderer bug fixes - material cloning, LOD drift, hazard keys, GC optimizations | 2 | +106/-61 |
| `stash@{2}` | renderer bug fixes: laser material, mesh keys, skin flash, gpu leak, gc pressure, lod deadband, combo config, fps overlap, beacon ring | 2 | +59/-26 |
| `stash@{3}` | bug fixes: targeting, point defense, buffs, escort respawn, emp, cleanup, max-level guard | 13 | +65/-61 |
| `stash@{4}` | Bug fixes from codebase analysis | 19 | +102/-48 |

## Overlapping Changes (Conflicts to Resolve)

### 1. `renderer3d.js` - GC Optimization (stashes 0, 1, 2)
All three renderer stashes add reusable scratch objects for `raycastToPlane()` and `projectToScreen()`. They use different variable names:

| Object | Stash 0 | Stash 1 | Stash 2 |
|--------|---------|---------|---------|
| Raycaster | `_raycaster` | `_raycaster` | `_raycaster` |
| NDC vector | `_ndcVec` | `_rayNdc` | `_ndcVec` |
| Plane | `_plane` | `_rayPlane` | `_rayPlane` |
| Target | `_target` | `_rayTarget` | `_intersectTarget` |
| Project vec | (not in s0) | `_projVec` | `_projectVec` |

**Decision:** Use **stash 0's** naming (`_ndcVec`, `_plane`, `_target`) + stash 1's `_projVec`. Stash 0's null check (`if (!_target) return null`) is more correct than stashes 1/2 which check individual coordinates (breaks at origin 0,0,0).

### 2. `renderer3d.js` - LOD Scale (stashes 0, 1, 2)
Three different approaches:
- **Stash 0:** Store `origScale` on first LOD transition, restore from it
- **Stash 1:** Store `baseScale` at creation, compute absolute scale each frame
- **Stash 2:** Add deadband (950 vs 1000) to prevent rapid toggling

**Decision:** Combine stash 1's `baseScale` approach (most correct - no drift) + stash 2's deadband. Stash 1's approach is cleanest since it computes from a known base each frame.

### 3. `renderer3d.js` - GPU Cleanup (stashes 0, 1, 2)
Three different cleanup strategies:
- **Stash 0:** Dispose before `turretsGroup.clear()` only
- **Stash 1:** Full cleanup with shared material exclusion list (hardcoded: `mats.player`, `mats.shield`, etc.)
- **Stash 2:** Full cleanup with `sharedGeos`/`sharedMats` Sets from `initThreeScene()`

**Decision:** Use **stash 2's** approach (Set-based shared resource tracking) as it's the most robust. Also include stash 0's turret disposal before `clear()`.

### 4. `renderer3d.js` - Laser Material (stashes 0, 1, 2)
- **Stash 0:** `mats.laser.clone()` - simple clone
- **Stash 1:** Full BufferGeometry with Float32Array + clone, manual position update
- **Stash 2:** `mats.laser.clone()` - simple clone

**Decision:** Use **stash 2's** simple clone approach. Stash 1's manual buffer management is overkill and introduces a potential bug (needs `activeKeys.add(e)` which stash 1 adds but the geometry recreation pattern is fragile).

### 5. `renderer3d.js` - Skin Application (stashes 0, 2)
- **Stash 0:** Cache `pm.userData.skinIdx`, only apply when changed
- **Stash 2:** Apply skin color to newly created turret meshes immediately

**Decision:** Use **both** - stash 0's player mesh caching + stash 2's turret immediate skin application.

### 6. `renderer3d.js` - Beacon Rendering (stash 1)
Stash 1 restructures beacon from single mesh to Group with body + shield ring. This is a visual improvement, not strictly a bugfix. **Include it** since it fixes the missing visual shield ring.

### 7. `sabotageSetup.js` - Structure ID (stashes 0, 1)
- **Stash 0:** `id: i` (sequential integer)
- **Stash 1:** `id: \`sab_${i}_${Math.random().toString(36).slice(2, 8)}\`` (unique string)

**Decision:** Use **stash 1's** unique string format to avoid collisions across missions.

### 8. `enemies.js` - Targeting (stashes 3, 4)
- **Stash 3:** `const tx = e.targetX ?? g.player.x` (nullish coalesce)
- **Stash 4:** `const tx = e.targetX !== undefined ? e.targetX : g.player.x` (explicit undefined check)

**Decision:** Use **stash 3's** nullish coalesce - cleaner and functionally equivalent since targetX is never set to 0 intentionally.

### 9. `weapons.js` - Buff Multipliers (stashes 3, 4)
Both add damage/rapid-fire buff multipliers. Stash 3 also extracts `killEnemy` from inline code.

**Decision:** Use **stash 3's** version which includes the `killEnemy` extraction + buff multipliers. Stash 4's `dmgMult = 2` vs stash 3's `dmgMult = 1.5` - use stash 3's more conservative value.

### 10. `miniboss.js` - Stats (stashes 3, 4)
- **Stash 3:** Removes `g.stats.bossesDefeated++` entirely
- **Stash 4:** Changes to `g.stats.minibossesDefeated++`

**Decision:** Use **stash 4's** approach - track minibosses separately. This is more informative and stash 4 adds the stat to state.js and saveManager.js.

### 11. `renderer2d.js` - Combo Timer (stashes 0, 2)
- **Stash 0:** `C.combo.timerDuration` (imported as `C`)
- **Stash 2:** `GAME_CONFIG.combo.timerDuration` (direct reference)

**Decision:** Check what `C` is aliased to in renderer2d.js. If `C` is already imported as an alias for `GAME_CONFIG`, use stash 0's shorter form. Otherwise use stash 2's explicit form.

## Proposed Approach

### Phase 1: Apply Stashes in Order (Newest First)

Apply stashes from bottom to top to minimize conflicts:
```
git stash pop stash@{4}  # Base: config additions, new features
git stash pop stash@{3}  # Gameplay fixes
git stash pop stash@{2}  # Renderer fixes v2
git stash pop stash@{1}  # Renderer fixes v1
git stash pop stash@{0}  # Renderer fixes v0
```

### Phase 2: Resolve Conflicts Manually

For each conflicting area, apply the decision from above. The main conflict areas are:
- `src/engine/renderer3d.js` (major - 3 stashes overlap)
- `src/engine/systems/enemies.js` (stashes 3, 4)
- `src/engine/systems/weapons.js` (stashes 3, 4)
- `src/engine/sabotageSetup.js` (stashes 0, 1)
- `src/engine/renderer2d.js` (stashes 0, 2)
- `src/engine/systems/miniboss.js` (stashes 3, 4)

### Phase 3: Consolidated Implementation Steps

1. **Pop stash@{4}** - This is the foundation (config, state, new functions)
2. **Pop stash@{3}** - Gameplay fixes (targeting, buffs, escort, etc.)
3. **For renderer3d.js**, manually construct the final version combining:
   - GC scratch objects (stash 0 naming + stash 1's `_projVec`)
   - Material cloning for player hull/shield (stash 1)
   - Turret material cloning (stash 1)
   - LOD with baseScale + deadband (stash 1 + stash 2)
   - Shared resource Sets (stash 2)
   - Skin caching on player mesh (stash 0)
   - Skin application on turret creation (stash 2)
   - Turret disposal before clear (stash 0)
   - Laser material clone (stash 2)
   - Beacon group with ring (stash 1)
   - Hazard unique mesh keys (stash 1)
   - Cleanup with shared resource exclusion (stash 2)
   - Sabotage structure id (stash 1)
   - Missile scale fix (stash 0)
   - EMP opacity fix (stash 0)
4. **For renderer2d.js**, combine:
   - FPS cap (stash 0)
   - Combo timer with config (stash 0's `C.combo.timerDuration` if C exists, else stash 2)
   - roundRect fallback (stash 0)
   - Radar label fix (stash 0)
   - FPS position (stash 2)
5. **For enemies.js**, use stash 3's nullish coalesce targeting
6. **For weapons.js**, use stash 3's killEnemy extraction + buff multipliers
7. **For miniboss.js**, use stash 4's minibossesDefeated stat
8. **For sabotageSetup.js**, use stash 1's unique string id
9. **For environmentalHazards.js**, combine stash 3's EMP cooldown fix + stash 4's completeMission param

### Phase 4: Verification

```bash
npm test
npm run build
```

## Files to Change (Consolidated)

| File | Changes From | Priority |
|------|-------------|----------|
| `src/engine/renderer3d.js` | s0, s1, s2 (merged) | Critical - all 3 overlap |
| `src/engine/renderer2d.js` | s0, s2 (merged) | High |
| `src/engine/systems/enemies.js` | s3 (preferred over s4) | High |
| `src/engine/systems/weapons.js` | s3 (preferred over s4) | High |
| `src/engine/systems/miniboss.js` | s4 (preferred over s3) | Medium |
| `src/engine/systems/boss.js` | s3 + s4 | Medium |
| `src/engine/systems/cleanup.js` | s3 | Low |
| `src/engine/systems/escort.js` | s3 | Medium |
| `src/engine/systems/environmentalHazards.js` | s3 + s4 | High |
| `src/engine/systems/mission.js` | s3 | Medium |
| `src/engine/systems/projectiles.js` | s3 | Medium |
| `src/engine/sabotageSetup.js` | s1 (preferred over s0) | Medium |
| `src/constants/gameConfig.js` | s4 | Medium |
| `src/engine/audio.js` | s4 | Low |
| `src/engine/bossSetup.js` | s4 | Medium |
| `src/engine/mapGenerator.js` | s4 | Medium |
| `src/engine/minibossSetup.js` | s4 | Medium |
| `src/engine/physics.js` | s4 | High |
| `src/engine/saveManager.js` | s4 | Low |
| `src/engine/state.js` | s4 | Medium |
| `src/engine/systems/enemyFire.js` | s4 | Medium |
| `src/engine/systems/sabotage.js` | s4 | Low |
| `src/App.jsx` | s3 | Medium |
| `src/tests/miniboss.test.js` | s3 + s4 | Test |
| `src/tests/systems/escort.test.js` | s3 | Test |
| `src/tests/systems/mission.test.js` | s3 | Test |
| `src/tests/helpers.js` | s4 | Test |
| `src/tests/saveManager.test.js` | s4 | Test |
| `src/tests/systems/weapons.test.js` | s4 | Test |

## Proposed Commit Message

```
fix: merge stash bugfixes - renderer optimization, gameplay fixes, config

Renderer (renderer3d.js):
- GC optimization: reusable raycaster/vectors (eliminates per-frame allocations)
- GPU memory cleanup: dispose geometries/materials with shared resource tracking
- Skin caching: only apply colors when skin index changes
- LOD scale: absolute scale from baseScale prevents drift; deadband prevents flicker
- Material cloning: player hull/shield/turrets use cloned materials
- Laser effects: clone laser material per effect to prevent crosstalk
- Beacon: group mesh with shield ring visual
- Hazard mesh keys: unique suffixes prevent cache collisions
- Turret disposal: cleanup before clear() prevents GPU leak

Renderer (renderer2d.js):
- FPS cap: prevent calculation overflow
- Combo timer: use config constant instead of hardcoded value
- roundRect: fallback for browsers without support
- Radar labels: separate from clip area
- FPS display: repositioned to bottom-left

Gameplay:
- Enemy targeting: respect targetX/targetY for beacon/sabotage missions
- Buff multipliers: damageSurge (1.5x) and rapidFire (0.5x cooldown) on all weapons
- timeSlow: halve enemy movement speed
- Point defense: extract killEnemy() to combat.js, apply buff multipliers
- Escort: reposition near player on death, add window guard for SSR
- EMP: reset cooldown on re-entry to prevent exploit
- Max-level guard: prevent buying past max upgrade level
- Miniboss stats: separate minibossesDefeated from bossesDefeated
- Cleanup: remove redundant !active checks in spatial culling
- Mission: clear mission object after transition

Config:
- Enemy weapons: extract shooter/missile_boat params to GAME_CONFIG
- Soundtrack: register calm/tense/triumphant generators
- Boss/miniboss: initialize shield fields
- Map: guarantee at least one event node; fix miniboss fallback
- Physics: pass completeMission to environmental hazards
- Plasma storm: use config duration, track enemy kills toward mission
- Particle colors: use hex numbers consistently
```

## Risks and Tradeoffs

1. **renderer3d.js is the biggest risk** - 3 stashes with overlapping changes. Manual merge required.
2. **Buff multiplier values differ** between stashes (s3: 1.5x dmg / 0.5x cd, s4: 2x dmg / 0.5x cd). Using s3's more conservative values.
3. **killEnemy extraction** (stash 3) requires `combat.js` to export it - verify it exists from stash 4's changes.
4. **Stash 4 adds `enemyFire.js`** changes referencing `C.enemyWeapons` - verify GAME_CONFIG structure matches.

## Execution Order

1. Pop stash@{4} (foundation)
2. Pop stash@{3} (gameplay fixes)
3. Manually merge renderer3d.js from stashes 0, 1, 2
4. Manually merge renderer2d.js from stashes 0, 2
5. Resolve remaining file conflicts
6. Run `npm test` and `npm run build`
7. Commit with message above
8. Verify `git stash list` is empty
