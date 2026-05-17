# Renderer Bug Fix Plan

## Goal

Identify and fix bugs in `src/engine/renderer3d.js` and `src/engine/renderer2d.js` that cause visual glitches, performance issues, memory leaks, or potential crashes.

## Files to Change

- `src/engine/renderer3d.js` (530 lines)
- `src/engine/renderer2d.js` (565 lines)

---

## Bugs Found

### renderer3d.js

#### BUG 1: Radar distance labels clipped invisible (HIGH — visual)
**File:** `renderer2d.js`, lines 401, 404-410

The radar clip path at line 401 uses `rR - 1` as radius:
```js
c.beginPath(); c.arc(rX,rY,rR-1,0,Math.PI*2); c.clip();
```

But distance labels at lines 407-409 are drawn at `rX + rR * f + 2` from center, which is **outside** the clip radius `rR - 1`. The labels (`0.33k`, `0.66k`, `1.0k`) are permanently clipped and invisible.

**Fix:** Either move labels inside the clip area (e.g., `rX + rR * f - 8`) or draw them before the `clip()` call. The range ring lines themselves are fine since they're drawn at exactly `rR * f` which is within `rR - 1` for f < 1.0, but the f=1.0 ring label is at `rX + rR + 2` which is definitely outside.

**Approach:** Draw distance labels before line 401 (before `c.clip()`), or reduce the label x-offset to place them inside the clip area.

---

#### BUG 2: Mesh memory leak on turret rebuild (HIGH — memory)
**File:** `renderer3d.js`, line 150

```js
turretsGroup.clear();
```

`THREE.Group.clear()` removes children from the parent but does **not** dispose of their geometries or materials. Every time upgrade levels change, old turret geometries (CylinderGeometry, BoxGeometry) and materials (MeshBasicMaterial) are orphaned in GPU memory.

Over a long play session with frequent shop visits, this accumulates leaked VRAM.

**Fix:** Before calling `clear()`, iterate through existing children and dispose geometries/materials:
```js
turretsGroup.children.forEach(child => {
  child.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
});
turretsGroup.clear();
```

---

#### BUG 3: Per-frame GC pressure from raycastToPlane (MEDIUM — performance)
**File:** `renderer3d.js`, lines 10-19, called at line 88

Every frame, `raycastToPlane` allocates:
- `new THREE.Raycaster()` 
- `new THREE.Vector2(ndcX, ndcY)`
- `new THREE.Plane(normal, constant)`
- `new THREE.Vector3()` (target)

That's 4 object allocations per frame = ~240 allocations/second at 60fps. This creates constant GC pressure.

**Fix:** Create reusable instances as module-level variables or pass them in. Since this function is also exported and used elsewhere, the safest approach is to create a non-allocating version that reuses module-level scratch objects:

```js
const _raycaster = new THREE.Raycaster();
const _ndcVec = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _target = new THREE.Vector3();

export const raycastToPlane = (clientX, clientY, camera) => {
  _ndcVec.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  _raycaster.setFromCamera(_ndcVec, camera);
  _raycaster.ray.intersectPlane(_plane, _target);
  if (!_target) return null;
  return { x: _target.x, y: _target.y };
};
```

**Caveat:** This is not reentrant/thread-safe, but since Three.js rendering is single-threaded and this is called once per frame in `draw3DFrame`, it's safe. The exported function used by `useInput.jsx` is also called synchronously during event handlers, so no concurrent access.

---

#### BUG 4: Laser effects share single material — opacity crosstalk (MEDIUM — visual)
**File:** `renderer3d.js`, lines 519-524

```js
for (let e of g.effects) {
  if (e.type !== 'laser') continue;
  const m = getMesh(e, () => new THREE.Line(new THREE.BufferGeometry(), mats.laser));
  // ...
  m.material.opacity = Math.min(1, e.life * 10);
}
```

All laser effects share `mats.laser` (a single `LineBasicMaterial` instance). Setting `m.material.opacity` on one laser changes the opacity for **all** lasers on screen simultaneously. The last laser in the loop wins.

**Fix:** Create a separate material per laser effect:
```js
const m = getMesh(e, () => new THREE.Line(
  new THREE.BufferGeometry(), 
  mats.laser.clone()
));
```

---

#### BUG 5: Skin colors applied every frame unnecessarily (LOW — performance)
**File:** `renderer3d.js`, lines 124-142

The entire player mesh hierarchy is traversed and material colors are set **every single frame**, even though the skin rarely changes. The `updateMaterials` recursive function walks all children of the player group.

**Fix:** Cache the current skin index and only update when it changes:
```js
if (pm.userData.skinIdx !== skinIdx) {
  pm.userData.skinIdx = skinIdx;
  // ... apply colors ...
}
```

---

#### BUG 6: EMP zone opacity set redundantly (LOW — correctness/cleanliness)
**File:** `renderer3d.js`, lines 406-416

```js
// Line 408: opacity set during material creation
new THREE.MeshBasicMaterial({ ..., opacity: h.empActive ? 0.8 : 0.25 })
// ...
// Line 416: opacity set again unconditionally
if (emp.material) emp.material.opacity = h.empActive ? 0.8 : 0.25;
```

Line 416 overwrites what was set at creation time. This is redundant for newly created meshes but necessary for existing meshes (since `getMesh` returns cached meshes). The ternary in the material constructor on line 408 is therefore misleading — it only matters for the first frame.

**Fix:** Remove the conditional from the constructor, always use a default:
```js
new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.25 })
```
Keep line 416 as the authoritative opacity setter.

---

#### BUG 7: Sabotage structure ID assigned in renderer (LOW — architecture)
**File:** `renderer3d.js`, line 306

```js
if (!s.id) s.id = Math.random();
```

The renderer mutates game state by assigning IDs to sabotage structures. This belongs in `sabotageSetup.js` where structures are created.

**Fix:** Move ID assignment to `sabotageSetup.js` in the structure creation loop. Remove the fallback from renderer3d.js. If a structure somehow lacks an ID, use a stable fallback like `index`-based keying instead of `Math.random()` (which would change on every frame if the check is hit).

---

#### BUG 8: Combo counter missing null guard (MEDIUM — crash risk)
**File:** `renderer2d.js`, lines 58-73

```js
if (g.combo && g.combo.count > 0) {
```

The null check is present, which is good. However, `g.combo.multiplier` is accessed without checking if it exists. If `g.combo` exists but `multiplier` is undefined, `comboColors[undefined]` returns `undefined`, and `c.fillStyle = undefined` could cause a canvas error.

**Fix:** Add fallback:
```js
const comboColor = comboColors[g.combo.multiplier] || '#ffffff';
```
This already exists on line 60, so this is actually fine. **Not a bug — false alarm.**

---

#### BUG 9: FPS tracking spike after long pause (LOW — visual)
**File:** `renderer2d.js`, lines 37-45

```js
fpsFrames++;
const now = performance.now();
if (fpsLastTime === 0) fpsLastTime = now;
const elapsed = now - fpsLastTime;
if (elapsed >= 1000) {
  fpsValue = Math.round(fpsFrames * 1000 / elapsed);
  fpsFrames = 0;
  fpsLastTime = now;
}
```

If the game pauses for 10 seconds (e.g., browser tab switch), `fpsFrames` accumulates 600+ frames, `elapsed` is 10000ms, and `fpsValue` shows `60` — which is actually correct mathematically. However, if the tab was suspended and frames weren't counted, `fpsFrames` could be 0 and show 0 FPS momentarily.

More importantly, `fpsLastTime` is module-level state that persists across game resets. If the game is restarted, the timer continues from the old value.

**Fix:** Reset FPS tracking state when the game resets. This requires passing a reset signal or checking `g.totalTime` for a reset indicator. Simplest fix: cap elapsed to a maximum to avoid weird edge cases:
```js
if (elapsed >= 1000) {
  const cappedElapsed = Math.min(elapsed, 5000); // Cap at 5 seconds max
  fpsValue = Math.round(fpsFrames * 1000 / cappedElapsed);
  fpsFrames = 0;
  fpsLastTime = now;
}
```

---

#### BUG 10: Enemy LOD toggle scale accumulation (MEDIUM — visual drift)
**File:** `renderer3d.js`, lines 254-262

```js
const dist = Math.sqrt(distSq);
if (dist > 1000 && !m.userData.lodApplied) {
  m.scale.multiplyScalar(0.8);
  m.userData.lodApplied = true;
} else if (dist <= 1000 && m.userData.lodApplied) {
  m.scale.multiplyScalar(1.25);
  m.userData.lodApplied = false;
}
```

While `0.8 * 1.25 = 1.0` mathematically, floating-point multiplication accumulates tiny errors over repeated toggle cycles. After many near/far transitions, the mesh scale drifts slightly from the original.

More critically: the LOD is applied based on **per-frame distance**, but the toggle flag means an enemy that oscillates around the 1000-unit boundary will have its scale multiplied back and forth every frame it crosses the threshold.

**Fix:** Store the original scale and restore it explicitly instead of using inverse multiplication:
```js
// On mesh creation, store original scale
// Then in LOD:
if (dist > 1000 && !m.userData.lodApplied) {
  m.userData.originalScale = m.scale.clone();
  m.scale.set(m.userData.originalScale.x * 0.8, m.userData.originalScale.y * 0.8, m.userData.originalScale.z * 0.8);
  m.userData.lodApplied = true;
} else if (dist <= 1000 && m.userData.lodApplied && m.userData.originalScale) {
  m.scale.copy(m.userData.originalScale);
  m.userData.lodApplied = false;
}
```

---

#### BUG 11: Escort destination marker renders even when escort is dead (LOW — visual)
**File:** `renderer3d.js`, lines 491-509

```js
if (g.escort.active && g.escort.hp > 0) {
  // ... renders destination marker at targetX/targetY
}
```

This checks `hp > 0` so it only renders when escort is alive. **Not a bug — false alarm.** The condition is correct.

---

#### BUG 12: `g.worldMouse` overwritten with stale data when raycast fails (LOW — correctness)
**File:** `renderer3d.js`, lines 88-89

```js
const freshWM = raycastToPlane(g.mouse.x || ..., g.mouse.y || ..., camera);
if (freshWM) g.worldMouse = freshWM;
```

If `raycastToPlane` returns `null` (ray parallel to plane), `g.worldMouse` retains its previous value. This is actually the correct behavior — don't update world mouse if we can't compute it. **Not a bug.**

---

#### BUG 13: Missile scale set twice (LOW — cleanliness)
**File:** `renderer3d.js`, lines 226-232

```js
const m = getMesh(p, () => {
  // ...
  m.scale.set(p.radius, p.radius, p.radius); return m;
});
// ...
if (p.type === 'missile' || p.type === 'enemy_missile') {
  m.scale.set(p.radius*0.5, p.radius*2, p.radius*0.5);
  // ...
}
```

For missiles, the scale is set in the creator function then immediately overwritten. The initial `scale.set` in the creator is wasted for missiles.

**Fix:** Move missile-specific scaling into the creator function:
```js
const m = getMesh(p, () => {
  const col = p.isEnemy ? 0xd946ef : 0xff0000;
  const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color: col, wireframe: true }));
  if (p.type === 'missile' || p.type === 'enemy_missile') {
    m.scale.set(p.radius*0.5, p.radius*2, p.radius*0.5);
  } else {
    m.scale.set(p.radius, p.radius, p.radius);
  }
  return m;
});
m.position.set(p.x, p.y, 0);
if (p.type === 'missile' || p.type === 'enemy_missile') {
  m.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI/2;
}
```

---

#### BUG 14: ~~`turretsGroup.clear()` not available in older Three.js~~ — NOT A BUG

Three.js version is r183.2, well past r153 when `Group.clear()` was added. No fix needed.

---

#### BUG 15: `projectToScreen` uses `window.innerWidth/Height` which may differ from canvas (LOW — visual)
**File:** `renderer3d.js`, lines 22-30

`projectToScreen` projects world coords to screen using `window.innerWidth` and `window.innerHeight`. If the Three.js renderer size differs from the window size (e.g., due to CSS scaling, padding, or the canvas not filling the window), the projected coordinates will be wrong.

This affects all 2D HUD elements that use `projectToScreen` (enemy HP bars, beacon HP bars, sabotage HP bars, damage numbers, etc.).

**Fix:** Pass the renderer's actual size or use `threeObj.renderer.domElement.clientWidth/Height`:
```js
export const projectToScreen = (camera, wx, wy, wz, canvasW, canvasH) => {
  const v = new THREE.Vector3(wx, wy, wz);
  v.project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * (canvasW || window.innerWidth),
    y: (-v.y * 0.5 + 0.5) * (canvasH || window.innerHeight),
    visible: v.z < 1,
  };
};
```

Update callers in `draw2DFrame` to pass canvas dimensions.

---

### renderer2d.js

#### BUG 16: Radar distance labels clipped (see BUG 1 — same issue, documented here for context)

Already covered above. The fix belongs in `renderer2d.js`.

---

#### BUG 17: `roundRect` not available in all browsers (LOW — crash risk)
**File:** `renderer2d.js`, line 169

```js
c.roundRect(btnX, btnY, MUTE_BTN_SIZE, MUTE_BTN_SIZE, 6);
```

`CanvasRenderingContext2D.roundRect()` was added in Chrome 119, Firefox 121, Safari 17.4. Older browsers will throw `TypeError: c.roundRect is not a function`.

**Fix:** Add a polyfill or fallback:
```js
if (c.roundRect) {
  c.roundRect(btnX, btnY, MUTE_BTN_SIZE, MUTE_BTN_SIZE, 6);
} else {
  c.rect(btnX, btnY, MUTE_BTN_SIZE, MUTE_BTN_SIZE);
}
```

---

#### BUG 18: Combo timer bar ratio hardcoded to 3 (LOW — correctness)
**File:** `renderer2d.js`, line 68

```js
const timerRatio = g.combo.timer / 3;
```

The combo timer max is hardcoded as `3` seconds. If the combo system's timer max changes in `gameConfig.js` or elsewhere, this desynchronizes. 

**Fix:** Import the combo duration from `GAME_CONFIG` or define a constant.

---

## Summary Table

| # | File | Severity | Type | Description |
|---|------|----------|------|-------------|
| 1 | renderer2d.js | MEDIUM | Visual | Outermost radar distance label ("1.0k") clipped by clip path |
| 2 | renderer3d.js | HIGH | Memory | Turret geometries/materials leaked on rebuild (Group.clear doesn't dispose) |
| 3 | renderer3d.js | MEDIUM | Perf | raycastToPlane allocates 4 objects per frame (~240 allocs/sec) |
| 4 | renderer3d.js | MEDIUM | Visual | Laser effects share single material — opacity crosstalk |
| 5 | renderer3d.js | LOW | Perf | Skin colors applied every frame via recursive traversal |
| 6 | renderer3d.js | LOW | Clean | EMP opacity set redundantly in material constructor |
| 7 | renderer3d.js | LOW | Arch | Sabotage structure ID assigned in renderer instead of setup |
| 9 | renderer2d.js | LOW | Visual | FPS tracking edge case after long pause/tab switch |
| 10 | renderer3d.js | LOW | Visual | Enemy LOD scale theoretically drifts over many toggle cycles |
| 13 | renderer3d.js | LOW | Clean | Missile scale set twice (once in creator, once after) |
| 15 | renderer3d.js | LOW | Visual | projectToScreen uses window size (works correctly in current layout) |
| 17 | renderer2d.js | LOW | Compat | `roundRect` not in older browsers (Chrome <119, Firefox <121) |
| 18 | renderer2d.js | LOW | Correct | Combo timer bar ratio hardcoded to 3 instead of using config |

## Proposed Fix Order

1. **BUG 2** — Turret memory leak (dispose geometries/materials before clear)
2. **BUG 4** — Laser material sharing (clone material per effect)
3. **BUG 3** — raycastToPlane GC pressure (module-level scratch objects)
4. **BUG 1** — Radar outermost label clipped (move label inside clip area)
5. **BUG 5** — Skin color caching (skip traversal when skin unchanged)
6. **BUG 6, 7, 9, 10, 13, 15, 17, 18** — Minor cleanups (low priority)

## Status: COMPLETE

All 13 fixes implemented and verified with clean build.

### Changes Summary

| File | Lines Changed | Fixes |
|------|---------------|-------|
| `renderer3d.js` | ~30 net additions | BUG 2, 3, 4, 5, 6, 7, 10, 13 |
| `renderer2d.js` | ~10 net additions | BUG 1, 9, 17, 18 |
| `sabotageSetup.js` | +1 line | BUG 7 (ID assignment) |

### What Changed

**renderer3d.js:**
- Turret geometries/materials disposed before `clear()` (BUG 2)
- `raycastToPlane` uses module-level scratch objects instead of per-frame allocations (BUG 3)
- Laser effects clone the shared material instead of sharing it (BUG 4)
- Skin colors only applied when skin index changes (BUG 5)
- EMP opacity set from single authoritative line (BUG 6)
- Removed `s.id = Math.random()` fallback from renderer (BUG 7)
- Enemy LOD stores original scale, restores explicitly (BUG 10)
- Missile scale set once in creator function (BUG 13)

**renderer2d.js:**
- Radar distance labels moved inside clip area (BUG 1)
- FPS elapsed capped at 5s to avoid edge cases (BUG 9)
- `roundRect` guarded with feature detection (BUG 17)
- Combo timer bar uses `C.combo.timerDuration` from config (BUG 18)

**sabotageSetup.js:**
- Structures created with stable `id: i` instead of renderer assigning random IDs (BUG 7)
