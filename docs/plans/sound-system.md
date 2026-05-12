# Sound System for Space Sentinel

## Overview
Add procedural audio (Web Audio API, zero external deps) for SFX and background music. All sounds generated programmatically — no audio files to bundle.

## Architecture
- `src/engine/audio.js` — SoundManager singleton (init, play, stop, mute, volume, background drone)
- `src/engine/systems/audio.js` — Per-frame audio events triggered by game state changes
- Wired into `physics.js` game loop
- Mute toggle in HUD (top-right button)
- Sound state stored in game state (`g.audio`)

## Design Decisions
- **Procedural audio only** — Web Audio API oscillators/noise. No .wav/.ogg files. Keeps bundle small, no CORS issues on GitHub Pages.
- **Singleton SoundManager** — One AudioContext, lazily created on first user interaction (browser policy).
- **Event-driven** — Systems call `SoundManager.play('shoot')` when events happen. Per-frame audio system polls for recurring sounds (engine hum, background drone).
- **Mute toggle** — Button in HUD top-right. Persists in game state.

## Sound Palette
| Sound | Trigger | Description |
|-------|---------|-------------|
| `shoot` | Player fires autocannon | Short high-pitch pulse |
| `shoot_plasma` | Player fires plasma | Low rumble burst |
| `shoot_missile` | Player fires missile | Whoosh sweep |
| `hit` | Projectile hits enemy | Crack/pop |
| `explosion` | Enemy destroyed | Noise burst decay |
| `pickup` | Scrap collected | High ding |
| `shield_hit` | Player shielded | Buzz deflection |
| `player_hit` | Player hull damage | Low thud |
| `mission_complete` | Mission done | Ascending chord |
| `game_over` | Player dies | Descending tone |
| `engine` | Per-frame (playing) | Low rumble drone |
| `bg_drone` | Per-frame (playing) | Ambient space hum |
| `ui_click` | Button press | Short blip |

## Tasks

### Task 1: Create SoundManager module
**File:** `src/engine/audio.js`

Create a SoundManager class with:
- `init()` — Creates AudioContext on first call (lazy init for browser autoplay policy)
- `play(name)` — Plays a sound by name using oscillators/noise buffers
- `stop(name)` — Stops a specific sound (for continuous sounds like engine/bg_drone)
- `setMuted(bool)` / `isMuted()` — Mute toggle
- `setVolume(0-1)` — Master volume
- Sound definitions for all 13 sounds above using Web Audio API (oscillators + noise)
- Export as singleton `const SoundManager = new SoundManagerClass();`

**Key constraints:**
- No external dependencies
- AudioContext must be created lazily (first `play()` or explicit `init()`)
- Each sound uses `gainNode` for envelope (attack/decay)
- Noise sounds use `AudioBuffer` with white/pink noise
- Continuous sounds (`engine`, `bg_drone`) use looping oscillators that can be stopped

**Tests:** `src/engine/__tests__/audio.test.js`
- SoundManager init creates AudioContext
- play() with valid name does not throw
- setMuted() toggles mute state
- setVolume() clamps 0-1
- stop() on continuous sound stops it

### Task 2: Add audio state to game state
**Files:** `src/engine/state.js`, `src/engine/audio.js`

Add `audio` property to GameState:
```js
audio: { muted: false, volume: 0.5 }
```

Wire SoundManager to read from game state. In `resetGame()` and `createGameState()`, audio state is initialized.

**Tests:** `src/engine/__tests__/state-audio.test.js`
- createGameState() includes audio property
- audio defaults to `{ muted: false, volume: 0.5 }`

### Task 3: Create per-frame audio system
**File:** `src/engine/systems/audio.js`

Create `updateAudio(dt, g)` that:
- Checks `g.audio.muted` and skips if true
- Triggers `engine` sound when playing (continuous, started once)
- Triggers `bg_drone` sound when playing (continuous, started once)
- Detects new explosions (enemies that just died) and plays `explosion`
- Detects new pickups collected and plays `pickup`
- Detects player hits and plays `player_hit` or `shield_hit`
- Exports `updateAudio(dt, g)`

**Key:** Must track previous frame state to detect *events* (not just conditions). Use a simple `_prev` object inside the module or on `g.audio._prev`.

**Tests:** `src/engine/__tests__/audio-system.test.js`
- updateAudio does not throw
- Respects muted flag
- Plays sounds on state transitions

### Task 4: Wire audio system into physics loop
**File:** `src/engine/physics.js`

Import and call `updateAudio(dt, g)` in the game loop, after player movement but before cleanup.

### Task 5: Add weapon fire sounds to weapons system
**File:** `src/engine/systems/weapons.js`

Import SoundManager and add play calls:
- `shoot` when autocannon fires
- `shoot_plasma` when plasma fires
- `shoot_missile` when missile fires
- `hit` when projectile hits enemy (in `projectiles.js`)
- `shield_hit` / `player_hit` when enemy hits player (in `enemies.js`)

**Files to modify:** `src/engine/systems/weapons.js`, `src/engine/systems/projectiles.js`, `src/engine/systems/enemies.js`

### Task 6: Add HUD mute toggle button
**File:** `src/engine/renderer2d.js`

Add a mute/unmute button in the top-right corner of the HUD:
- Speaker icon (drawn with canvas paths)
- Muted: speaker with X through it
- Click detection via checking mouse position against button rect
- Toggle `g.audio.muted` and call `SoundManager.setMuted()`

**File:** `src/hooks/useInput.jsx` or `src/App.jsx`
- Wire button click to toggle mute state

### Task 7: Add mission event sounds
**File:** `src/engine/systems/mission.js`

Add SoundManager.play calls for:
- `mission_complete` when mission completes
- `game_over` when player dies

### Task 8: Integration tests and verification
Run full test suite and verify:
- All tests pass: `npm test -- --run`
- Build succeeds: `npm run build`
- No console errors in dev mode

## Task Dependencies
- Task 1 (SoundManager) must complete first
- Task 2 (state) depends on Task 1
- Task 3 (audio system) depends on Tasks 1 + 2
- Task 4 (wire into physics) depends on Task 3
- Task 5 (weapon sounds) depends on Task 1
- Task 6 (HUD button) depends on Task 1 + 2
- Task 7 (mission sounds) depends on Task 1
- Task 8 (tests) depends on all above

Tasks 5, 6, 7 can run in parallel after Task 1.
Tasks 3, 4 should run sequentially.
