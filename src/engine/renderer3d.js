/**
 * renderer3d.js — Three.js scene setup and per-frame 3D rendering.
 * No React imports. Receives plain objects / DOM refs.
 */
import * as THREE from 'three';
import { SHIP_SKINS } from '../constants/skins';
import { GAME_CONFIG } from '../constants/gameConfig';
import { getScreenShakeOffset } from './screenShake';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Reusable scratch objects to avoid per-frame GC pressure
const _raycaster = new THREE.Raycaster();
const _ndcVec = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _target = new THREE.Vector3();
const _projVec = new THREE.Vector3();

// Module-level reusable collections (avoid per-frame allocation)
const _activeKeys = new Set();
const _sharedGeos = new Set();
const _sharedMats = new Set();
function initSharedSets(geoms, mats) {
  _sharedGeos.clear();
  _sharedMats.clear();
  for (const geo of Object.values(geoms)) _sharedGeos.add(geo);
  for (const mat of Object.values(mats)) _sharedMats.add(mat);
}

// Reusable vectors for laser line geometry
const _laserV1 = new THREE.Vector3();
const _laserV2 = new THREE.Vector3();

// Mesh cleanup runs every N frames (avoids O(N) map scan every frame)
let _cleanupFrameCounter = 0;
const CLEANUP_INTERVAL = 60;

/**
 * Cached mesh lookup — creates mesh on first access, reuses thereafter.
 * NON-REENTRANT: relies on module-level _activeKeys.
 */
const getMesh = (obj, meshes, scene, createFn) => {
  if (!meshes.has(obj)) { const m = createFn(); scene.add(m); meshes.set(obj, m); }
  _activeKeys.add(obj);
  return meshes.get(obj);
};

export const raycastToPlane = (clientX, clientY, camera) => {
  _ndcVec.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  _raycaster.setFromCamera(_ndcVec, camera);
  const hit = _raycaster.ray.intersectPlane(_plane, _target);
  if (!hit) return null;
  return { x: _target.x, y: _target.y };
};

export const projectToScreen = (camera, wx, wy, wz = 0) => {
  _projVec.set(wx, wy, wz);
  _projVec.project(camera);
  return {
    x: (_projVec.x * 0.5 + 0.5) * window.innerWidth,
    y: (-_projVec.y * 0.5 + 0.5) * window.innerHeight,
    visible: _projVec.z < 1,
  };
};

// ─── Scene init ───────────────────────────────────────────────────────────────

export const initThreeScene = (containerEl) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);
  scene.fog = new THREE.Fog(0x0a0a14, 2000, 5000);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(100, -200, 300);
  scene.add(dir);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  camera.position.set(0, 0, 200);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  if (containerEl) containerEl.appendChild(renderer.domElement);

  const geoms = {
    box:    new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 8, 8),
    cone:   new THREE.ConeGeometry(1, 2, 8),
    tetra:  new THREE.TetrahedronGeometry(1),
    deathPulseRing: new THREE.RingGeometry(0.95, 1, 32), // Shared ring for death pulses (scaled at runtime)
  };
  const mats = {
    player: new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true }),
    shield: new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, transparent: true, opacity: 0.3 }),
    pickup: new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true }),
    laser:  new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 }),
  };

  return { scene, camera, renderer, g: geoms, m: mats, meshes: new Map() };
};

// ─── Draw 3D frame ────────────────────────────────────────────────────────────

export const draw3DFrame = (threeObj, g) => {
  const { scene, camera, renderer, meshes, g: geoms, m: mats } = threeObj;
  _activeKeys.clear();
  initSharedSets(geoms, mats);

  // Chase camera
  const playerYaw = g.player.yaw ?? Math.PI / 2;
  const camFwdX = Math.cos(playerYaw), camFwdY = Math.sin(playerYaw);

  // Screen shake offset (respects settings)
  const shakeEnabled = g.settings?.screenShake !== false;
  const shake = shakeEnabled && g.screenShake?.active ? getScreenShakeOffset(g.screenShake.intensity, g.totalTime) : { x: 0, y: 0 };

  camera.position.lerp(new THREE.Vector3(g.player.x - camFwdX * 220 + shake.x, g.player.y - camFwdY * 220 + shake.y, 120), 0.03);
  camera.up.set(0, 0, 1);
  camera.lookAt(new THREE.Vector3(g.player.x + camFwdX * 80 + shake.x, g.player.y + camFwdY * 80 + shake.y, 0));

  // Dynamic FOV — apply camera field-of-view from game state
  if (g.dynamicFov && g.dynamicFov.current !== undefined) {
    camera.fov = g.dynamicFov.current;
    camera.updateProjectionMatrix();
  }

  camera.updateMatrixWorld(false);
  const freshWM = raycastToPlane(g.mouse.x || window.innerWidth / 2, g.mouse.y || window.innerHeight / 2, camera);
  if (freshWM) g.worldMouse = freshWM;

  // Stars (static — set position once on creation)
  for (let s of g.stars) {
    getMesh(`star_${s.id ?? s}`, meshes, scene, () => {
      const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color: 0x006400, wireframe: true, transparent: true, opacity: s.size / 3 }));
      m.scale.set(s.size, s.size, s.size);
      m.position.set(s.x, s.y, s.z);
      return m;
    });
  }

  // Player ship
  const pm = getMesh('player', meshes, scene, () => {
    const group = new THREE.Group();
    const hullMat = mats.player.clone();
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(40, 60, 20), hullMat)));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(80, 20, 10), hullMat); wing.position.set(0, -10, -5); group.add(wing);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(20, 15, 10), hullMat); bridge.position.set(0, 10, 10); group.add(bridge);
    const shieldMat = mats.shield.clone();
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), shieldMat); shield.scale.set(42, 42, 42); shield.name = 'shield'; group.add(shield);
    // Engine glow (thruster exhaust)
    const egMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.7 });
    const egL = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), egMat.clone()); egL.scale.set(4, 6, 4); egL.name = 'engineL'; egL.position.set(-30, -15, -5); group.add(egL);
    const egR = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), egMat.clone()); egR.scale.set(4, 6, 4); egR.name = 'engineR'; egR.position.set(30, -15, -5); group.add(egR);
    const turrets = new THREE.Group(); turrets.name = 'turrets'; group.add(turrets);
    return group;
  });
  pm.position.set(g.player.x, g.player.y, 0);
  const targetRotZ = (g.player.yaw ?? Math.PI / 2) - Math.PI / 2;
  let rotDiff = targetRotZ - pm.rotation.z;
  while (rotDiff >  Math.PI) rotDiff -= Math.PI * 2;
  while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
  pm.rotation.z += rotDiff * 0.35;

  // Cache shield/turret refs to avoid per-frame children.find()
  if (!pm.userData.shieldMesh) pm.userData.shieldMesh = pm.children.find(c => c.name === 'shield');
  if (!pm.userData.turretsGroup) pm.userData.turretsGroup = pm.children.find(c => c.name === 'turrets');
  // Cache hull meshes (children[0]=hull, [1]=wing, [2]=bridge) for i-frames blink
  if (!pm.userData.hullMeshes) {
    pm.userData.hullMeshes = [pm.children[0], pm.children[1], pm.children[2]];
  }
  const shieldMesh = pm.userData.shieldMesh;
  if (shieldMesh) { shieldMesh.visible = g.player.maxShield > 0; shieldMesh.material.opacity = Math.max(0.1, 0.5 * (g.player.shield / g.player.maxShield)); }

  // Apply active skin colors to player mesh (only when skin changes)
  const skinIdx = Math.max(0, Math.min(g.shipSkin ?? 0, SHIP_SKINS.length - 1));
  const skin = SHIP_SKINS[skinIdx];
  if (pm.userData.skinIdx !== skinIdx) {
    pm.userData.skinIdx = skinIdx;
    const updateMaterials = (obj, color) => {
      if (obj.material) obj.material.color.setHex(color);
      if (obj.children) obj.children.forEach(c => updateMaterials(c, color));
    };
    pm.children.forEach(child => {
      if (child.name === 'shield') return;
      if (child.name === 'engineL' || child.name === 'engineR') {
        if (child.material) child.material.color.setHex(skin.engineGlow);
        return;
      }
      updateMaterials(child, skin.hullColor);
    });
    if (shieldMesh && shieldMesh.material) {
      shieldMesh.material.color.setHex(skin.accentColor);
    }
  }

  // Invincibility frames — blink hull meshes only (keep shield, engine glow, turrets visible)
  if (g.playerIFrames && g.playerIFrames.active) {
    const blinkVisible = g.playerIFrames.isInvincible;
    pm.userData.hullMeshes.forEach(m => { if (m) m.visible = blinkVisible; });
  } else {
    // Ensure hull meshes are visible when not in i-frames
    pm.userData.hullMeshes.forEach(m => { if (m && !m.visible) m.visible = true; });
  }

  // Dynamic turrets
  const turretsGroup = pm.userData.turretsGroup;
  if (turretsGroup) {
    const hash = Object.values(g.levels).join('-');
    if (pm.userData.levelsHash !== hash) {
      pm.userData.levelsHash = hash;
      // Dispose geometries/materials before removing children to avoid GPU memory leak
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

      const tMat = mats.player.clone();
      const addTurret = (x, y, isDouble) => {
        const tg = new THREE.Group(); tg.position.set(x, -y, 10);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 6, 12), tMat); base.rotation.x = Math.PI / 2; tg.add(base);
        if (isDouble) {
          const b1 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), tMat); b1.position.set(-3.5, 7.5, 0); tg.add(b1);
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), tMat); b2.position.set(3.5, 7.5, 0); tg.add(b2);
        } else { const b = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), tMat); b.position.set(0, 7.5, 0); tg.add(b); }
        tg.userData.isAiming = true; turretsGroup.add(tg);
      };
      const addMissilePod = (x, y) => {
        const mg = new THREE.Group(); mg.position.set(x, -y, 5);
        mg.add(new THREE.Mesh(new THREE.BoxGeometry(12, 18, 9), mats.player.clone())); turretsGroup.add(mg);
      };

      if (g.levels.autocannon > 0) {
        const slots = [{ x:0,y:-25},{x:0,y:15},{x:0,y:-8},{x:-14,y:-15},{x:14,y:-15},{x:-14,y:5},{x:14,y:5},{x:-14,y:22},{x:14,y:22}];
        const n = Math.min(slots.length, Math.ceil(g.levels.autocannon / 2));
        for (let i = 0; i < n; i++) { let d = g.levels.autocannon >= (i+1)*2; if(i===0&&g.levels.autocannon>=2)d=true; addTurret(slots[i].x, slots[i].y, d); }
      }
      if (g.levels.plasma > 0) {
        const slots = [{x:-22,y:0},{x:22,y:0},{x:-22,y:15},{x:22,y:15},{x:-22,y:30},{x:22,y:30}];
        const n = Math.min(slots.length, Math.ceil(g.levels.plasma / 1.5));
        for (let i = 0; i < n; i++) addTurret(slots[i].x, slots[i].y, false);
      }
      if (g.levels.pointDefense > 0) {
        const slots = [{x:0,y:-38},{x:-12,y:-28},{x:12,y:-28},{x:-28,y:-10},{x:28,y:-10},{x:-28,y:10},{x:28,y:10},{x:-28,y:30},{x:28,y:30}];
        const n = Math.min(slots.length, Math.ceil(g.levels.pointDefense));
        for (let i = 0; i < n; i++) addTurret(slots[i].x, slots[i].y, false);
      }
      if (g.levels.missiles > 0) {
        const slots = [{x:-25,y:-5},{x:25,y:-5},{x:-25,y:8},{x:25,y:8},{x:-25,y:21},{x:25,y:21}];
        const n = Math.min(slots.length, Math.ceil(g.levels.missiles / 1.5));
        for (let i = 0; i < n; i++) addMissilePod(slots[i].x, slots[i].y);
      }
    }

    const worldAim = g.player.aimAngle || 0;
    turretsGroup.children.forEach(t => { if (t.userData.isAiming) t.rotation.z = (worldAim - Math.PI / 2) - pm.rotation.z; });
  }

  // Pickups (with distance culling)
  const renderDist = 1800;
  const renderDistSq = renderDist * renderDist;
  for (let p of g.pickups) {
    if (!p.active) continue;
    const dx = p.x - g.player.x;
    const dy = p.y - g.player.y;
    if (dx * dx + dy * dy > renderDistSq) continue;
    const m = getMesh(`pickup_${p.id ?? p}`, meshes, scene, () => { const m = new THREE.Mesh(geoms.tetra, mats.pickup); m.scale.set(p.radius, p.radius, p.radius); return m; });
    m.position.set(p.x, p.y, 0); m.rotation.x += 0.05; m.rotation.y += 0.05;
  }

  // Power-ups
  if (g.powerups) {
    for (let pu of g.powerups) {
      if (!pu.active) continue;
      const dx = pu.x - g.player.x;
      const dy = pu.y - g.player.y;
      if (dx * dx + dy * dy > renderDistSq) continue;
      const m = getMesh(`pu_${pu.id ?? pu}`, meshes, scene, () => {
        const m = new THREE.Mesh(geoms.box, new THREE.MeshBasicMaterial({ color: pu.color ? parseInt(pu.color.slice(1), 16) : 0xfbbf24, wireframe: true }));
        m.scale.set(pu.radius, pu.radius, pu.radius);
        return m;
      });
      m.position.set(pu.x, pu.y, Math.sin(g.totalTime * 3 + pu.id * 10) * 5);
      m.rotation.x += 0.05;
      m.rotation.y += 0.05;
    }
  }

  // Power-up aura rings (3D expanding rings)
  if (g.powerupAuras) {
    for (const aura of g.powerupAuras) {
      if (!aura.active || aura.ringLife <= 0) continue;
      const dx = aura.x - g.player.x;
      const dy = aura.y - g.player.y;
      if (dx * dx + dy * dy > renderDistSq) continue;
      const lifeRatio = aura.ringMaxLife > 0 ? aura.ringLife / aura.ringMaxLife : 0;
      const m = getMesh(`aura_ring_${aura.type}_${aura.x}_${aura.y}`, meshes, scene, () => {
        const hexColor = aura.color.startsWith('#') ? parseInt(aura.color.slice(1), 16) : aura.color;
        const m = new THREE.Mesh(geoms.deathPulseRing, new THREE.MeshBasicMaterial({
          color: hexColor,
          transparent: true,
          opacity: lifeRatio * 0.6,
          side: THREE.DoubleSide,
        }));
        m.scale.set(aura.ringRadius, aura.ringRadius, aura.ringRadius);
        return m;
      });
      m.position.set(aura.x, aura.y, 0);
      m.material.opacity = lifeRatio * 0.5;
    }
  }

  // Projectiles (with distance culling)
  for (let p of g.projectiles) {
    if (!p.active) continue;
    const dx = p.x - g.player.x;
    const dy = p.y - g.player.y;
    if (dx * dx + dy * dy > renderDistSq) continue;
    const m = getMesh(`proj_${p.id ?? p}`, meshes, scene, () => {
      let col, mat;
      if (p.type === 'enemy_cannon') {
        col = 0xf97316;
        mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 });
      } else {
        col = p.isEnemy ? 0xd946ef : 0xff0000;
        mat = new THREE.MeshBasicMaterial({ color: col, wireframe: true });
      }
      const m = new THREE.Mesh(geoms.sphere, mat);
      m.scale.set(p.radius, p.radius, p.radius); return m;
    });
    m.position.set(p.x, p.y, 0);
    if (p.type === 'missile' || p.type === 'enemy_missile') { m.scale.set(p.radius*0.5, p.radius*2, p.radius*0.5); m.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI/2; }
  }

  // Enemies (with distance culling)
  for (let e of g.enemies) {
    if (!e.active) continue;
    const dx = e.x - g.player.x;
    const dy = e.y - g.player.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > renderDistSq) continue;
    const m = getMesh(`enemy_${e.id ?? e}`, meshes, scene, () => {
      const heavy = e.type === 'heavy';
      let geo = heavy ? new THREE.BoxGeometry(1,1,1) : geoms.cone;
      if (e.type==='shooter') geo = new THREE.BoxGeometry(1,0.5,1);
      else if (e.type==='missile_boat') geo = new THREE.BoxGeometry(1.5,0.5,1.5);
      else if (e.type==='shielded') geo = new THREE.CylinderGeometry(0.5,0.5,1,8);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: e.color, wireframe: true }));
      if (heavy) m.scale.set(e.radius*2,e.radius*2,e.radius*2); else m.scale.set(e.radius*2,e.radius*2,e.radius);
      return m;
    });
    m.position.set(e.x, e.y, 0);

    // Formation-specific rotation & visual cues
    if (e.formation === 'orbit') {
      m.rotation.z = (e.orbitAngle || 0) + Math.PI / 2;
    } else if (e.formation === 'swarm') {
      m.rotation.z = e.angle || Math.atan2(-(g.player.y-e.y), g.player.x-e.x);
    } else if (e.formation === 'screen') {
      m.rotation.z = Math.atan2(-(g.player.y-e.y), g.player.x-e.x);
    } else if (e.formation === 'kamikaze') {
      const wobble = Math.sin(g.totalTime * 3 + e.id * 10) * 0.2;
      m.rotation.z = Math.atan2(-(g.player.y-e.y), g.player.x-e.x) + wobble;
    } else {
      m.rotation.z = Math.atan2(-(g.player.y-e.y), g.player.x-e.x) - Math.PI/2;
    }

    // ── Elite variant visual indicators ──
    if (e.eliteVariant) {
      // Gold trim ring around all elite enemies
      const ringKey = `elite_ring_${e.id}`;
      getMesh(ringKey, meshes, scene, () => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(e.radius * 1.3, e.radius * 1.5, 16),
          new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
        );
        ring.rotation.x = -Math.PI / 2;
        return ring;
      }).position.set(e.x, e.y, 2);

      // Tank: directional shield arc segments
      if (e.eliteVariant === 'tank' && e.directionalShields) {
        const sides = e.directionalShields.length;
        for (let s = 0; s < sides; s++) {
          const segKey = `tank_shield_${e.id}_${s}`;
          const active = e.directionalShields[s] > 0;
          if (active) {
            getMesh(segKey, meshes, scene, () => {
              const arcAngle = (Math.PI * 2 / sides) * 0.8; // 80% of segment
              const arc = new THREE.Mesh(
                new THREE.RingGeometry(e.radius * 1.4, e.radius * 1.7, 1, 1, 0, arcAngle),
                new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
              );
              arc.rotation.x = -Math.PI / 2;
              arc.rotation.z = (s / sides) * Math.PI * 2;
              return arc;
            }).position.set(e.x, e.y, 1);
          } else {
            // Remove inactive shield segments
            if (meshes.has(segKey)) {
              const old = meshes.get(segKey);
              scene.remove(old);
              meshes.delete(segKey);
            }
          }
        }
      }

      // Swarm Leader: crown particle pulse effect (emitter ring that pulses)
      if (e.eliteVariant === 'swarmLeader') {
        const crownKey = `swarm_crown_${e.id}`;
        getMesh(crownKey, meshes, scene, () => {
          const crown = new THREE.Mesh(
            new THREE.RingGeometry(e.radius * 0.5, e.radius * 0.9, 6),
            new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
          );
          crown.rotation.x = -Math.PI / 2;
          return crown;
        }).position.set(e.x, e.y, 4 + Math.sin(g.totalTime * 4) * 2);
      }

      // Arsenal: pulsing glow ring
      if (e.eliteVariant === 'arsenal') {
        const glowKey = `arsenal_glow_${e.id}`;
        getMesh(glowKey, meshes, scene, () => {
          const glow = new THREE.Mesh(
            new THREE.RingGeometry(e.radius * 1.1, e.radius * 2.0, 24),
            new THREE.MeshBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
          );
          glow.rotation.x = -Math.PI / 2;
          return glow;
        }).position.set(e.x, e.y, 1);
        // Update pulse opacity
        const glowMesh = meshes.get(glowKey);
        if (glowMesh && glowMesh.material) {
          glowMesh.material.opacity = 0.15 + Math.sin(g.totalTime * 3) * 0.15;
        }
      }
    }
  }

  // Escort drone
  if (g.escort.active && g.escort.hp > 0 && g.escort.respawnTimer <= 0) {
    const esc = g.escort;
    const dm = getMesh('escort', meshes, scene, () => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 12), new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true }));
      body.scale.set(esc.radius, esc.radius, esc.radius);
      group.add(body);
      const ring = new THREE.Mesh(new THREE.RingGeometry(esc.radius * 1.3, esc.radius * 1.5, 16), new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, side: THREE.DoubleSide }));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      return group;
    });
    dm.position.set(esc.x, esc.y, 0);
    dm.children[1].rotation.z += 0.02; // Spin the ring
  }

  // Beacon (defend mission)
  if (g.beacon && g.beacon.active && g.beacon.hp > 0) {
    const bm = getMesh('beacon', meshes, scene, () => {
      const m = new THREE.Mesh(geoms.tetra, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true }));
      m.scale.set(g.beacon.radius, g.beacon.radius, g.beacon.radius);
      return m;
    });
    bm.position.set(g.beacon.x, g.beacon.y, 0);
  }

  // Beacon shield ring
  if (g.beacon && g.beacon.active && g.beacon.hp > 0) {
    const shieldMesh = getMesh('beacon_shield', meshes, scene, () => {
      const ringGeom = new THREE.RingGeometry(g.beacon.radius + 5, g.beacon.radius + 10, 16);
      const m = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.3 }));
      return m;
    });
    shieldMesh.position.set(g.beacon.x, g.beacon.y, 0);
    shieldMesh.rotation.z += 0.01; // Spin the ring
  }

  // Sabotage structures (enemy turrets)
  if (g.sabotage && g.sabotage.active) {
    for (const s of g.sabotage.structures) {
      if (!s.active || s.hp <= 0) continue;
      if (!s.id) s.id = Math.random();
      const key = 'sab_' + s.id;
      const sm = getMesh(key, meshes, scene, () => {
        const m = new THREE.Mesh(
          new THREE.CylinderGeometry(s.radius, s.radius, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xf97316, wireframe: true })
        );
        return m;
      });
      sm.position.set(s.x, s.y, 0);
      sm.rotation.y += 0.02;
    }
  }

  // ─── Environmental hazards ────────────────────────────────────────────────
  if (g.hazards && g.hazards.length > 0) {
    for (const h of g.hazards) {
      if (!h || !h.active) continue;
      const hdx = h.x - g.player.x;
      const hdy = h.y - g.player.y;
      if (hdx * hdx + hdy * hdy > renderDistSq) continue;

      if (h.type === 'asteroid') {
        const am = getMesh(h.id, meshes, scene, () => {
          const m = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.MeshBasicMaterial({ color: 0x6b7280, wireframe: true })
          );
          m.scale.set(h.radius, h.radius, h.radius);
          return m;
        });
        am.position.set(h.x, h.y, 0);
        am.rotation.x = h.rotX || 0;
        am.rotation.y = h.rotY || 0;
      } else if (h.type === 'gravityWell') {
        // Inner ring
        const innerKey = h.id + '_inner';
        const inner = getMesh(innerKey, meshes, scene, () => {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(h.radius * 0.3, h.radius * 0.5, 24),
            new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
          );
          ring.rotation.x = -Math.PI / 2;
          return ring;
        });
        inner.position.set(h.x, h.y, 0);
        inner.rotation.z += 0.02;
        // Outer ring
        const outerKey = h.id + '_outer';
        const outer = getMesh(outerKey, meshes, scene, () => {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(h.radius * 0.6, h.radius * 0.8, 24),
            new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
          );
          ring.rotation.x = -Math.PI / 2;
          return ring;
        });
        outer.position.set(h.x, h.y, 0);
        outer.rotation.z -= 0.01;
        // Center marker
        const centerKey = h.id + '_gw_center';
        const center = getMesh(centerKey, meshes, scene, () => {
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true })
          );
          m.scale.set(h.radius * 0.15, h.radius * 0.15, h.radius * 0.15);
          return m;
        });
        center.position.set(h.x, h.y, 0);
      } else if (h.type === 'plasmaStorm') {
        // Storm zone disc
        const stormKey = h.id + '_zone';
        const storm = getMesh(stormKey, meshes, scene, () => {
          const disc = new THREE.Mesh(
            new THREE.CircleGeometry(1, 32),
            new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
          );
          disc.rotation.x = -Math.PI / 2;
          return disc;
        });
        storm.position.set(h.x, h.y, 0);
        storm.scale.set(h.radius, h.radius, h.radius);
        // Edge ring
        const edgeKey = h.id + '_edge';
        const edge = getMesh(edgeKey, meshes, scene, () => {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.9, 1, 32),
            new THREE.MeshBasicMaterial({ color: 0xc084fc, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
          );
          ring.rotation.x = -Math.PI / 2;
          return ring;
        });
        edge.position.set(h.x, h.y, 0);
        edge.scale.set(h.radius, h.radius, h.radius);
        edge.rotation.z += 0.01;
      } else if (h.type === 'emp') {
        // Hexagonal zone outline
        const empKey = h.id + '_hex';
        const emp = getMesh(empKey, meshes, scene, () => {
          const m = new THREE.Mesh(
            new THREE.RingGeometry(h.radius * 0.85, h.radius, 6),
            new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: h.empActive ? 0.8 : 0.25 })
          );
          m.rotation.x = -Math.PI / 2;
          return m;
        });
        emp.position.set(h.x, h.y, 0);
        emp.rotation.z += 0.005;
        // Update opacity based on active state
        if (emp.material) emp.material.opacity = h.empActive ? 0.8 : 0.25;
        // Center marker
        const empCenterKey = h.id + '_emp_center';
        const empCenter = getMesh(empCenterKey, meshes, scene, () => {
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(1, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true })
          );
          m.scale.set(5, 5, 5);
          return m;
        });
        empCenter.position.set(h.x, h.y, 0);
      }
    }
  }

  // Boss (large wireframe, geometry/color from variant)
  if (g.boss && g.boss.active && g.boss.hp > 0) {
    const boss = g.boss;
    const bdx = boss.x - g.player.x;
    const bdy = boss.y - g.player.y;
    if (bdx * bdx + bdy * bdy <= renderDistSq) {
      const bm = getMesh('boss', meshes, scene, () => {
        const group = new THREE.Group();
        const geoType = boss.geometry || 'box';
        const geoMap = {
          box: () => new THREE.BoxGeometry(1, 1, 1),
          octahedron: () => new THREE.OctahedronGeometry(1, 0),
          dodecahedron: () => new THREE.DodecahedronGeometry(1, 0),
          tetrahedron: () => new THREE.TetrahedronGeometry(1, 0),
          icosahedron: () => new THREE.IcosahedronGeometry(1, 0),
        };
        const geoFn = geoMap[geoType] || geoMap.box;
        const body = new THREE.Mesh(
          geoFn(),
          new THREE.MeshBasicMaterial({ color: boss.color || 0xdc2626, wireframe: true })
        );
        body.scale.set(boss.radius * 2, boss.radius * 2, boss.radius * 2);
        group.add(body);
        // Inner glow
        const inner = new THREE.Mesh(
          geoFn(),
          new THREE.MeshBasicMaterial({ color: boss.innerColor || 0xff4444, wireframe: true, transparent: true, opacity: 0.5 })
        );
        inner.scale.set(boss.radius * 1.2, boss.radius * 1.2, boss.radius * 1.2);
        group.add(inner);
        return group;
      });
      bm.position.set(boss.x, boss.y, 0);
      bm.rotation.y += 0.01;
      bm.rotation.x += 0.005;

      // Rage aura ring (pulsing ring around enraged boss)
      if (boss.rage) {
        const rageCfg = GAME_CONFIG.boss.rage;
        const auraKey = 'boss_rage_aura';
        if (!meshes.has(auraKey)) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(1, 1.08, 32),
            new THREE.MeshBasicMaterial({ color: rageCfg.rageColor, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
          );
          ring.rotation.x = -Math.PI / 2;
          scene.add(ring);
          meshes.set(auraKey, ring);
        }
        const auraMesh = meshes.get(auraKey);
        auraMesh.position.set(boss.x, boss.y, 0.5);
        const pulse = (Math.sin(boss.rageAuraTimer * (Math.PI * 2 / rageCfg.auraPulsePeriod)) + 1) / 2;
        const auraRadius = rageCfg.auraBaseRadius + pulse * (rageCfg.auraMaxRadius - rageCfg.auraBaseRadius);
        auraMesh.scale.set(auraRadius * 2, auraRadius * 2, 1);
        auraMesh.material.opacity = 0.3 + pulse * 0.3;
      }

      // ── Shield regen aura (green ring around boss when regenerating) ──
      if (boss.regenActive) {
        const regenKey = 'boss_shield_regen_aura';
        if (!meshes.has(regenKey)) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(1, 1.12, 32),
            new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
          );
          ring.rotation.x = -Math.PI / 2;
          scene.add(ring);
          meshes.set(regenKey, ring);
        }
        const regenMesh = meshes.get(regenKey);
        regenMesh.position.set(boss.x, boss.y, 1);
        const regenPulse = (Math.sin(g.totalTime * 4) + 1) / 2;
        const regenRadius = boss.radius * 1.6 + regenPulse * boss.radius * 0.3;
        regenMesh.scale.set(regenRadius * 2, regenRadius * 2, 1);
        regenMesh.material.opacity = 0.2 + regenPulse * 0.3;
      }
    }
  }

  // ── Void zones (dark purple circles with pulsing edges) ──
  if (g.boss && g.boss.voidZones && g.boss.voidZones.length > 0) {
    for (const zone of g.boss.voidZones) {
      if (!zone.active) continue;
      const zdx = zone.x - g.player.x;
      const zdy = zone.y - g.player.y;
      if (zdx * zdx + zdy * zdy > renderDistSq) continue;

      const lifeRatio = zone.maxLife > 0 ? zone.life / zone.maxLife : 0;

      // Dark purple fill disc
      const fillKey = `void_zone_fill_${g.boss.voidZones.indexOf(zone)}`;
      const fillMesh = getMesh(fillKey, meshes, scene, () => {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(1, 24),
          new THREE.MeshBasicMaterial({ color: 0x2d1b69, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
        );
        disc.rotation.x = -Math.PI / 2;
        return disc;
      });
      fillMesh.position.set(zone.x, zone.y, -0.5);
      fillMesh.scale.set(zone.radius, zone.radius, 1);
      fillMesh.material.opacity = 0.25 + lifeRatio * 0.25;

      // Pulsing edge ring
      const edgeKey = `void_zone_edge_${g.boss.voidZones.indexOf(zone)}`;
      const edgeMesh = getMesh(edgeKey, meshes, scene, () => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.9, 1, 24),
          new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        return ring;
      });
      const voidPulse = (Math.sin(g.totalTime * 3 + zone.x * 0.01) + 1) / 2;
      const edgeRadius = zone.radius * (1 + voidPulse * 0.08);
      edgeMesh.position.set(zone.x, zone.y, 0);
      edgeMesh.scale.set(edgeRadius, edgeRadius, 1);
      edgeMesh.material.opacity = 0.3 + voidPulse * 0.5;
    }
  }

  // ── Phase shift decoy (semi-transparent boss mesh) ──
  if (g.boss && g.boss.decoy && g.boss.decoy.active) {
    const decoy = g.boss.decoy;
    const ddx = decoy.x - g.player.x;
    const ddy = decoy.y - g.player.y;
    if (ddx * ddx + ddy * ddy <= renderDistSq) {
      const lifeRatio = decoy.maxLife > 0 ? decoy.life / decoy.maxLife : 0;
      const dm = getMesh('boss_decoy', meshes, scene, () => {
        const group = new THREE.Group();
        const geoType = g.boss.geometry || 'box';
        const geoMap = {
          box: () => new THREE.BoxGeometry(1, 1, 1),
          octahedron: () => new THREE.OctahedronGeometry(1, 0),
          dodecahedron: () => new THREE.DodecahedronGeometry(1, 0),
          tetrahedron: () => new THREE.TetrahedronGeometry(1, 0),
          icosahedron: () => new THREE.IcosahedronGeometry(1, 0),
        };
        const geoFn = geoMap[geoType] || geoMap.box;
        const body = new THREE.Mesh(
          geoFn(),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.4 })
        );
        body.scale.set(decoy.radius * 2, decoy.radius * 2, decoy.radius * 2);
        group.add(body);
        return group;
      });
      dm.position.set(decoy.x, decoy.y, 0);
      dm.rotation.y += 0.015;
      dm.rotation.x += 0.008;
      // Fade out as decoy expires
      dm.children.forEach(child => {
        if (child.material) child.material.opacity = 0.15 + lifeRatio * 0.35;
      });
    }
  }

  // Mini-boss (medium wireframe, geometry/color from variant)
  if (g.miniboss && g.miniboss.active && g.miniboss.hp > 0) {
    const mb = g.miniboss;
    const mdx = mb.x - g.player.x;
    const mdy = mb.y - g.player.y;
    if (mdx * mdx + mdy * mdy <= renderDistSq) {
      const mm = getMesh('miniboss', meshes, scene, () => {
        const group = new THREE.Group();
        const geoType = mb.geometry || 'box';
        const geoMap = {
          box: () => new THREE.BoxGeometry(1, 1, 1),
          octahedron: () => new THREE.OctahedronGeometry(1, 0),
          dodecahedron: () => new THREE.DodecahedronGeometry(1, 0),
          tetrahedron: () => new THREE.TetrahedronGeometry(1, 0),
          icosahedron: () => new THREE.IcosahedronGeometry(1, 0),
        };
        const geoFn = geoMap[geoType] || geoMap.box;
        const body = new THREE.Mesh(
          geoFn(),
          new THREE.MeshBasicMaterial({ color: mb.color || 0xf97316, wireframe: true })
        );
        body.scale.set(mb.radius * 2, mb.radius * 2, mb.radius * 2);
        group.add(body);
        // Inner glow
        const inner = new THREE.Mesh(
          geoFn(),
          new THREE.MeshBasicMaterial({ color: mb.innerColor || 0xfb923c, wireframe: true, transparent: true, opacity: 0.5 })
        );
        inner.scale.set(mb.radius * 1.2, mb.radius * 1.2, mb.radius * 1.2);
        group.add(inner);
        return group;
      });
      mm.position.set(mb.x, mb.y, 0);
      mm.rotation.y += 0.01;
      mm.rotation.x += 0.005;

      // Rage aura ring for mini-bosses too
      if (mb.rage) {
        const rageCfg = GAME_CONFIG.boss.rage;
        const auraKey = 'miniboss_rage_aura';
        if (!meshes.has(auraKey)) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(1, 1.08, 32),
            new THREE.MeshBasicMaterial({ color: rageCfg.rageColor, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
          );
          ring.rotation.x = -Math.PI / 2;
          scene.add(ring);
          meshes.set(auraKey, ring);
        }
        const auraMesh = meshes.get(auraKey);
        auraMesh.position.set(mb.x, mb.y, 0.5);
        const pulse = (Math.sin(mb.rageAuraTimer * (Math.PI * 2 / rageCfg.auraPulsePeriod)) + 1) / 2;
        const auraRadius = rageCfg.auraBaseRadius * 0.7 + pulse * (rageCfg.auraMaxRadius - rageCfg.auraBaseRadius) * 0.7;
        auraMesh.scale.set(auraRadius * 2, auraRadius * 2, 1);
        auraMesh.material.opacity = 0.25 + pulse * 0.25;
      }
    }
  }

  // Destination marker
  if (g.escort.active && g.escort.hp > 0) {
    const dest = g.escort;
    const destKey = 'escort_dest';
    if (!meshes.has(destKey)) {
      const marker = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.RingGeometry(25, 35, 24), new THREE.MeshBasicMaterial({ color: 0x22ff22, wireframe: true, side: THREE.DoubleSide }));
      outer.rotation.x = -Math.PI / 2;
      marker.add(outer);
      const inner = new THREE.Mesh(new THREE.RingGeometry(10, 15, 16), new THREE.MeshBasicMaterial({ color: 0x22ff22, wireframe: true, side: THREE.DoubleSide }));
      inner.rotation.x = -Math.PI / 2;
      marker.add(inner);
      scene.add(marker);
      meshes.set(destKey, marker);
    }
    _activeKeys.add(destKey);
    const destMesh = meshes.get(destKey);
    destMesh.position.set(dest.targetX, dest.targetY, 0);
    destMesh.children.forEach(c => c.rotation.z += 0.01);
  }

  // Particles
  for (let p of g.particles) {
    if (!p.active) continue;
    const m = getMesh(`part_${p.id ?? p}`, meshes, scene, () => { const m = new THREE.Mesh(geoms.box, new THREE.MeshBasicMaterial({ color: p.color ?? 0x39ff14, wireframe: true, transparent: true })); m.scale.set(3,3,3); return m; });
    if (m.material && p.color !== undefined) m.material.color.set(p.color);
    m.position.set(p.x, p.y, p.z||0); m.material.opacity = p.maxLife ? p.life / p.maxLife : Math.min(1, p.life);
  }

  // Death pulse shockwave rings
  if (g.deathPulses) {
    for (const pulse of g.deathPulses) {
      if (!pulse.active) continue;
      const lifeRatio = pulse.maxLife ? pulse.life / pulse.maxLife : 0;
      const m = getMesh(`dpulse_${pulse.id}`, meshes, scene, () => {
        const ring = new THREE.Mesh(
          geoms.deathPulseRing,
          new THREE.MeshBasicMaterial({ color: pulse.color ?? 0xf97316, transparent: true, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        return ring;
      });
      // Scale ring to current radius (base geometry is unit ring, scale by maxRadius * progress)
      const scale = pulse.maxRadius > 0 ? pulse.radius : 0;
      m.scale.set(scale, scale, 1);
      m.position.set(pulse.x, pulse.y, 1);
      // Fade: bright at start, fade toward end
      m.material.opacity = Math.max(0, lifeRatio * 0.8);
    }
  }

  // Enemy spawn flash rings — expanding red rings at spawn locations
  if (g.spawnFlashes) {
    for (const flash of g.spawnFlashes) {
      if (!flash.active) continue;
      const lifeRatio = flash.maxLife ? flash.life / flash.maxLife : 0;
      const adx = flash.x - g.player.x;
      const ady = flash.y - g.player.y;
      if (adx * adx + ady * ady > renderDistSq) continue;
      const flashKey = flash.id ?? `${flash.x}_${flash.y}_${flash.maxLife ?? 0}`;
      const m = getMesh(`sflash_${flashKey}`, meshes, scene, () => {
        const ring = new THREE.Mesh(
          geoms.deathPulseRing,
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = -Math.PI / 2;
        return ring;
      });
      const scale = flash.maxRadius > 0 ? flash.radius : 0;
      m.scale.set(scale, scale, 1);
      m.position.set(flash.x, flash.y, 0.5);
      // Bright at start, fade quickly
      m.material.opacity = Math.max(0, lifeRatio * 0.7);
    }
  }

  // Attack warning indicators in 3D — red wireframe circles on the ground plane
  if (g.attackWarnings) {
    for (const aw of g.attackWarnings) {
      if (!aw.active) continue;
      const adx = aw.x - g.player.x;
      const ady = aw.y - g.player.y;
      if (adx * adx + ady * ady > renderDistSq) continue;
      const lifeRatio = aw.maxLife > 0 ? aw.life / aw.maxLife : 0;
      const urgency = 1 - lifeRatio;
      const m = getMesh(`awarn_${aw.id}`, meshes, scene, () => {
        const group = new THREE.Group();
        // Outer ring
        const outer = new THREE.Mesh(
          new THREE.RingGeometry(aw.radius * 0.7, aw.radius, 24),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, side: THREE.DoubleSide, depthWrite: false })
        );
        outer.rotation.x = -Math.PI / 2;
        group.add(outer);
        // Inner fill
        const inner = new THREE.Mesh(
          new THREE.CircleGeometry(aw.radius * 0.5, 16),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, side: THREE.DoubleSide, depthWrite: false })
        );
        inner.rotation.x = -Math.PI / 2;
        group.add(inner);
        // Crosshair lines
        const crossH = new THREE.Mesh(
          new THREE.PlaneGeometry(aw.radius * 2, 0.3),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, side: THREE.DoubleSide, depthWrite: false })
        );
        crossH.rotation.x = -Math.PI / 2;
        group.add(crossH);
        const crossV = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, aw.radius * 2),
          new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, side: THREE.DoubleSide, depthWrite: false })
        );
        crossV.rotation.x = -Math.PI / 2;
        group.add(crossV);
        return group;
      });
      m.position.set(aw.x, aw.y, 0.5);
      // Pulse: scale oscillates based on urgency
      const pulse = 1 + 0.15 * Math.sin(urgency * 20);
      m.scale.set(pulse, pulse, 1);
      // Fade: more opaque as urgency increases
      const baseAlpha = 0.3 + 0.5 * urgency;
      m.children.forEach(child => {
        if (child.material) child.material.opacity = baseAlpha;
      });
    }
  }

  // Laser effects
  for (let e of g.effects) {
    if (e.type !== 'laser') continue;
    const m = getMesh(`fx_${e.id ?? e}`, meshes, scene, () => new THREE.Line(new THREE.BufferGeometry(), mats.laser.clone()));
    if (e.source && e.target) {
      _laserV1.set(e.source.x, e.source.y, 0);
      _laserV2.set(e.target.x, e.target.y, 0);
      m.geometry.setFromPoints([_laserV1, _laserV2]);
    }
    m.material.opacity = Math.min(1, e.life * 10);
  }

  // Cleanup dead objects — dispose geometries/materials to free GPU memory
  // Run every CLEANUP_INTERVAL frames to avoid O(N) map scan every frame
  _cleanupFrameCounter++;
  if (_cleanupFrameCounter >= CLEANUP_INTERVAL) {
    _cleanupFrameCounter = 0;
    const disposeMesh = (mesh) => {
      if (mesh.geometry && !_sharedGeos.has(mesh.geometry)) mesh.geometry.dispose();
      if (mesh.material) {
        const matArr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of matArr) {
          if (!_sharedMats.has(mat)) mat.dispose();
        }
      }
      if (mesh.children) {
        for (const child of mesh.children) disposeMesh(child);
      }
    };
    for (let [obj, mesh] of meshes.entries()) {
      if (!_activeKeys.has(obj)) {
        disposeMesh(mesh);
        scene.remove(mesh);
        meshes.delete(obj);
      }
    }
  }

  renderer.render(scene, camera);

  // ─── Weather Visual Effects ──────────────────────────────────────────────────
  if (!g.weather || g.weather.active.length === 0) return;

  const weather = g.weather;

  // ── Solar flare: white flash overlay ──
  if (weather.active.includes('solarFlare') && weather.solarFlare.active) {
    const sfAlpha = GAME_CONFIG.weather.types.solarFlare.screenAlpha;
    const pulse = (Math.sin(g.totalTime * 8) + 1) / 2; // 0-1 pulsing
    const alpha = sfAlpha * (0.7 + pulse * 0.3);
    // White flash overlay
    const flashKey = 'weather_solar_flare';
    if (!meshes.has(flashKey)) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: alpha, side: THREE.DoubleSide })
      );
      plane.position.z = 1; // slightly behind other content
      scene.add(plane);
      meshes.set(flashKey, plane);
    }
    const flashMesh = meshes.get(flashKey);
    // Always face camera
    flashMesh.position.set(g.player.x, g.player.y, 1);
    flashMesh.material.opacity = alpha;
  } else {
    // Remove solar flare mesh when not active
    const flashKey = 'weather_solar_flare';
    if (meshes.has(flashKey)) {
      const m = meshes.get(flashKey);
      scene.remove(m);
      meshes.delete(flashKey);
    }
  }

  // ── Debris field: gray rock meshes ──
  if (weather.active.includes('debrisField')) {
    for (const cluster of weather.debris) {
      if (!cluster.active) continue;
      const dx = cluster.x - g.player.x;
      const dy = cluster.y - g.player.y;
      if (dx * dx + dy * dy > renderDistSq) continue;

      const debrisKey = `weather_debris_${cluster.x.toFixed(0)}_${cluster.y.toFixed(0)}`;
      getMesh(debrisKey, meshes, scene, () => {
        const group = new THREE.Group();
        // Main rock body
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1, 0),
          new THREE.MeshBasicMaterial({ color: 0x6b7280, wireframe: true })
        );
        rock.scale.set(cluster.radius, cluster.radius * 0.7, cluster.radius * 0.7);
        group.add(rock);
        // Danger ring
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(cluster.radius * 0.8, cluster.radius, 12),
          new THREE.MeshBasicMaterial({ color: 0x9ca3af, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
        );
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        return group;
      }).position.set(cluster.x, cluster.y, 0);
    }
  }

  // ── Gravity anomaly: purple circles ──
  if (weather.active.includes('gravityAnomaly')) {
    for (const zone of weather.gravityZones) {
      if (!zone.active) continue;
      const dx = zone.x - g.player.x;
      const dy = zone.y - g.player.y;
      if (dx * dx + dy * dy > renderDistSq) continue;

      const gravKey = `weather_grav_${zone.x.toFixed(0)}_${zone.y.toFixed(0)}`;
      getMesh(gravKey, meshes, scene, () => {
        const group = new THREE.Group();
        // Inner ring
        const inner = new THREE.Mesh(
          new THREE.RingGeometry(zone.radius * 0.3, zone.radius * 0.5, 24),
          new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
        );
        inner.rotation.x = -Math.PI / 2;
        group.add(inner);
        // Outer ring
        const outer = new THREE.Mesh(
          new THREE.RingGeometry(zone.radius * 0.6, zone.radius, 24),
          new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.3 })
        );
        outer.rotation.x = -Math.PI / 2;
        group.add(outer);
        // Center marker
        const center = new THREE.Mesh(
          new THREE.SphereGeometry(1, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true })
        );
        center.scale.set(5, 5, 5);
        group.add(center);
        return group;
      }).position.set(zone.x, zone.y, 0);
    }
  }

  // ── EMI: yellow static overlay ──
  if (weather.active.includes('electromagneticInterference') && weather.emi.active) {
    const emiPulse = (Math.sin(g.totalTime * 6) + 1) / 2;
    const emiAlpha = 0.15 + emiPulse * 0.1;
    const emiKey = 'weather_emi_overlay';
    if (!meshes.has(emiKey)) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshBasicMaterial({ color: 0xeab308, transparent: true, opacity: emiAlpha, side: THREE.DoubleSide })
      );
      plane.position.z = 0.5;
      scene.add(plane);
      meshes.set(emiKey, plane);
    }
    const emiMesh = meshes.get(emiKey);
    emiMesh.position.set(g.player.x, g.player.y, 0.5);
    emiMesh.material.opacity = emiAlpha;
  } else {
    const emiKey = 'weather_emi_overlay';
    if (meshes.has(emiKey)) {
      const m = meshes.get(emiKey);
      scene.remove(m);
      meshes.delete(emiKey);
    }
  }
};
