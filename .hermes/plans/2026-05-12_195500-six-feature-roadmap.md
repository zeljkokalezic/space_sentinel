# Space Sentinel: Six-Feature Roadmap

> Plan generated using `space-sentinel-planning` skill conventions.

## Overview
Six quality-of-life + content features to enhance Space Sentinel. Ordered by dependency (foundational first, additive later). Each follows project conventions: no React in engine/, explicit params, delta time in seconds, Vitest tests, build validation.

---

## Feature 1: Pause Menu
**Why first:** Foundation feature. Every other feature benefits from a working pause state.

### Scope
- ESC key toggles pause overlay
- Pauses game loop (stops rAF, resumes on unpause)
- Overlay shows: Resume, Restart, Mute toggle (reuse existing audio muted state)
- Blocks input while paused

### Files
| File | Action |
|------|--------|
| `src/engine/state.js` | Add `paused: false` to game state + JSDoc |
| `src/hooks/useGameLoop.jsx` | Add pause check before `updatePhysics`/`drawFrame` |
| `src/hooks/useInput.jsx` | Add ESC key handler that toggles `g.paused` |
| `src/components/PauseOverlay.jsx` | New component: resume/restart/mute buttons |
| `src/App.jsx` | Wire pause state to PauseOverlay visibility |
| `src/tests/pause.test.js` | Pause toggle, input blocked, resume restores state |
| `AGENTS.md` | Document pause behavior |

### Validation
- `npm test -- --run` passes
- `npm run build` succeeds
- ESC pauses, ESC resumes, restart resets to start screen

---

## Feature 2: Procedural Soundtrack
**Why second:** Audio system already exists (13 sounds). This enhances it before other features add more audio needs.

### Scope
- Replace flat `bg_drone` with reactive generative music
- 3 intensity layers: calm (exploration), tense (combat), triumphant (mission complete)
- Intensity derived from: enemy count, player HP%, mission timer proximity
- All procedural via Web Audio API (oscillators + filters + LFOs)
- Respects existing mute/volume settings

### Files
| File | Action |
|------|--------|
| `src/engine/audio.js` | Add `SoundtrackManager` class with 3 intensity layers + crossfade |
| `src/engine/systems/audio.js` | Add intensity detection logic (enemy count, HP%, timer) |
| `src/tests/audio.test.js` | Soundtrack init, intensity transitions, mute respect |
| `AGENTS.md` | Document soundtrack system |

### Conventions
- No new state properties needed (intensity computed from existing `g` data)
- Soundtrack nodes persist across missions (only stop on mute/game over)
- Crossfade between layers over 1-2 seconds to avoid jarring transitions

### Validation
- `npm test -- --run` passes (730 + new tests)
- `npm run build` succeeds
- Music shifts intensity during combat vs calm
- Mute silences everything including soundtrack

---

## Feature 3: Ship Customization
**Why third:** Purely additive visual feature. No gameplay changes, low risk.

### Scope
- 5 ship skins unlockable from shop (default + 4 alternates)
- Each skin: hull color, accent color, engine glow color
- Purchased with scrap, one-time unlock (not consumable)
- Visual only — no stat changes
- Persistent across missions within a run

### Files
| File | Action |
|------|--------|
| `src/constants/skins.js` | New: `SHIP_SKINS` array with 5 color configs + costs |
| `src/engine/state.js` | Add `shipSkin: 0` (index) + `unlockedSkins: [true, false, ...]` |
| `src/constants/upgrades.js` | Add skin unlocks to `UPGRADE_DATA` or separate shop section |
| `src/components/ShopOverlay.jsx` | Add skin selection UI with color preview |
| `src/engine/renderer3d.js` | Read `g.shipSkin` to apply colors to player ship materials |
| `src/tests/skins.test.js` | Skin data validation, unlock persistence, render colors |
| `AGENTS.md` | Document skin system |

### Conventions
- `SHIP_SKINS` follows `UPGRADE_DATA` pattern (name, description, cost, icon)
- Default skin (index 0) always unlocked
- Color changes applied via Three.js material property updates, not mesh recreation

### Validation
- `npm test -- --run` passes
- `npm run build` succeeds
- Buy skin in shop → ship changes color immediately
- Skin persists across missions

---

## Feature 4: Achievement System
**Why fourth:** Tracks milestones from existing gameplay. No new game mechanics.

### Scope
- 10-15 achievements tracking existing actions
- Examples: "First Blood" (kill 1 enemy), "Scavenger" (collect 100 scrap), "Guardian Angel" (complete escort), "Boss Slayer" (kill sector boss), "Speed Runner" (complete mission under 10s), "Maxed Out" (max all upgrades)
- HUD notification toast on unlock (3 second fade)
- Achievement count shown on victory screen

### Files
| File | Action |
|------|--------|
| `src/constants/achievements.js` | New: `ACHIEVEMENTS_DATA` array with id, name, description, condition fn, icon |
| `src/engine/state.js` | Add `unlockedAchievements: []` (set of ids) |
| `src/engine/systems/achievements.js` | New system: check conditions each frame, trigger toast on unlock |
| `src/engine/physics.js` | Wire `updateAchievements` into loop |
| `src/engine/renderer2d.js` | Render achievement toast notification |
| `src/components/VictoryScreen.jsx` | Show achievement count + recently unlocked |
| `src/tests/achievements.test.js` | Condition checks, unlock persistence, toast timing |
| `AGENTS.md` | Document achievement system |

### Conventions
- Achievement conditions read from `g` state (no side effects)
- Toast renders in 2D HUD layer (not React overlay)
- System checks are idempotent (already unlocked = skip)

### Validation
- `npm test -- --run` passes
- `npm run build` succeeds
- Achievements unlock during normal gameplay
- Toast appears then fades after 3 seconds
- Victory screen shows achievement summary

---

## Feature 5: Enemy Wave Announcer
**Why fifth:** Simple additive feature. Builds on existing spawner + audio.

### Scope
- Visual "WAVE N" flash between enemy spawn waves
- Audio countdown beep (3-2-1-WAVE) before each wave
- 2 second announcement window before enemies spawn
- Skips during first wave (no prior wave to announce from)

### Files
| File | Action |
|------|--------|
| `src/engine/state.js` | Add `waveAnnounce: { active: false, wave: 0, timer: 0 }` |
| `src/engine/spawner.js` | Add pre-wave announcement trigger |
| `src/engine/audio.js` | Add `waveAnnounce` sound (countdown beeps + wave shout) |
| `src/engine/systems/waveAnnounce.js` | New system: countdown timer, auto-deactivate |
| `src/engine/physics.js` | Wire `updateWaveAnnounce` into loop |
| `src/engine/renderer2d.js` | Render "WAVE N" text overlay during announcement |
| `src/tests/waveAnnounce.test.js` | Timer countdown, skip first wave, text render |
| `AGENTS.md` | Document wave announcer |

### Conventions
- Announcement blocks enemy spawning until timer expires
- Text renders centered on 2D HUD with fade-in/fade-out
- Audio respects mute setting

### Validation
- `npm test -- --run` passes
- `npm run build` succeeds
- Wave 1: no announcement, enemies spawn immediately
- Wave 2+: 2 second "WAVE N" flash + countdown beeps, then spawn

---

## Feature 6: Mini-Boss Progression
**Why last:** Most complex. Adds new enemy tier + spawn logic. Depends on all other features being stable.

### Scope
- Every 3 levels, a mini-boss appears before the sector boss
- Scaled-down boss: 30-50% of full boss HP/damage, unique name/appearance
- Appears as a special map node (between regular and boss nodes)
- Reuses boss rendering patterns but with distinct color/size
- Drops bonus scrap on defeat

### Files
| File | Action |
|------|--------|
| `src/constants/gameConfig.js` | Add `miniboss` config block (hp%, damage%, spawn interval, scrap reward) |
| `src/engine/state.js` | Add `minibossDefeated: false` flag |
| `src/engine/spawner.js` | Add mini-boss spawn logic + level interval check |
| `src/engine/mapGenerator.js` | Add mini-boss node type to path generation |
| `src/engine/missionSetup.js` | Add mini-boss mission setup path |
| `src/engine/renderer3d.js` | Mini-boss 3D model (scaled boss with different color) |
| `src/engine/renderer2d.js` | Mini-boss HP bar + name label |
| `src/components/MapOverlay.jsx` | Render mini-boss nodes on sector map |
| `src/components/DevMissionPicker.jsx` | Add mini-boss to dev mission types |
| `src/tests/miniboss.test.js` | Spawn interval, HP scaling, map node placement |
| `AGENTS.md` | Document mini-boss system |

### Conventions
- Mini-boss uses same combat patterns as full boss (telegraphed attacks, phase transitions)
- Distinct from regular enemies: larger hitbox, glowing aura, named entity
- Map node uses new icon (between elite and boss in hierarchy)

### Validation
- `npm test -- --run` passes
- `npm run build` succeeds
- Mini-boss appears at levels 3, 6, 9, 12, 15
- Defeating mini-boss advances to next regular node
- Mini-boss HP scales with level but stays below full boss

---

## Implementation Order & Dependencies

```
Feature 1: Pause Menu        (foundation, no deps)
    ↓
Feature 2: Procedural Soundtrack  (enhances audio, no deps on others)
    ↓
Feature 3: Ship Customization     (visual only, low risk)
    ↓
Feature 4: Achievement System     (tracks existing + new gameplay)
    ↓
Feature 5: Wave Announcer         (simple additive)
    ↓
Feature 6: Mini-Boss              (most complex, builds on all above)
```

## Estimated Effort Per Feature
| Feature | Files | Tests | Complexity |
|---------|-------|-------|------------|
| Pause Menu | 5 | 1 | Low |
| Soundtrack | 3 | 1 | Medium |
| Ship Skins | 6 | 1 | Low |
| Achievements | 7 | 1 | Medium |
| Wave Announcer | 7 | 1 | Low |
| Mini-Boss | 11 | 1 | High |

## Global Validation (after each feature)
- [ ] `npm test -- --run` passes (all tests green)
- [ ] `npm run build` succeeds
- [ ] No React imports in `src/engine/`
- [ ] AGENTS.md updated
- [ ] Game state resets cleanly between missions
