# Plan: Add Escort Mission Type to Space Sentinel

## Goal
Add a new **escort mission** type to Space Sentinel — a node on the sector map where the player must protect a friendly civilian ship from waves of enemies until it reaches a safe zone.

## Current Context / Assumptions
- **Repo**: `space_sentinel/`
- **Architecture**: Single-file `App.jsx` (~1400 lines). Game state in mutable ref `game.current`.
- **Existing mission types**: `kill`, `survive`, `collect`, `kill_boss`, `kill_elite`
- **Existing node types on map**: `combat`, `elite`, `event`, `shop`, `repair`, `boss`
- **Enemy spawning**: `spawnEnemy()` uses type-roll thresholds; enemies auto-path toward player
- **HUD**: 2D canvas overlay with HP bars, mission progress bar, tactical radar
- **Rendering**: Three.js wireframe meshes, mesh pooling via `getMesh()`

## Proposed Approach
Add a new `escort` node type to the map generator and a corresponding `escort` mission type. A friendly civilian ship (the "escort target") enters the arena from the far edge and slowly moves toward the player. Enemies prioritize attacking it. The player must destroy enough enemies before the escort reaches the safe zone (timer expires) for the mission to succeed.

## Step-by-Step Plan

### Step 1: Add `escort` node type to the map generator
**File**: `space_sentinel/src/engine/mapGenerator.js`

In the node type assignment loop (lines 70-104), add logic to assign `escort` nodes at specific rows:

```js
// Around line 78, after the shop assignment:
else if (r === 5 || r === 10) {
    // Reserve rows for escort nodes
    if (Math.random() < 0.3) node.type = 'escort';
}
```

Also add the escort node type to the `getColorForType` and `getIconForType` logic in `App.jsx`'s `renderMap()` function (lines 1191-1209):

```js
if (type === 'escort') return <Shield className="w-5 h-5" />;
if (type === 'escort') return 'border-cyan-500 text-cyan-400 bg-cyan-900/60 shadow-[0_0_15px_#06b63a]';
```

### Step 2: Add `escort` mission type to `generateMission()`
**File**: `space_sentinel/src/App.jsx` (line ~99)

Add a new branch in `generateMission()`:

```js
if (nodeType === 'escort') {
    t = 'escort';
    target = 30; // seconds to survive
    title = `Escort the Civilian Transport`;
    reward = 100 + level * 25;
    return { type: t, target, current: 0, title, reward };
}
```

### Step 3: Initialize the escort target in the mission start flow
**File**: `space_sentinel/src/App.jsx` — in `renderMap()` where combat nodes are entered (line ~1290-1304)

When a player enters an `escort` node, add an `escortTarget` to the game state:

```js
// After setting mission, before setGameState('playing'):
game.current.escortTarget = {
    x: g.player.x, // start near player
    y: g.player.y - 600, // 600 units ahead (in the direction the player is facing)
    hp: 150 + level * 20,
    maxHp: 150 + level * 20,
    speed: 40 + level * 2,
    radius: 25,
    active: true,
    reachedSafeZone: false
};
// Calculate spawn direction based on map orientation (always from "north")
game.current.escortSpawnY = g.player.y - 600;
```

### Step 4: Add escort target physics and movement
**File**: `space_sentinel/src/App.jsx` — in `updatePhysics()`

Add escort target update logic in the physics loop (after player movement, before projectile processing):

```js
// --- Escort Target ---
if (g.mission && g.mission.type === 'escort' && g.escortTarget && g.escortTarget.active) {
    let et = g.escortTarget;
    
    // Move toward the player's forward direction (always "forward" on map = up)
    // Escort comes from the far edge toward the player
    let toPlayerX = g.player.x - et.x;
    let toPlayerY = g.player.y - et.y;
    let dist = Math.hypot(toPlayerX, toPlayerY);
    
    if (dist > 100) {
        et.x += (toPlayerX / dist) * et.speed * dt;
        et.y += (toPlayerY / dist) * et.speed * dt;
    } else {
        // Reached player — mission complete
        et.reachedSafeZone = true;
    }
    
    // Timer-based win condition
    g.mission.current += dt;
    if (g.mission.current >= g.mission.target) {
        completeMission();
        et.active = false;
    }
}
```

### Step 5: Make enemies target the escort
**File**: `space_sentinel/src/App.jsx` — in `spawnEnemy()` and enemy AI

**5a. In `spawnEnemy()` (line ~141)**: Add a new enemy type that specifically targets the escort:

```js
// Add to the type-roll chain (around line 152-162):
else if (typeRoll > 0.50 && g.mission && g.mission.type === 'escort') { 
    type = 'escort_hunter'; 
    hp = 50 * diffMult; 
    speed = 150 + Math.random() * 50; 
    radius = 18; 
    color = 0xf472b6; 
    fireCooldown = 1.2; 
    targetsEscort = true; 
}
```

**5b. In enemy AI (line ~425-457)**: Modify the pathing logic so enemies that have `targetsEscort` flag path toward the escort target instead of the player:

```js
// In the enemy update loop, replace the player-targeting logic for escort-targeting enemies:
let targetForEnemy = g.player; // default
if (e.targetsEscort && g.escortTarget && g.escortTarget.active) {
    targetForEnemy = g.escortTarget;
}

let distToPlayer = Math.hypot(targetForEnemy.x - e.x, targetForEnemy.y - e.y);
let angle = Math.atan2(targetForEnemy.y - e.y, targetForEnemy.x - e.x);
```

Also update the shooter/missile_boat retreat logic to use `targetForEnemy` instead of `g.player`.

### Step 6: Handle escort target taking damage
**File**: `space_sentinel/src/App.jsx` — in `updatePhysics()`

In the projectile-enemy collision code, also check if projectiles hit the escort target:

```js
// After the enemy projectile hit check (around line 396):
// Check if enemy projectile hits escort target
if (p.isEnemy && g.escortTarget && g.escortTarget.active && p.type !== 'enemy_bullet') {
    // Actually, enemy missiles should hit escort target
    if (Math.hypot(p.x - g.escortTarget.x, p.y - g.escortTarget.y) < g.escortTarget.radius + p.radius) {
        let dmg = p.damage;
        g.escortTarget.hp -= dmg;
        createParticles(g, p.x, p.y, 0xf472b6, 5);
        g.effects.push({ type: 'dmg', x: g.escortTarget.x, y: g.escortTarget.y - 10, text: Math.ceil(dmg).toString(), life: 0.8 });
        p.active = false;
        if (g.escortTarget.hp <= 0) {
            g.escortTarget.active = false;
            // Mission failure — but don't end the game, just the mission
            g.effects.push({ type: 'mission_fail', x: window.innerWidth / 2, y: Math.max(100, window.innerHeight / 4), text: 'ESCORT LOST', life: 3.0 });
            g.transitionTimer = 3.0;
            g.isVictory = false;
        }
    }
}
```

Also add escort target collision with player enemies (same as player HP check but for escort):

```js
// In the enemy-player collision section, add escort collision:
if (g.escortTarget && g.escortTarget.active && Math.hypot(e.x - g.escortTarget.x, e.y - g.escortTarget.y) < e.radius + g.escortTarget.radius) {
    // Escort takes damage from ramming
    let baseDmg = 15;
    g.escortTarget.hp -= baseDmg;
    createParticles(g, g.escortTarget.x, g.escortTarget.y, 0x39ff14, 8);
    g.effects.push({ type: 'dmg', x: g.escortTarget.x, y: g.escortTarget.y - 10, text: String(baseDmg), life: 0.8 });
    e.x += Math.cos(angle + Math.PI) * 20;
    e.y += Math.sin(angle + Math.PI) * 20;
    if (g.escortTarget.hp <= 0) {
        g.escortTarget.active = false;
        g.effects.push({ type: 'mission_fail', x: window.innerWidth / 2, y: Math.max(100, window.innerHeight / 4), text: 'ESCORT LOST', life: 3.0 });
        g.transitionTimer = 3.0;
        g.isVictory = false;
    }
}
```

### Step 7: Render the escort target in 3D
**File**: `space_sentinel/src/App.jsx` — in `drawThree()`

Add escort target rendering after the enemies section (around line 811):

```js
// Escort Target
if (g.escortTarget && g.escortTarget.active) {
    const et = g.escortTarget;
    const mesh = getMesh(et, () => {
        const group = new THREE.Group();
        // Civilian ship body (white/gray, distinct from player's green)
        const body = new THREE.Mesh(new THREE.BoxGeometry(30, 50, 15), 
            new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true }));
        group.add(body);
        // Cargo pods
        const pod1 = new THREE.Mesh(new THREE.BoxGeometry(15, 20, 15), 
            new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true }));
        pod1.position.set(-22, -5, 0); group.add(pod1);
        const pod2 = pod1.clone();
        pod2.position.set(22, -5, 0); group.add(pod2);
        // Beacon light
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), 
            new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true }));
        beacon.position.set(0, 28, 0); group.add(beacon);
        return group;
    });
    mesh.position.set(et.x, et.y, 0);
    // Rotate to face direction of travel
    mesh.rotation.z = Math.atan2(et.vx || 0, et.vy || 0) - Math.PI / 2;
    
    // Draw escort HP bar above the ship
    const hpRatio = Math.max(0, et.hp / et.maxHp);
    // (Use a thin box geometry as a bar, or just rely on HUD)
}
```

### Step 8: Add escort HUD elements
**File**: `space_sentinel/src/App.jsx` — in `drawThree()` HUD section (line ~852-946)

Add escort HP bar to the 2D canvas HUD:

```js
// After the mission progress bar (around line 894):
if (g.mission && g.mission.type === 'escort' && g.escortTarget && g.escortTarget.active) {
    const et = g.escortTarget;
    const sp = projectToScreen(camera, et.x, et.y, 0);
    if (sp.visible) {
        const barW = 60;
        const hpRatio = Math.max(0, et.hp / et.maxHp);
        c2d.fillStyle = 'rgba(0,0,0,0.5)';
        c2d.fillRect(sp.x - barW/2, sp.y - 35, barW, 6);
        c2d.fillStyle = hpRatio > 0.5 ? '#39ff14' : (hpRatio > 0.25 ? '#facc15' : '#ef4444');
        c2d.fillRect(sp.x - barW/2, sp.y - 35, barW * hpRatio, 6);
        c2d.fillStyle = '#e2e8f0';
        c2d.font = 'bold 10px monospace';
        c2d.textAlign = 'center';
        c2d.fillText('ESCORT', sp.x, sp.y - 40);
    }
}
```

Also add escort timer to the mission text display:

```js
// Update the missionText rendering (around line 891):
let missionText;
if (g.mission.type === 'escort') {
    let remaining = Math.max(0, g.mission.target - g.mission.current);
    missionText = `ESCORT MISSION: ${Math.floor(remaining)}s remaining`;
} else if (g.mission.type === 'survive') {
    missionText = `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}s / ${g.mission.target}s]`;
} else {
    missionText = `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)} / ${g.mission.target}]`;
}
```

### Step 9: Add escort radar blip
**File**: `space_sentinel/src/App.jsx` — in the tactical radar section (around line 1028-1060)

Add escort target blip in the radar:

```js
// After enemy blips, before pickup blips:
if (g.escortTarget && g.escortTarget.active) {
    const d = Math.hypot(g.escortTarget.x - g.player.x, g.escortTarget.y - g.player.y);
    if (d <= radarRange) {
        const { px, py } = toRadar(g.escortTarget.x, g.escortTarget.y);
        c2d.fillStyle = '#39ff14';
        c2d.beginPath();
        c2d.moveTo(px, py - 5); c2d.lineTo(px + 4, py + 3);
        c2d.lineTo(px - 4, py + 3);
        c2d.closePath();
        c2d.fill();
        // Pulsing ring
        c2d.strokeStyle = `rgba(57,255,20,${0.3 + 0.3 * Math.sin(g.totalTime * 4)})`;
        c2d.lineWidth = 1;
        c2d.beginPath();
        c2d.arc(px, py, 6, 0, Math.PI * 2);
        c2d.stroke();
    }
}
```

### Step 10: Clean up escort state on mission end
**File**: `space_sentinel/src/App.jsx` — in the mission complete / transition logic

In `completeMission()` and the transition timer section (around line 166-205), reset the escort target:

```js
// In the transition timer block (line 176):
g.escortTarget = null;
```

Also reset in `renderMap()` when entering a new node (around line 1302):

```js
game.current.escortTarget = null;
```

### Step 11: Add escort node to the map legend
**File**: `space_sentinel/src/App.jsx` — `renderMap()` (around line 1221-1229)

Add legend entry:
```js
<div className="flex items-center gap-3"><Shield className="w-5 h-5 text-cyan-400" /> <span className="text-gray-300 font-bold">Escort Mission</span></div>
```

## Files Likely to Change

| File | Changes |
|------|---------|
| `src/engine/mapGenerator.js` | Add `escort` node type assignment |
| `src/App.jsx` | Mission type, escort target physics, enemy targeting, 3D rendering, HUD, radar, cleanup |
| `src/constants/upgrades.js` | (Optional) Add "Escort Beacon" upgrade that slows enemy approach to escort |

## Tests / Validation

1. **Build**: `npm run build` — verify no syntax errors.
2. **Visual check**: Run `npm run dev` and test:
   - Escort node appears on the map (cyan border, shield icon)
   - Civilian ship spawns and moves toward the player
   - Pink `escort_hunter` enemies target the escort
   - Escort HP bar appears above the ship in 3D view
   - Escort timer shows in the mission progress bar
   - Escort blip appears in the tactical radar (green triangle with pulsing ring)
   - Destroying the escort triggers "ESCORT LOST" message and returns to map
   - Surviving the timer triggers "AREA CLEARED!" with scrap reward
3. **Balance check**: Play through 3+ escort missions:
   - Timer should be challenging but beatable (20-40 seconds based on level)
   - Escort HP should be sufficient for the duration but not infinite
   - Enemy spawns should be intense enough to feel the pressure

## Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| Escort target is too fragile and dies instantly | Start with high HP (150 + level*20) and tune based on playtest. Can add a "shield" visual that absorbs initial hits. |
| Escort target is too tanky and removes tension | Cap max HP, increase enemy damage scaling with level. Add escort_hunter enemies that specifically focus fire. |
| Escort pathing conflicts with player movement | Escort moves toward player's current position (not a fixed point). This creates a dynamic "protect the moving target" feel. |
| Too many new entity types in single file | `App.jsx` is already 1400 lines. Consider extracting `updatePhysics` into `src/engine/physics.js` as a future refactor. |
| Escort node type too rare or too common | Start with 30% chance at rows 5 and 10. Can adjust probability and add more rows later. |

## Open Questions

1. **Escort HP vs timer balance**: Should the escort have a fixed HP pool or a fixed timer? The plan uses a timer (survive X seconds) with HP as a secondary fail condition. This is more forgiving — the escort can take damage and still survive.
2. **Escort speed**: Should the escort move faster (more dynamic) or slower (easier to protect)? Plan uses `40 + level * 2` units/sec.
3. **Counter-upgrade**: Should we add an "Escort Beacon" upgrade that reduces enemy damage to the escort by a percentage?
4. **Escort node frequency**: 2 escort nodes per sector (rows 5 and 10, 30% chance each) seems reasonable. Should we guarantee at least one?
5. **Visual clarity**: Is the white/gray civilian ship distinct enough from the green player ship and colored enemies? Consider adding a pulsing green beacon on top.
