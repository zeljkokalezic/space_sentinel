/**
 * renderer3d.js — Three.js scene setup and per-frame 3D rendering.
 * No React imports. Receives plain objects / DOM refs.
 */
import * as THREE from 'three';
import { SHIP_SKINS } from '../constants/skins';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const raycastToPlane = (clientX, clientY, camera) => {
  const ndcX = (clientX / window.innerWidth) * 2 - 1;
  const ndcY = -(clientY / window.innerHeight) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  if (!target) return null;
  return { x: target.x, y: target.y };
};

export const projectToScreen = (camera, wx, wy, wz = 0) => {
  const v = new THREE.Vector3(wx, wy, wz);
  v.project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    visible: v.z < 1,
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
  const activeKeys = new Set();

  const getMesh = (obj, createFn) => {
    if (!meshes.has(obj)) { const m = createFn(); scene.add(m); meshes.set(obj, m); }
    activeKeys.add(obj);
    return meshes.get(obj);
  };

  // Chase camera
  const playerYaw = g.player.yaw ?? Math.PI / 2;
  const camFwdX = Math.cos(playerYaw), camFwdY = Math.sin(playerYaw);
  camera.position.lerp(new THREE.Vector3(g.player.x - camFwdX * 220, g.player.y - camFwdY * 220, 120), 0.03);
  camera.up.set(0, 0, 1);
  camera.lookAt(new THREE.Vector3(g.player.x + camFwdX * 80, g.player.y + camFwdY * 80, 0));
  camera.updateMatrixWorld(true);
  const freshWM = raycastToPlane(g.mouse.x || window.innerWidth / 2, g.mouse.y || window.innerHeight / 2, camera);
  if (freshWM) g.worldMouse = freshWM;

  // Stars
  for (let s of g.stars) {
    const sm = getMesh(s, () => {
      const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color: 0x006400, wireframe: true, transparent: true, opacity: s.size / 3 }));
      m.scale.set(s.size, s.size, s.size); return m;
    });
    sm.position.set(s.x, s.y, s.z);
  }

  // Player ship
  const pm = getMesh(g.player, () => {
    const group = new THREE.Group();
    group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(40, 60, 20), mats.player)));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(80, 20, 10), mats.player); wing.position.set(0, -10, -5); group.add(wing);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(20, 15, 10), mats.player); bridge.position.set(0, 10, 10); group.add(bridge);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), mats.shield); shield.scale.set(42, 42, 42); shield.name = 'shield'; group.add(shield);
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

  const shieldMesh = pm.children.find(c => c.name === 'shield');
  if (shieldMesh) { shieldMesh.visible = g.player.maxShield > 0; shieldMesh.material.opacity = Math.max(0.1, 0.5 * (g.player.shield / g.player.maxShield)); }

  // Apply active skin colors to player mesh
  const skinIdx = Math.max(0, Math.min(g.shipSkin ?? 0, SHIP_SKINS.length - 1));
  const skin = SHIP_SKINS[skinIdx];
  const updateMaterials = (obj, color) => {
    if (obj.material) obj.material.color.setHex(color);
    if (obj.children) obj.children.forEach(c => updateMaterials(c, color));
  };
  pm.children.forEach(child => {
    if (child.name === 'shield') return; // shield handled separately
    if (child.name === 'engineL' || child.name === 'engineR') {
      // Engine glow uses skin.engineGlow
      if (child.material) child.material.color.setHex(skin.engineGlow);
      return;
    }
    updateMaterials(child, skin.hullColor);
  });
  if (shieldMesh && shieldMesh.material) {
    shieldMesh.material.color.setHex(skin.accentColor);
  }

  // Dynamic turrets
  const turretsGroup = pm.children.find(c => c.name === 'turrets');
  if (turretsGroup) {
    const hash = Object.values(g.levels).join('-');
    if (pm.userData.levelsHash !== hash) {
      pm.userData.levelsHash = hash;
      turretsGroup.clear();

      const addTurret = (x, y, isDouble) => {
        const tg = new THREE.Group(); tg.position.set(x, -y, 10);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 6, 12), mats.player); base.rotation.x = Math.PI / 2; tg.add(base);
        if (isDouble) {
          const b1 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player); b1.position.set(-3.5, 7.5, 0); tg.add(b1);
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player); b2.position.set(3.5, 7.5, 0); tg.add(b2);
        } else { const b = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player); b.position.set(0, 7.5, 0); tg.add(b); }
        tg.userData.isAiming = true; turretsGroup.add(tg);
      };
      const addMissilePod = (x, y) => {
        const mg = new THREE.Group(); mg.position.set(x, -y, 5);
        mg.add(new THREE.Mesh(new THREE.BoxGeometry(12, 18, 9), mats.player)); turretsGroup.add(mg);
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
    const m = getMesh(p, () => { const m = new THREE.Mesh(geoms.tetra, mats.pickup); m.scale.set(p.radius, p.radius, p.radius); return m; });
    m.position.set(p.x, p.y, 0); m.rotation.x += 0.05; m.rotation.y += 0.05;
  }

  // Power-ups
  for (let pu of g.powerups) {
    if (!pu.active) continue;
    const dx = pu.x - g.player.x;
    const dy = pu.y - g.player.y;
    if (dx * dx + dy * dy > renderDistSq) continue;
    const m = getMesh(pu, () => {
      const m = new THREE.Mesh(geoms.box, new THREE.MeshBasicMaterial({ color: pu.color ? parseInt(pu.color.slice(1), 16) : 0xfbbf24, wireframe: true }));
      m.scale.set(pu.radius, pu.radius, pu.radius);
      return m;
    });
    m.position.set(pu.x, pu.y, Math.sin(g.totalTime * 3 + pu.id * 10) * 5);
    m.rotation.x += 0.05;
    m.rotation.y += 0.05;
  }

  // Projectiles (with distance culling)
  for (let p of g.projectiles) {
    if (!p.active) continue;
    const dx = p.x - g.player.x;
    const dy = p.y - g.player.y;
    if (dx * dx + dy * dy > renderDistSq) continue;
    const m = getMesh(p, () => {
      const col = p.isEnemy ? 0xd946ef : 0xff0000;
      const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color: col, wireframe: true }));
      m.scale.set(p.radius, p.radius, p.radius); return m;
    });
    m.position.set(p.x, p.y, 0);
    if (p.type === 'missile' || p.type === 'enemy_missile') { m.scale.set(p.radius*0.5, p.radius*2, p.radius*0.5); m.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI/2; }
  }

  // Enemies (with distance culling and LOD)
  for (let e of g.enemies) {
    if (!e.active) continue;
    const dx = e.x - g.player.x;
    const dy = e.y - g.player.y;
    const distSq = dx * dx + dy * dy;
    if (distSq > renderDistSq) continue;
    const m = getMesh(e, () => {
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
    m.rotation.z = Math.atan2(-(g.player.y-e.y), g.player.x-e.x) - Math.PI/2;
    // LOD: reduce detail for distant enemies (toggle — apply only once)
    const dist = Math.sqrt(distSq);
    if (dist > 1000 && !m.userData.lodApplied) {
      m.scale.multiplyScalar(0.8);
      m.userData.lodApplied = true;
    } else if (dist <= 1000 && m.userData.lodApplied) {
      m.scale.multiplyScalar(1.25);
      m.userData.lodApplied = false;
    }
  }

  // Escort drone
  if (g.escort.active && g.escort.hp > 0 && g.escort.respawnTimer <= 0) {
    const esc = g.escort;
    const dm = getMesh(esc, () => {
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
    const bm = getMesh(g.beacon, () => {
      const m = new THREE.Mesh(geoms.tetra, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true }));
      m.scale.set(g.beacon.radius, g.beacon.radius, g.beacon.radius);
      return m;
    });
    bm.position.set(g.beacon.x, g.beacon.y, 0);
  }

  // Beacon shield ring
  if (g.beacon && g.beacon.active && g.beacon.hp > 0) {
    const shieldMesh = getMesh(g.beacon + '_shield', () => {
      const ringGeom = new THREE.RingGeometry(g.beacon.radius + 5, g.beacon.radius + 10, 16);
      const m = new THREE.Mesh(ringGeom, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.3 }));
      return m;
    });
    shieldMesh.position.set(g.beacon.x, g.beacon.y, 0);
  }

  // Sabotage structures (enemy turrets)
  if (g.sabotage && g.sabotage.active) {
    for (const s of g.sabotage.structures) {
      if (!s.active || s.hp <= 0) continue;
      if (!s.id) s.id = Math.random();
      const key = 'sab_' + s.id;
      const sm = getMesh(key, () => {
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
        const am = getMesh(h.id, () => {
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
        const inner = getMesh(innerKey, () => {
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
        const outer = getMesh(outerKey, () => {
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
        const centerKey = h.id + '_center';
        const center = getMesh(centerKey, () => {
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
        const storm = getMesh(stormKey, () => {
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
        const edge = getMesh(edgeKey, () => {
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
        const emp = getMesh(empKey, () => {
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
        const empCenterKey = h.id + '_center';
        const empCenter = getMesh(empCenterKey, () => {
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

  // Boss (large red wireframe box)
  if (g.boss && g.boss.active && g.boss.hp > 0) {
    const boss = g.boss;
    const bdx = boss.x - g.player.x;
    const bdy = boss.y - g.player.y;
    if (bdx * bdx + bdy * bdy <= renderDistSq) {
      const bm = getMesh(boss, () => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0xdc2626, wireframe: true })
        );
        body.scale.set(boss.radius * 2, boss.radius * 2, boss.radius * 2);
        group.add(body);
        // Inner glow
        const inner = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0xff4444, wireframe: true, transparent: true, opacity: 0.5 })
        );
        inner.scale.set(boss.radius * 1.2, boss.radius * 1.2, boss.radius * 1.2);
        group.add(inner);
        return group;
      });
      bm.position.set(boss.x, boss.y, 0);
      bm.rotation.y += 0.01;
      bm.rotation.x += 0.005;
    }
  }

  // Mini-boss (medium orange wireframe box)
  if (g.miniboss && g.miniboss.active && g.miniboss.hp > 0) {
    const mb = g.miniboss;
    const mdx = mb.x - g.player.x;
    const mdy = mb.y - g.player.y;
    if (mdx * mdx + mdy * mdy <= renderDistSq) {
      const mm = getMesh(mb, () => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0xf97316, wireframe: true })
        );
        body.scale.set(mb.radius * 2, mb.radius * 2, mb.radius * 2);
        group.add(body);
        // Inner glow
        const inner = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial({ color: 0xfb923c, wireframe: true, transparent: true, opacity: 0.5 })
        );
        inner.scale.set(mb.radius * 1.2, mb.radius * 1.2, mb.radius * 1.2);
        group.add(inner);
        return group;
      });
      mm.position.set(mb.x, mb.y, 0);
      mm.rotation.y += 0.01;
      mm.rotation.x += 0.005;
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
    activeKeys.add(destKey);
    const destMesh = meshes.get(destKey);
    destMesh.position.set(dest.targetX, dest.targetY, 0);
    destMesh.children.forEach(c => c.rotation.z += 0.01);
  }

  // Particles
  for (let p of g.particles) {
    if (!p.active) continue;
    const m = getMesh(p, () => { const m = new THREE.Mesh(geoms.box, new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, transparent: true })); m.scale.set(3,3,3); return m; });
    m.position.set(p.x, p.y, p.z||0); m.material.opacity = p.life / p.maxLife;
  }

  // Laser effects
  for (let e of g.effects) {
    if (e.type !== 'laser') continue;
    const m = getMesh(e, () => new THREE.Line(new THREE.BufferGeometry(), mats.laser));
    if (e.source && e.target) m.geometry.setFromPoints([new THREE.Vector3(e.source.x,e.source.y,0), new THREE.Vector3(e.target.x,e.target.y,0)]);
    m.material.opacity = Math.min(1, e.life * 10);
  }

  // Cleanup dead objects
  for (let [obj, mesh] of meshes.entries()) { if (!activeKeys.has(obj)) { scene.remove(mesh); meshes.delete(obj); } }

  renderer.render(scene, camera);
};
