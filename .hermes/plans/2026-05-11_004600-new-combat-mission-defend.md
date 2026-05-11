# Plan: New Combat Mission Type — "Defend"

## Goal

Add a new mission type `defend` to Space Sentinel. The player must protect a stationary **Beacon** structure from enemy attacks for a set duration. If the Beacon's HP reaches zero, the mission fails. If the timer expires with the Beacon alive, the mission completes.

## Why "Defend"

The existing mission types cover kill quotas, scrap collection, pure survival, and mobile escort. "Defend" fills a gap: a stationary objective-defense mission that introduces a new entity (Beacon) with its own HP, collision, and failure conditions — similar in spirit to escort but with different tactical dynamics (area denial, positioning, wave management).

## Current Architecture (relevant files)

| File | Role |
|------|------|
| `src/engine/spawner.js` | `generateMission()` — defines mission types |
| `src/engine/missionSetup.js` | `setupCombatMission()`, `enterNodeMission()` — per-mission init |
| `src/engine/systems/mission.js` | `checkMissionProgress()`, `createCompleteMission()` — completion logic |
| `src/engine/systems/enemies.js` | Enemy AI, death tracking, mission progress |
| `src/engine/physics.js` | Main game loop orchestrator |
| `src/engine/state.js` | `createGameState()` — state contract & defaults |
| `src/engine/escortSetup.js` | Escort init/reset pattern (reference for Beacon setup) |
| `src/engine/systems/escort.js` | Escort system (reference for Beacon system) |
| `src/engine/renderer3d.js` | Three.js rendering of entities |
| `src/engine/renderer2d.js` | HUD: mission bar, HP bars, radar |
| `src/constants/gameConfig.js` | All magic numbers |
| `src/components/DevMissionPicker.jsx` | Dev mode mission selector UI |
| `src/engine/mapGenerator.js` | Map node type assignment |
| `AGENTS.md` | Architecture documentation |

## Proposed Approach

Follow the established pattern used by the `escort` mission type:

1. **New mission type in spawner** — add `defend` to `generateMission()`
2. **New setup module** — `beaconSetup.js` (mirrors `escortSetup.js`)
3. **New system module** — `systems/beacon.js` (mirrors `systems/escort.js`)
4. **Wire into physics loop** — add beacon update call in `physics.js`
5. **Wire into mission setup** — add beacon init in `missionSetup.js`
6. **Add state defaults** — add `beacon` object to `state.js`
7. **Add config** — beacon params in `gameConfig.js`
8. **Render 3D** — Beacon mesh in `renderer3d.js`
9. **Render 2D HUD** — Beacon HP bar, radar dot in `renderer2d.js`
10. **Mission completion** — timer-based completion + beacon death = gameover
11. **Dev picker** — add Defend card to `DevMissionPicker.jsx`
12. **Map integration** — add `defend` node type to map generator
13. **Update docs** — update `AGENTS.md`

## Step-by-Step Plan

### Step 1: Add `defend` to `generateMission()` in `spawner.js`

- Add `defend` case alongside existing mission types
- Mission config: `target` = duration in seconds (e.g., `30 + level * 10`), `current` starts at 0
- Title: `"Defend the Beacon for ${target} Seconds"`
- Reward: `100 + level * 30`
- Return early (like escort/boss do) since it's timer-based, not kill-based

### Step 2: Create `src/engine/beaconSetup.js`

Mirror `escortSetup.js` pattern:

```
setupBeacon(g, level)  — Initialize beacon at a random position, set HP/lives, store duration
resetBeacon(g)         — Deactivate beacon (called for non-defend missions)
```

Beacon state shape (in `g.beacon`):
```js
{
  active: false,
  x: 0, y: 0,
  hp: 0, maxHp: 0,
  radius: 30,
  color: 0x22d3ee,
  defenseRadius: 200,  // enemies prioritize beacon within this range
}
```

### Step 3: Create `src/engine/systems/beacon.js`

Mirror `systems/escort.js` pattern:

```js
export const updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)
```

Logic:
- If beacon inactive or mission completed, return false
- **Enemy projectiles hitting beacon**: check all enemy projectiles against beacon position. On hit, reduce beacon HP, spawn particles, show damage number. If beacon HP <= 0: destroy beacon, trigger gameover.
- **Enemies ramming beacon**: same collision check as escort. Beacon death = gameover.
- **Enemies target beacon**: enemies within `defenseRadius` of beacon aim/fire at beacon instead of player (similar to escort targeting logic in `escort.js`).
- **Timer progress**: increment `g.mission.current` by `dt` each frame. When `current >= target`, call `completeMission()`.
- Return `true` if gameover triggered, `false` otherwise.

### Step 4: Wire beacon into `physics.js`

- Import `updateBeacon` from `./systems/beacon`
- Add call after escort update (or replace escort when mission is defend type):
  ```js
  if (updateBeacon(dt, g, currentDiffMult, completeMission, setGameState)) return;
  ```

### Step 5: Wire beacon into `missionSetup.js`

- Import `setupBeacon`, `resetBeacon` from `./beaconSetup`
- In `setupCombatMission()`, add beacon init alongside escort:
  ```js
  if (mission.type === 'escort') {
    setupEscort(g, level);
    resetBeacon(g);
  } else if (mission.type === 'defend') {
    setupBeacon(g, level);
    resetEscort(g);
  } else {
    resetEscort(g);
    resetBeacon(g);
  }
  ```

### Step 6: Add beacon state to `state.js`

- Add `beacon` property to `createGameState()` return object
- Add `createDefaultBeacon()` helper (like `createDefaultEscort()`)
- Update `GameState` typedef to include beacon fields and `defend` mission type

### Step 7: Add beacon config to `gameConfig.js`

Add `beacon` section:
```js
beacon: {
  baseHp: 200,
  hpPerLevel: 50,
  spawnSpread: 400,      // distance from player
  radius: 30,
  defenseRadius: 250,    // enemies target beacon within this range
  color: 0x22d3ee,
}
```

### Step 8: Render Beacon in 3D (`renderer3d.js`)

- Add beacon rendering in `draw3DFrame()` alongside escort drone rendering
- Use `geoms.box` or `geoms.tetra` with a cyan wireframe material
- Position at `g.beacon.x`, `g.beacon.y` when `g.beacon.active`
- Add shield ring effect around beacon (similar to player shield rendering)

### Step 9: Render Beacon in 2D HUD (`renderer2d.js`)

- Add beacon HP bar above beacon (world-to-screen projected)
- Add beacon dot on tactical radar (cyan, like escort drone)
- Update mission bar text for defend type (show remaining time)

### Step 10: Mission completion for defend type

- In `systems/mission.js`, `checkMissionProgress()` already handles `survive` type by timer. Extend it to also handle `defend` type the same way (increment current by dt, complete when >= target).
- Alternatively, handle the timer inside `updateBeacon()` directly (simpler, keeps it self-contained).

### Step 11: Add Defend to Dev Mission Picker (`DevMissionPicker.jsx`)

- Add `{ id: 'defend', label: 'Defend', icon: Shield, color: 'teal', desc: 'Protect a beacon from enemies' }` to `MISSION_TYPES`
- Add teal color to `COLOR_MAP`
- Add `'defend'` to `nodeTypeMap` in `App.jsx` `launchDevMission()`

### Step 12: Add defend nodes to map generator (`mapGenerator.js`)

- In the node type assignment loop, add `defend` as a possible combat node type
- Probability: ~10% of combat nodes become defend missions (adjust for balance)
- Place defend nodes at rows 2-6 (mid-sector, not too early or late)

### Step 13: Update `AGENTS.md`

- Document the new `beaconSetup.js`, `systems/beacon.js` files
- Update mission type list to include `defend`
- Document beacon state shape and config

## Files That Will Change

| File | Action |
|------|--------|
| `src/engine/spawner.js` | Edit — add defend mission type |
| `src/engine/beaconSetup.js` | **Create** — beacon init/reset |
| `src/engine/systems/beacon.js` | **Create** — beacon system |
| `src/engine/physics.js` | Edit — wire beacon update |
| `src/engine/missionSetup.js` | Edit — wire beacon setup |
| `src/engine/state.js` | Edit — add beacon state |
| `src/constants/gameConfig.js` | Edit — add beacon config |
| `src/engine/renderer3d.js` | Edit — render beacon |
| `src/engine/renderer2d.js` | Edit — HUD beacon HP + radar |
| `src/engine/systems/mission.js` | Edit — defend timer completion |
| `src/components/DevMissionPicker.jsx` | Edit — add defend card |
| `src/App.jsx` | Edit — add defend to nodeTypeMap |
| `src/engine/mapGenerator.js` | Edit — add defend node type |
| `AGENTS.md` | Edit — document new files |

## Validation / Testing

1. **Dev mode test**: Launch defend mission from DevMissionPicker at levels 1, 5, 10, 20
2. **Verify**: Beacon appears, has HP bar, enemies target it
3. **Verify**: Beacon death triggers gameover
4. **Verify**: Surviving the timer completes the mission with scrap reward
5. **Verify**: HUD shows correct mission progress (time remaining)
6. **Map test**: Play through a full sector, verify defend nodes appear and work
7. **Verify**: Non-defend missions don't show beacon (resetBeacon works)

## Risks and Tradeoffs

- **Spawn rate during defend**: Enemies should spawn faster during defend missions to create pressure. May need to adjust spawn rate in `physics.js` based on mission type.
- **Beacon positioning**: If beacon spawns too close to player, it's trivial. Too far, player can't defend it. Need to tune `spawnSpread` relative to player speed.
- **Balance**: Defend missions are inherently harder than survive (you have to protect something). Reward should reflect that.
- **No new dependencies**: All changes are internal to the existing architecture. No new npm packages needed.

## Open Questions

1. Should the beacon have lives/respawn like the escort drone, or is it a single-HP-pool structure? (Plan assumes single HP pool — simpler, more dramatic)
2. Should defend missions appear on the sector map, or only in dev mode? (Plan includes both)
3. Should enemies spawn at a higher rate during defend missions? (Recommended: yes, 1.5x spawn rate)
