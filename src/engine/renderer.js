/**
 * renderer.js — Three.js scene setup and per-frame rendering.
 * No React imports. Receives plain objects / DOM refs.
 */
import * as THREE from 'three';

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

// ─── Draw frame ───────────────────────────────────────────────────────────────

export const drawFrame = (threeObj, g, canvasEl, statusRef) => {
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
          const b2 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player); b2.position.set(3.5, 7.5, 0);  tg.add(b2);
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

  // Pickups
  for (let p of g.pickups) {
    if (!p.active) continue;
    const m = getMesh(p, () => { const m = new THREE.Mesh(geoms.tetra, mats.pickup); m.scale.set(p.radius, p.radius, p.radius); return m; });
    m.position.set(p.x, p.y, 0); m.rotation.x += 0.05; m.rotation.y += 0.05;
  }

  // Projectiles
  for (let p of g.projectiles) {
    if (!p.active) continue;
    const m = getMesh(p, () => {
      const col = p.isEnemy ? 0xd946ef : 0xff0000;
      const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color: col, wireframe: true }));
      m.scale.set(p.radius, p.radius, p.radius); return m;
    });
    m.position.set(p.x, p.y, 0);
    if (p.type === 'missile' || p.type === 'enemy_missile') { m.scale.set(p.radius*0.5, p.radius*2, p.radius*0.5); m.rotation.z = Math.atan2(p.vy, p.vx) - Math.PI/2; }
  }

  // Enemies
  for (let e of g.enemies) {
    if (!e.active) continue;
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
    m.material.opacity = e.life * 10;
  }

  // Cleanup dead objects
  for (let [obj, mesh] of meshes.entries()) { if (!activeKeys.has(obj)) { scene.remove(mesh); meshes.delete(obj); } }

  renderer.render(scene, camera);

  // ── 2D HUD ──────────────────────────────────────────────────────────────────
  if (!canvasEl || (statusRef.current !== 'playing' && statusRef.current !== 'shop')) return;
  const w = window.innerWidth, h = window.innerHeight;
  canvasEl.width = w; canvasEl.height = h;
  const c = canvasEl.getContext('2d');
  c.clearRect(0, 0, w, h);

  // Top bar
  c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(0,0,w,60);
  c.fillStyle='#ef4444'; c.fillRect(20,15,200,12);
  c.fillStyle='#22c55e'; c.fillRect(20,15,200*Math.max(0,g.player.hp/g.player.maxHp),12);
  if (g.player.maxShield>0) { c.fillStyle='rgba(255,255,255,0.2)'; c.fillRect(20,32,200,6); c.fillStyle='#3b82f6'; c.fillRect(20,32,200*Math.max(0,g.player.shield/g.player.maxShield),6); }
  c.fillStyle='#ffffff'; c.font='bold 12px sans-serif'; c.textAlign='left';
  c.fillText(`HULL: ${Math.ceil(g.player.hp)} / ${g.player.maxHp}`, 230, 25);
  c.fillStyle='#facc15'; c.font='bold 24px monospace'; c.textAlign='right';
  c.fillText(`SCRAP: ${g.scrap}`, w-20, 35);

  // Dev mode badge
  if (g.devMode) {
    c.fillStyle='rgba(251,146,60,0.8)'; c.font='bold 11px monospace'; c.textAlign='right';
    c.fillText('DEV MODE [`]', w-20, 55);
  }

  c.fillStyle='#ffffff'; c.font='bold 20px monospace'; c.textAlign='center';
  c.fillText(`TIME: ${Math.floor(g.totalTime/60)}:${Math.floor(g.totalTime%60).toString().padStart(2,'0')}`, w/2, 50);

  // Mission bar
  const mBarW=300, mProg=Math.max(0,Math.min(1,g.mission.current/g.mission.target));
  c.fillStyle='rgba(0,0,0,0.5)'; c.fillRect(w/2-mBarW/2,10,mBarW,10);
  c.fillStyle='#39ff14'; c.fillRect(w/2-mBarW/2,10,mBarW*mProg,10);
  c.fillStyle='#fff'; c.font='bold 16px sans-serif'; c.textAlign='center';
  const mTxt = g.mission.type==='survive'
    ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}s / ${g.mission.target}s]`
    : g.mission.type==='escort'
    ? `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)}m / ${g.mission.target}m]`
    : `LEVEL ${g.level}: ${g.mission.title} [${Math.floor(g.mission.current)} / ${g.mission.target}]`;
  c.fillText(mTxt, w/2, 18);

  // Touch joystick
  if (g.touchBase && g.touchCurrent) {
    c.beginPath(); c.arc(g.touchBase.x,g.touchBase.y,60,0,Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.1)'; c.fill(); c.lineWidth=2; c.strokeStyle='rgba(255,255,255,0.3)'; c.stroke();
    let tx=g.touchCurrent.x-g.touchBase.x, ty=g.touchCurrent.y-g.touchBase.y;
    const d=Math.hypot(tx,ty); if(d>60){tx=tx/d*60;ty=ty/d*60;}
    c.beginPath(); c.arc(g.touchBase.x+tx,g.touchBase.y+ty,25,0,Math.PI*2);
    c.fillStyle='rgba(255,255,255,0.4)'; c.fill();
  }

  // Enemy HP bars
  for (let e of g.enemies) {
    if (!e.active || e.hp>=e.maxHp) continue;
    const sp=projectToScreen(camera,e.x,e.y,0); if(!sp.visible) continue;
    c.fillStyle='rgba(57,255,20,0.2)'; c.fillRect(sp.x-20,sp.y-20,40,4);
    c.fillStyle='#39ff14'; c.fillRect(sp.x-20,sp.y-20,40*Math.max(0,e.hp/e.maxHp),4);
  }

  // Escort drone HP bar
  if (g.escort.active && g.escort.hp > 0 && g.escort.respawnTimer <= 0) {
    const esc = g.escort;
    const esp = projectToScreen(camera, esc.x, esc.y, 0);
    if (esp.visible) {
      c.fillStyle='rgba(34,211,238,0.2)'; c.fillRect(esp.x-25,esp.y-25,50,5);
      c.fillStyle='#22d3ee'; c.fillRect(esp.x-25,esp.y-25,50*Math.max(0,esc.hp/esc.maxHp),5);
      c.fillStyle='#22d3ee'; c.font='bold 10px monospace'; c.textAlign='center';
      c.fillText(`DRONE [${esc.lives} lives]`, esp.x, esp.y-30);
    }
  }

  // Escort destination screen marker
  if (g.escort.active && g.escort.hp > 0) {
    const destSp = projectToScreen(camera, g.escort.targetX, g.escort.targetY, 0);
    if (destSp.visible) {
      c.strokeStyle='#22ff22'; c.lineWidth=2;
      c.beginPath(); c.arc(destSp.x, destSp.y, 12, 0, Math.PI*2); c.stroke();
      c.fillStyle='#22ff22'; c.font='bold 10px monospace'; c.textAlign='center';
      c.fillText('DEST', destSp.x, destSp.y - 18);
    }
  }

  // Effects (damage numbers, mission banner)
  for (let e of g.effects) {
    if (e.type==='dmg') {
      const sp=projectToScreen(camera,e.x,e.y,0); if(!sp.visible) continue;
      c.fillStyle=`rgba(57,255,20,${Math.min(1,e.life*2)})`; c.font='bold 16px monospace'; c.textAlign='center';
      c.fillText(e.text, sp.x, sp.y);
    } else if (e.type==='mission_complete') {
      c.fillStyle=`rgba(250,204,21,${Math.min(1,e.life)})`; c.font='bold 36px monospace'; c.textAlign='center';
      c.fillText(e.text, w/2, h/3+Math.sin(e.life*Math.PI)*10);
    }
  }

  // ── Tactical Radar ───────────────────────────────────────────────────────────
  const rR=90, rX=w-rR-20, rY=h-rR-20, rRange=1500;
  c.save();
  c.beginPath(); c.arc(rX,rY,rR,0,Math.PI*2); c.fillStyle='rgba(0,8,0,0.82)'; c.fill();
  c.lineWidth=2; c.strokeStyle='#39ff14'; c.stroke();
  c.beginPath(); c.arc(rX,rY,rR-1,0,Math.PI*2); c.clip();

  [0.33,0.66,1.0].forEach(f=>{ c.beginPath(); c.arc(rX,rY,rR*f,0,Math.PI*2); c.strokeStyle='rgba(57,255,20,0.15)'; c.lineWidth=1; c.stroke(); });
  c.strokeStyle='rgba(57,255,20,0.12)'; c.lineWidth=1;
  c.beginPath(); c.moveTo(rX-rR,rY); c.lineTo(rX+rR,rY); c.stroke();
  c.beginPath(); c.moveTo(rX,rY-rR); c.lineTo(rX,rY+rR); c.stroke();

  if (!threeObj.radarAngle) threeObj.radarAngle=0;
  threeObj.radarAngle=(threeObj.radarAngle+1.2*(Math.PI/180))%(Math.PI*2);
  const sw=threeObj.radarAngle;
  for(let t=0;t<12;t++){ const a=sw-(t/12)*(Math.PI/2); c.beginPath(); c.moveTo(rX,rY); c.lineTo(rX+Math.cos(a)*rR,rY+Math.sin(a)*rR); c.strokeStyle=`rgba(57,255,20,${0.25-t*0.02})`; c.lineWidth=1.5; c.stroke(); }
  c.beginPath(); c.moveTo(rX,rY); c.lineTo(rX+Math.cos(sw)*rR,rY+Math.sin(sw)*rR); c.strokeStyle='rgba(57,255,20,0.95)'; c.lineWidth=1.5; c.stroke();

  const pYaw=g.player.yaw||0, rRot=Math.PI/2-pYaw;
  const toR=(wx,wy)=>{ const dx=wx-g.player.x, dy=wy-g.player.y; return { px:rX+(dx*Math.cos(rRot)-dy*Math.sin(rRot))/rRange*rR, py:rY-(dx*Math.sin(rRot)+dy*Math.cos(rRot))/rRange*rR }; };

  for (let e of g.enemies) {
    if (!e.active||Math.hypot(e.x-g.player.x,e.y-g.player.y)>rRange) continue;
    const{px,py}=toR(e.x,e.y);
    let bc='#ef4444'; if(e.type==='shielded')bc='#3b82f6'; else if(e.type==='shooter')bc='#a855f7'; else if(e.type==='missile_boat')bc='#d946ef'; else if(e.type==='heavy')bc='#f97316'; else if(e.type==='interceptor')bc='#eab308';
    c.beginPath(); c.arc(px,py,e.type==='heavy'?3.5:2.5,0,Math.PI*2); c.fillStyle=bc; c.fill();
  }
  for (let p of g.pickups) {
    if (!p.active||Math.hypot(p.x-g.player.x,p.y-g.player.y)>rRange) continue;
    const{px,py}=toR(p.x,p.y); c.fillStyle='#facc15'; c.beginPath(); c.moveTo(px,py-4); c.lineTo(px+3,py); c.lineTo(px,py+4); c.lineTo(px-3,py); c.closePath(); c.fill();
  }

  // Escort drone on radar
  if (g.escort.active && g.escort.hp > 0 && g.escort.respawnTimer <= 0) {
    const esc = g.escort;
    const ed = Math.hypot(esc.x-g.player.x, esc.y-g.player.y);
    if (ed <= rRange) {
      const {px,py} = toR(esc.x, esc.y);
      c.fillStyle='#22d3ee'; c.beginPath(); c.arc(px,py,4,0,Math.PI*2); c.fill();
      c.strokeStyle='#22d3ee'; c.lineWidth=1; c.stroke();
    }
  }

  // Escort destination on radar
  if (g.escort.active && g.escort.hp > 0) {
    const destD = Math.hypot(g.escort.targetX-g.player.x, g.escort.targetY-g.player.y);
    if (destD <= rRange) {
      const {px,py} = toR(g.escort.targetX, g.escort.targetY);
      c.strokeStyle='#22ff22'; c.lineWidth=1; c.beginPath(); c.arc(px,py,5,0,Math.PI*2); c.stroke();
    }
  }

  c.beginPath(); c.moveTo(rX,rY-18); c.lineTo(rX-8,rY+6); c.lineTo(rX,rY+2); c.lineTo(rX+8,rY+6); c.closePath(); c.fillStyle='#ffffff'; c.fill();
  c.font='bold 9px monospace'; c.fillStyle='rgba(57,255,20,0.7)'; c.textAlign='center'; c.fillText('FWD',rX,rY-rR+11);
  const nA=-(Math.PI/2-pYaw)-Math.PI/2; c.fillStyle='#ef4444'; c.font='bold 9px monospace'; c.textAlign='center'; c.fillText('N',rX+Math.cos(nA)*(rR-6),rY+Math.sin(nA)*(rR-6)+4);
  c.font='bold 9px monospace'; c.fillStyle='rgba(57,255,20,0.5)'; c.textAlign='center'; c.fillText('TACTICAL',rX,rY+rR+14);
  c.restore();
};
