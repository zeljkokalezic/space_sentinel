# Sabotage Mission Type

## Goal
Add a new combat mission type: **sabotage**. Player must destroy N enemy structures (turrets) scattered across the map. Structures fire back at the player and have their own HP pool. Enemies spawn normally and tend to protect nearby structures.

## Why Sabotage
Fills a gap in the current mission set:
- **kill** — kill enemies (offensive, target = enemies)
- **collect** — gather scrap (passive/evasive)
- **survive** — wait out timer (defensive)
- **escort** — protect moving ally (defensive + movement)
- **defend** — protect static beacon (defensive + stationary)
- **sabotage** — destroy static targets (offensive + positional, player must approach dangerous zones)

Key difference from defend: player is the aggressor, must actively seek out and destroy structures under fire. Structures are not allies — they're hostile objectives.

## Design

### Structure (Turret) Properties
- Stationary objects placed at random positions in a ring around spawn (similar to enemy spawn radius)
- Each has HP pool scaling with level
- Fires projectiles at the player at a fixed cooldown
- Destroyed when HP reaches 0 — spawns explosion particles + scrap pickup
- Visual: octagonal wireframe (distinct from beacon tetrahedron and escort drone), color: `0xf97316` (orange/amber)
- Radar marker: square (distinct from escort circle and beacon diamond)

### Mission Parameters
- Target: number of structures to destroy = `3 + Math.floor(level / 2)` (capped at 8)
- Mission progress: `current` = structures destroyed, `target` = total structures
- Reward: `120 + level * 35` (comparable to escort)
- Timer: optional soft limit, mission fails if all structures not destroyed within `target * 4` seconds — but this is secondary; primary failure is player death

### Structure Behavior
- HP: `80 + level * 25` per structure
- Fire cooldown: `2.5s` (slower than enemies, but consistent pressure)
- Projectile damage: `15 * diffMult`
- Projectile speed: `300` (slower than enemy fire, gives player time to react)
- Radius: `25` (similar to heavy enemy)
- Enemy AI bias: enemies within `350px` of a structure target it as their primary focus (similar to beacon defense radius logic in `beacon.js`)

## Proposed Approach

Follow the established pattern from escort and beacon:

### 1. Game Config — `src/constants/gameConfig.js`
Add `sabotage` block:
```js
sabotage: {
  structuresPerMission: 3,        // base, scales with level
  structuresPer2Levels: 1,       // +1 every 2 levels
  maxStructures: 8,
  structureHp: 80,
  hpPerLevel: 25,
  structureRadius: 25,
  fireCooldown: 2.5,
  projectileDamage: 15,
  projectileSpeed: 300,
  spawnSpread: 600,              // min distance from player
  spawnMax: 1200,               // max distance from player
  protectRadius: 350,           // enemies within this range target structures
  color: 0xf97316,
}
```

### 2. State — `src/engine/state.js`
Add `sabotage` array to game state:
```js
sabotage: createDefaultSabotage(),
```
With factory:
```js
export const createDefaultSabotage = () => ({
  active: false,
  structures: [],  // array of { x, y, hp, maxHp, radius, fireCooldown, active }
});
```
Update `@typedef` comment to include sabotage state.

### 3. Setup Module — `src/engine/sabotageSetup.js` (NEW)
- `setupSabotage(g, level)` — spawn N structures at random positions, set `g.sabotage.active = true`
- `resetSabotage(g)` — clear structures, set `active = false`

### 4. System — `src/engine/systems/sabotage.js` (NEW)
Pattern follows `beacon.js`:
- `updateSabotage(dt, g, currentDiffMult, completeMission, setGameState)` — returns boolean (true if game should stop)
- Each tick:
  - Structure AI: fire at player if cooldown expired
  - Player projectile collision with structures (check in projectiles or here)
  - Enemy targeting bias: enemies near structures aim at structures
  - Check if all structures destroyed → `completeMission()`
  - Structure destroyed → particles + scrap pickup

### 5. Physics Loop — `src/engine/physics.js`
- Import `updateSabotage`
- Call after beacon check: `if (updateSabotage(dt, g, currentDiffMult, completeMission, setGameState)) return;`

### 6. Mission Setup — `src/engine/missionSetup.js`
- Import setup/reset functions
- Add `sabotage` case in `setupCombatMission`:
  ```js
  } else if (mission.type === 'sabotage') {
    setupSabotage(g, level);
    resetEscort(g);
    resetBeacon(g);
  }
  ```
- In default else branch, also call `resetSabotage(g)`

### 7. Spawner — `src/engine/spawner.js`
- Add `'sabotage'` to the explicit type check list
- Add `'sabotage'` to the random type pool
- Add sabotage mission generation:
  ```js
  if (t === 'sabotage') {
    const structures = 3 + Math.floor(level / 2);
    target = Math.min(structures, GAME_CONFIG.sabotage.maxStructures);
    title = `Destroy ${target} Enemy Structures`;
    reward = 120 + level * 35;
    return { type: t, target, current: 0, title, reward };
  }
  ```

### 8. Map Generator — `src/engine/mapGenerator.js`
- Add `'sabotage'` to node type assignment (between escort and event in the random roll chain)
- ~10% chance for sabotage nodes (similar weight to escort/defend)

### 9. Renderer 3D — `src/engine/renderer3d.js`
- Add structure rendering block (after beacon, before destination marker):
  - Octagonal wireframe mesh (use `CylinderGeometry(1, 1, 0.5, 8)` or build from BufferGeometry)
  - Position each active structure
  - Animate with slight rotation or pulse for visual feedback
- Add structure destruction explosion (particles already handled in system)

### 10. Renderer 2D — `src/engine/renderer2d.js`
- HUD mission text: add sabotage case showing `[X/Y structures destroyed]`
- Structure HP bars: project each structure to screen, draw HP bar above it
- Radar: render structures as orange squares

### 11. Dev Mission Picker — `src/components/DevMissionPicker.jsx`
- Add sabotage card to the picker (6th mission type)
- Icon: target/crosshair, color: orange/amber

### 12. Tests — `src/tests/`
- Update `mapGenerator.test.js` if it checks node type distribution
- Add `sabotageSetup.test.js` or include in existing test suite
- Update `spawner.test.js` for sabotage mission generation

## Files to Change

| File | Action |
|------|--------|
| `src/constants/gameConfig.js` | Add `sabotage` config block |
| `src/engine/state.js` | Add `sabotage` state + factory |
| `src/engine/sabotageSetup.js` | **NEW** — setup/reset |
| `src/engine/systems/sabotage.js` | **NEW** — update loop |
| `src/engine/physics.js` | Import + call `updateSabotage` |
| `src/engine/missionSetup.js` | Add sabotage case |
| `src/engine/spawner.js` | Add sabotage mission type |
| `src/engine/mapGenerator.js` | Add sabotage node type |
| `src/engine/renderer3d.js` | Render structures |
| `src/engine/renderer2d.js` | HUD + radar for structures |
| `src/components/DevMissionPicker.jsx` | Add sabotage card |
| `AGENTS.md` | Update architecture docs |
| `src/tests/spawner.test.js` | Test sabotage mission gen |
| `src/tests/mapGenerator.test.js` | Update if needed |

## Tests / Validation
1. Dev mode: select sabotage mission, verify structures spawn, can be destroyed, mission completes
2. Normal play: select sabotage node on map, verify full flow
3. Verify structures fire at player and deal damage
4. Verify enemy targeting bias toward structures
5. Verify mission completion triggers correct reward and map progression
6. Verify resetSabotage called when entering non-sabotage missions
7. Existing tests still pass (no regression)

## Risks / Tradeoffs
- **Complexity**: Structures add a new persistent entity type. Mitigated by following beacon/escort patterns exactly.
- **Performance**: Multiple structures = more collision checks. Capped at 8 structures, each with simple circle collision — negligible.
- **Balance**: Structure HP and fire rate need tuning. Start conservative, iterate.
- **Visual clarity**: Structures must be distinguishable from enemies and beacons. Octagonal wireframe + orange color should suffice.

## Open Questions
- Should structures drop bonus scrap when destroyed (beyond mission reward)? Probably yes — 10-20 scrap each.
- Should there be a time limit, or is player death the only failure? Keep it simple: no hard timer, player death = failure.
- Should structures have different types (heavy turret, rapid fire, etc.)? Not for v1 — keep uniform, can add variety later.
