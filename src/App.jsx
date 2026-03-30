import React, { useState, useEffect, useRef } from 'react';
import { Shield, Heart, Zap, Crosshair, Rocket, Activity, Magnet, Wrench, Play, RotateCcw, Target } from 'lucide-react';
import * as THREE from 'three';

const UPGRADE_DATA = {
  autoAim: { name: 'Targeting AI', icon: Target, desc: 'Automatically locks weapons onto the nearest enemy.', baseCost: 150, costMult: 1, maxLevel: 1 },
  autocannon: { name: 'Twin Autocannon', icon: Crosshair, desc: 'Increases basic attack fire rate & damage.', baseCost: 30, costMult: 1.5, maxLevel: 20 },
  plasma: { name: 'Plasma Piercer', icon: Zap, desc: 'Slow, heavy shots that pierce multiple enemies.', baseCost: 80, costMult: 1.6, maxLevel: 10 },
  missiles: { name: 'Seeker Swarm', icon: Rocket, desc: 'Launches homing missiles that track targets.', baseCost: 120, costMult: 1.7, maxLevel: 10 },
  hull: { name: 'Reinforced Hull', icon: Heart, desc: 'Increases Max HP by 50 and repairs hull.', baseCost: 50, costMult: 1.4, maxLevel: 20 },
  shield: { name: 'Energy Shield', icon: Shield, desc: 'Adds a regenerating protective forcefield.', baseCost: 100, costMult: 1.5, maxLevel: 10 },
  thrusters: { name: 'Ion Thrusters', icon: Activity, desc: 'Increases ship movement speed & agility.', baseCost: 40, costMult: 1.3, maxLevel: 8 },
  magnet: { name: 'Scrap Magnet', icon: Magnet, desc: 'Increases pickup radius for destroyed enemies.', baseCost: 30, costMult: 1.4, maxLevel: 10 },
  pointDefense: { name: 'Point Defense', icon: Wrench, desc: 'Short-range auto-lasers shred nearby threats.', baseCost: 150, costMult: 1.6, maxLevel: 10 }
};

export default function App() {
  const [gameState, setGameState] = useState('start'); // start, playing, shop, gameover
  const [uiScrap, setUiScrap] = useState(0);
  const [uiLevels, setUiLevels] = useState(null);

  const containerRef = useRef(null);
  const canvasRef = useRef(null); // Used for 2D UI overlay overlaying the 3D canvas
  const game = useRef(null);
  const threeRef = useRef(null);
  const reqRef = useRef();
  const statusRef = useRef(gameState);

  useEffect(() => {
    statusRef.current = gameState;
  }, [gameState]);

  const resetGame = () => {
    game.current = {
      player: {
        x: window.innerWidth / 2, y: window.innerHeight / 2,
        vx: 0, vy: 0, radius: 38,
        hp: 200, maxHp: 200,
        shield: 0, maxShield: 0,
        speed: 220, magnetRadius: 100,
      },
      scrap: 9999999, totalScrapEarned: 0, // Dev scrap kept
      wave: 1, timeInWave: 0, totalTime: 0,
      spawnCooldown: 2,
      enemies: [], projectiles: [], particles: [], pickups: [], effects: [],
      stars: Array.from({ length: 300 }, () => ({
        x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
        z: -Math.random() * 500,
        size: Math.random() * 2 + 1, speed: Math.random() * 80 + 20
      })),
      levels: { autocannon: 1, plasma: 0, missiles: 0, hull: 1, shield: 0, thrusters: 1, magnet: 1, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      keys: {}, mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2, active: false },
      lastTime: performance.now()
    };
  };

  const startGame = () => {
    resetGame();
    setGameState('playing');
  };

  const getNearestEnemy = (x, y, enemies) => {
    let nearest = null; let minDist = Infinity;
    for (let e of enemies) {
      if (!e.active) continue;
      let dist = Math.hypot(e.x - x, e.y - y);
      if (dist < minDist) { minDist = dist; nearest = e; }
    }
    return nearest;
  };

  const fireProjectile = (g, x, y, angle, speed, damage, type, pierceCount = 0) => {
    let target = null;
    if (type === 'missile') target = g.enemies.filter(e => e.active)[Math.floor(Math.random() * g.enemies.filter(e => e.active).length)];
    else if (type === 'enemy_missile') target = g.player;

    g.projectiles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: type === 'plasma' ? 12 : (type === 'missile' || type === 'enemy_missile' ? 8 : 5),
      damage, type, active: true, pierce: pierceCount, hitList: [], life: 0,
      target, isEnemy: type.startsWith('enemy')
    });
  };

  const createParticles = (g, x, y, color, count) => {
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 100 + 50;
      g.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        vz: (Math.random() - 0.5) * speed,
        life: 1.0, maxLife: 1.0, color, active: true
      });
    }
  };

  const spawnEnemy = (g) => {
    let side = Math.floor(Math.random() * 4);
    let x, y, margin = 50;
    if (side === 0) { x = Math.random() * window.innerWidth; y = -margin; }
    else if (side === 1) { x = window.innerWidth + margin; y = Math.random() * window.innerHeight; }
    else if (side === 2) { x = Math.random() * window.innerWidth; y = window.innerHeight + margin; }
    else { x = -margin; y = Math.random() * window.innerHeight; }

    let diffMult = 1 + g.totalTime / 60;
    let typeRoll = Math.random();
    let type = 'fighter', hp = 30 * diffMult, speed = 100 + Math.random() * 50, radius = 15, color = 0xef4444;
    let shield = 0, maxShield = 0, fireCooldown = 0;

    if (typeRoll > 0.95) { type = 'missile_boat'; hp = 60 * diffMult; speed = 30 + Math.random() * 20; radius = 22; color = 0xd946ef; fireCooldown = 3.0; }
    else if (typeRoll > 0.85) { type = 'shielded'; hp = 40 * diffMult; speed = 50 + Math.random() * 30; radius = 18; color = 0x3b82f6; maxShield = 80 * diffMult; shield = maxShield; }
    else if (typeRoll > 0.70) { type = 'shooter'; hp = 40 * diffMult; speed = 70 + Math.random() * 30; radius = 16; color = 0xa855f7; fireCooldown = 1.5; }
    else if (typeRoll > 0.60) { type = 'heavy'; hp = 100 * diffMult; speed = 40 + Math.random() * 30; radius = 25; color = 0xf97316; }
    else if (typeRoll > 0.40) { type = 'interceptor'; hp = 15 * diffMult; speed = 180 + Math.random() * 50; radius = 12; color = 0xeab308; }

    g.enemies.push({ id: Math.random(), x, y, hp, maxHp: hp, shield, maxShield, speed, radius, color, type, active: true, fireCooldown });
  };

  const updatePhysics = (dt, g) => {
    g.totalTime += dt;

    g.spawnCooldown -= dt;
    let currentSpawnRate = Math.max(0.15, 2.0 - g.totalTime / 90);
    if (g.spawnCooldown <= 0) {
      spawnEnemy(g);
      g.spawnCooldown = currentSpawnRate + Math.random() * 0.5;
    }

    let dx = 0, dy = 0;
    if (g.keys['w'] || g.keys['arrowup']) dy -= 1;
    if (g.keys['s'] || g.keys['arrowdown']) dy += 1;
    if (g.keys['a'] || g.keys['arrowleft']) dx -= 1;
    if (g.keys['d'] || g.keys['arrowright']) dx += 1;

    if (g.mouse.active) {
      let mx = g.mouse.x - g.player.x, my = g.mouse.y - g.player.y;
      let dist = Math.hypot(mx, my);
      if (dist > 10) { dx = mx / dist; dy = my / dist; }
    } else if (dx !== 0 || dy !== 0) {
      let dist = Math.hypot(dx, dy);
      dx /= dist; dy /= dist;
    }

    let currentSpeed = g.player.speed + (g.levels.thrusters - 1) * 30;
    g.player.vx = dx * currentSpeed;
    g.player.vy = dy * currentSpeed;
    g.player.x += g.player.vx * dt;
    g.player.y += g.player.vy * dt;
    g.player.x = Math.max(g.player.radius, Math.min(window.innerWidth - g.player.radius, g.player.x));
    g.player.y = Math.max(g.player.radius, Math.min(window.innerHeight - g.player.radius, g.player.y));

    // Track physical aiming logic with Slerp interpolation
    let adx = g.mouse.x - g.player.x, ady = g.mouse.y - g.player.y;
    if (g.levels.autoAim > 0) {
      let ne = getNearestEnemy(g.player.x, g.player.y, g.enemies);
      if (ne) { adx = ne.x - g.player.x; ady = ne.y - g.player.y; }
      else if (g.player.vx !== 0 || g.player.vy !== 0) { adx = g.player.vx; ady = g.player.vy; }
    }
    let targetAim = Math.atan2(ady, adx);
    if (g.player.aimAngle === undefined) g.player.aimAngle = targetAim;
    let adiff = targetAim - g.player.aimAngle;
    while (adiff > Math.PI) adiff -= Math.PI * 2;
    while (adiff < -Math.PI) adiff += Math.PI * 2;
    g.player.aimAngle += adiff * 15 * dt;

    for (let k in g.cooldowns) g.cooldowns[k] -= dt;

    let hasTarget = g.levels.autoAim > 0 ? (getNearestEnemy(g.player.x, g.player.y, g.enemies) !== null) : true;

    if (g.levels.autocannon > 0 && g.cooldowns.autocannon <= 0 && hasTarget) {
      let angle = g.player.aimAngle;
      let dmg = 10 + g.levels.autocannon * 5;
        let shots = 1 + Math.floor(g.levels.autocannon / 3);
        for (let i = 0; i < shots; i++) {
          let spread = (i - (shots - 1) / 2) * 0.1;
          fireProjectile(g, g.player.x, g.player.y, angle + spread, 700 + (Math.random() * 50), dmg, 'autocannon', false);
        }
        g.cooldowns.autocannon = Math.max(0.08, 0.4 - g.levels.autocannon * 0.025);
    }

    if (g.levels.plasma > 0 && g.cooldowns.plasma <= 0 && hasTarget) {
      let angle = g.player.aimAngle;
      let shots = 1 + Math.floor(g.levels.plasma / 3);
        for (let i = 0; i < shots; i++) {
          let spread = (i - (shots - 1) / 2) * 0.15;
          fireProjectile(g, g.player.x, g.player.y, angle + spread, 350, 30 + g.levels.plasma * 15, 'plasma', 1 + Math.floor(g.levels.plasma / 2));
        }
        g.cooldowns.plasma = Math.max(0.5, 2.0 - g.levels.plasma * 0.1);
    }

    if (g.levels.missiles > 0 && g.cooldowns.missiles <= 0) {
      let count = g.levels.missiles;
      for (let i = 0; i < count; i++) {
        let angle = (Math.PI * 2 / count) * i;
        fireProjectile(g, g.player.x, g.player.y, angle, 250, 20 + g.levels.missiles * 5, 'missile', 0);
      }
      g.cooldowns.missiles = Math.max(1.0, 3.0 - g.levels.missiles * 0.15);
    }

    // Point Defense
    if (g.levels.pointDefense > 0 && g.cooldowns.pointDefense <= 0) {
      let range = 250 + g.levels.pointDefense * 10;
      let hit = false;
      let dmg = 50 + g.levels.pointDefense * 20;
      let maxHits = 1 + Math.floor(g.levels.pointDefense / 2);
      let hits = 0;

      // Target Enemy Missiles First
      let enemyMissiles = g.projectiles.filter(p => p.active && p.isEnemy && p.type === 'enemy_missile');
      for (let m of enemyMissiles) {
        if (Math.hypot(m.x - g.player.x, m.y - g.player.y) < range) {
          m.active = false; hit = true;
          g.effects.push({ type: 'laser', source: g.player, target: m, life: 0.1 });
          g.effects.push({ type: 'dmg', x: m.x, y: m.y, text: 'CRIT', life: 0.5 });
          createParticles(g, m.x, m.y, 0xd946ef, 3);
          hits++;
          if (hits >= maxHits) break;
        }
      }

      if (hits < maxHits) {
        for (let e of g.enemies) {
          if (!e.active) continue;
          if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < range) {
            let ad = dmg; if(e.shield>0){let ab=Math.min(e.shield,ad);e.shield-=ab;ad-=ab;} e.hp -= ad; hit = true;
            g.effects.push({ type: 'laser', source: g.player, target: e, life: 0.1 });
            g.effects.push({ type: 'dmg', x: e.x, y: e.y, text: Math.ceil(dmg).toString(), life: 0.8 });
            createParticles(g, e.x, e.y, 0x22d3ee, 3);
            hits++;
            if (hits >= maxHits) break;
          }
        }
      }
      if (hit) g.cooldowns.pointDefense = Math.max(0.2, 0.5 - g.levels.pointDefense * 0.03);
    }

    if (g.levels.shield > 0 && g.cooldowns.shieldRegen <= 0 && g.player.shield < g.player.maxShield) {
      g.player.shield = Math.min(g.player.maxShield, g.player.shield + 2);
      g.cooldowns.shieldRegen = 0.5;
    }

    for (let p of g.projectiles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life > 4) { p.active = false; continue; }

      if (p.type === 'missile' && p.target && p.target.hp > 0) {
        let angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        let cAngle = Math.atan2(p.vy, p.vx);
        let diff = angle - cAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        let tSpeed = 5 * dt;
        let nAngle = cAngle + Math.max(-tSpeed, Math.min(tSpeed, diff));
        let speed = Math.hypot(p.vx, p.vy) + 100 * dt;
        p.vx = Math.cos(nAngle) * speed; p.vy = Math.sin(nAngle) * speed;
        if (Math.random() < 0.3) createParticles(g, p.x, p.y, 0xf97316, 1);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;

      if (p.isEnemy) {
        if (p.type === 'enemy_missile' && p.target && g.player.hp > 0) {
           let angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
           let cAngle = Math.atan2(p.vy, p.vx);
           let diff = angle - cAngle;
           while (diff > Math.PI) diff -= Math.PI * 2;
           while (diff < -Math.PI) diff += Math.PI * 2;
           let nAngle = cAngle + Math.max(-2*dt, Math.min(2*dt, diff));
           let currentSpeed = Math.hypot(p.vx, p.vy) + 50 * dt;
           p.vx = Math.cos(nAngle) * currentSpeed; p.vy = Math.sin(nAngle) * currentSpeed;
           if (Math.random() < 0.3) createParticles(g, p.x, p.y, 0xd946ef, 1);
        }

        if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
           let dmg = p.damage;
           if (g.player.shield > 0) {
             let absorb = Math.min(g.player.shield, dmg);
             g.player.shield -= absorb; dmg -= absorb;
           }
           g.player.hp -= dmg;
           createParticles(g, p.x, p.y, 0xef4444, 5);
           p.active = false;
           g.effects.push({ type: 'dmg', x: g.player.x, y: g.player.y - 10, text: Math.ceil(p.damage).toString(), life: 0.8 });
           if (g.player.hp <= 0) { setGameState('gameover'); return; }
        }
      } else {
        for (let e of g.enemies) {
          if (!e.active || p.hitList.includes(e.id)) continue;
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
            let actualDmg = p.damage;
            if (e.shield > 0) { let absorb = Math.min(e.shield, actualDmg); e.shield -= absorb; actualDmg -= absorb; }
            e.hp -= actualDmg;
            g.effects.push({ type: 'dmg', x: e.x + (Math.random()-0.5)*10, y: e.y + (Math.random()-0.5)*10, text: Math.ceil(p.damage).toString(), life: 0.8 });
            createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
            if (p.pierce > 0) { p.pierce--; p.hitList.push(e.id); }
            else { p.active = false; }
            break;
          }
        }
      }
    }

    for (let e of g.enemies) {
      if (!e.active) continue;
      
      let distToPlayer = Math.hypot(g.player.x - e.x, g.player.y - e.y);
      let angle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      let moveAngle = angle;
      if (e.type === 'interceptor') moveAngle += Math.sin(g.totalTime * 4 + e.id) * 0.8;
      
      let moveSpeed = e.speed;
      if (e.type === 'shooter') {
         if (distToPlayer < 300) moveSpeed = e.speed * -0.5;
         else if (distToPlayer < 400) moveSpeed = 0; 
      } else if (e.type === 'missile_boat') {
         if (distToPlayer < 500) moveSpeed = e.speed * -1;
         else if (distToPlayer < 700) moveSpeed = 0; 
      }

      e.x += Math.cos(moveAngle) * moveSpeed * dt;
      e.y += Math.sin(moveAngle) * moveSpeed * dt;

      if (e.fireCooldown !== undefined) {
         e.fireCooldown -= dt;
         if (e.fireCooldown <= 0) {
            if (e.type === 'shooter' && distToPlayer < 600) {
               fireProjectile(g, e.x, e.y, angle, 250, 15 * (1 + g.totalTime/120), 'enemy_bullet');
               e.fireCooldown = 1.8 + Math.random();
            } else if (e.type === 'missile_boat' && distToPlayer < 800) {
               fireProjectile(g, e.x, e.y, angle - 0.5, 120, 25 * (1 + g.totalTime/120), 'enemy_missile');
               fireProjectile(g, e.x, e.y, angle + 0.5, 120, 25 * (1 + g.totalTime/120), 'enemy_missile');
               e.fireCooldown = 4.0;
            }
         }
      }

      if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < e.radius + g.player.radius) {
        let dmg = e.type === 'heavy' ? 20 : 10;
        if (g.player.shield > 0) {
          let absorb = Math.min(g.player.shield, dmg);
          g.player.shield -= absorb; dmg -= absorb;
        }
        g.player.hp -= dmg;
        let eDamage = 20;
        if (e.shield > 0) { let absorb = Math.min(e.shield, eDamage); e.shield -= absorb; eDamage -= absorb; }
        e.hp -= eDamage;
        g.effects.push({ type: 'dmg', x: e.x, y: e.y - 10, text: '20', life: 0.8 });

        e.x += Math.cos(angle + Math.PI) * 30; e.y += Math.sin(angle + Math.PI) * 30;
        createParticles(g, g.player.x, g.player.y, 0xef4444, 10);

        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }

      if (e.hp <= 0) {
        e.active = false;
        createParticles(g, e.x, e.y, e.color, 15);
        let val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
        g.pickups.push({ x: e.x, y: e.y, value: val, active: true, radius: 6 });
      }
    }

    let currentMagnet = g.player.magnetRadius + (g.levels.magnet - 1) * 35;
    for (let p of g.pickups) {
      if (!p.active) continue;
      let dist = Math.hypot(p.x - g.player.x, p.y - g.player.y);
      if (dist < currentMagnet) {
        let angle = Math.atan2(g.player.y - p.y, g.player.x - p.x);
        p.x += Math.cos(angle) * 500 * dt; p.y += Math.sin(angle) * 500 * dt;
        if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
          g.scrap += p.value; g.totalScrapEarned += p.value;
          p.active = false;
        }
      }
    }

    for (let p of g.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vz) p.z = (p.z || 0) + p.vz * dt;
    }

    for (let e of g.effects) {
      e.life -= dt;
      if (e.type === 'dmg') {
        e.y -= 40 * dt;
      }
    }

    for (let s of g.stars) {
      let pFactor = 0.15 * (1 + s.z / 600); 
      s.x -= g.player.vx * pFactor * dt;
      s.y -= g.player.vy * pFactor * dt;
      if (s.x < -50) s.x += window.innerWidth + 100;
      if (s.x > window.innerWidth + 50) s.x -= window.innerWidth + 100;
      if (s.y < -50) s.y += window.innerHeight + 100;
      if (s.y > window.innerHeight + 50) s.y -= window.innerHeight + 100;
    }

    if (g.totalTime % 5 < dt) {
      g.enemies = g.enemies.filter(e => e.active);
      g.projectiles = g.projectiles.filter(p => p.active);
      g.particles = g.particles.filter(p => p.active);
      g.pickups = g.pickups.filter(p => p.active);
      g.effects = g.effects.filter(e => e.life > 0);
    }
  };

  const initThree = () => {
    if (threeRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a14);

    // Ambient and Directional Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(100, -200, 300);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
    // Position camera so that 1 unit = 1 pixel at Z=0
    camera.position.z = (window.innerHeight / 2) / Math.tan((50 * Math.PI / 180) / 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Append to container
    if (containerRef.current) containerRef.current.appendChild(renderer.domElement);

    // Shared Geometries & Materials
    const geoms = {
      box: new THREE.BoxGeometry(1, 1, 1),
      sphere: new THREE.SphereGeometry(1, 8, 8),
      cone: new THREE.ConeGeometry(1, 2, 8),
      tetra: new THREE.TetrahedronGeometry(1)
    };

    const mats = {
      player: new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true }),
      weapon: new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }),
      shield: new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, transparent: true, opacity: 0.3 }),
      pickup: new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true }),
      laser: new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 })
    };

    threeRef.current = { scene, camera, renderer, g: geoms, m: mats, meshes: new Map() };
  };

  const drawThree = (threeObj, g) => {
    const { scene, camera, renderer, meshes, g: geoms, m: mats } = threeObj;
    const activeKeys = new Set();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const getMesh = (obj, createFn) => {
      if (!meshes.has(obj)) {
        const m = createFn();
        scene.add(m);
        meshes.set(obj, m);
      }
      activeKeys.add(obj);
      return meshes.get(obj);
    };

    // Update Stars
    for (let s of g.stars) {
      const sm = getMesh(s, () => {
        const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color: 0x006400, wireframe: true, transparent: true, opacity: s.size / 3 }));
        m.scale.set(s.size, s.size, s.size);
        return m;
      });
      sm.position.set(s.x - cx, cy - s.y, s.z);
    }

    // Update Player
    const pm = getMesh(g.player, () => {
      const group = new THREE.Group();

      // Main Hull
      const body = new THREE.Mesh(new THREE.BoxGeometry(40, 60, 20), mats.player);
      group.add(body);

      // Wings
      const wing = new THREE.Mesh(new THREE.BoxGeometry(80, 20, 10), mats.player);
      wing.position.set(0, -10, -5);
      group.add(wing);

      // Superstructure
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(20, 15, 10), mats.player);
      bridge.position.set(0, 10, 10);
      group.add(bridge);

      // Shield
      const shield = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 16), mats.shield);
      shield.name = "shield";
      group.add(shield);

      const turrets = new THREE.Group();
      turrets.name = "turrets";
      group.add(turrets);

      return group;
    });

    pm.position.set(g.player.x - cx, cy - g.player.y, 0);
    
    if (Math.abs(g.player.vx) > 0.01 || Math.abs(g.player.vy) > 0.01) {
      let targetRotZ = Math.atan2(-g.player.vy, g.player.vx) - Math.PI / 2;
      let diff = targetRotZ - pm.rotation.z;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      pm.rotation.z += diff * 0.15;
    }
    
    // If shield active
    const shieldMesh = pm.children.find(c => c.name === "shield");
    if (shieldMesh) {
      shieldMesh.visible = g.player.maxShield > 0;
      shieldMesh.material.opacity = Math.max(0.1, 0.5 * (g.player.shield / g.player.maxShield));
    }

    // --- Dynamic Turrets Re-generation and Aiming ---
    const turretsGroup = pm.children.find(c => c.name === "turrets");
    if (turretsGroup) {
      const currentLevelsHash = Object.values(g.levels).join('-');
      if (pm.userData.levelsHash !== currentLevelsHash) {
        pm.userData.levelsHash = currentLevelsHash;
        turretsGroup.clear();

        const addTurret = (x, y, color, isDouble) => {
          const tg = new THREE.Group();
          // Note: In local space, Y is mapping visually identical to 2D
          tg.position.set(x, -y, 10);
          const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 6, 12), mats.player);
          base.rotation.x = Math.PI / 2;
          tg.add(base);

          if (isDouble) {
            const b1 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player);
            b1.position.set(-3.5, 7.5, 0); tg.add(b1);
            const b2 = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player);
            b2.position.set(3.5, 7.5, 0); tg.add(b2);
          } else {
            const b = new THREE.Mesh(new THREE.BoxGeometry(3, 15, 3), mats.player);
            b.position.set(0, 7.5, 0); tg.add(b);
          }
          tg.userData.isAiming = true;
          turretsGroup.add(tg);
        };

        const addStaticMissile = (x, y) => {
          const mg = new THREE.Group();
          mg.position.set(x, -y, 5);
          const pod = new THREE.Mesh(new THREE.BoxGeometry(12, 18, 9), mats.player);
          mg.add(pod);
          turretsGroup.add(mg);
        };

        if (g.levels.autocannon > 0) {
          const acSlots = [{ x: 0, y: -25 }, { x: 0, y: 15 }, { x: 0, y: -8 }, { x: -14, y: -15 }, { x: 14, y: -15 }, { x: -14, y: 5 }, { x: 14, y: 5 }, { x: -14, y: 22 }, { x: 14, y: 22 }];
          let acCount = Math.min(acSlots.length, Math.ceil(g.levels.autocannon / 2));
          for (let i = 0; i < acCount; i++) {
            let double = g.levels.autocannon >= (i + 1) * 2;
            if (i === 0 && g.levels.autocannon >= 2) double = true;
            addTurret(acSlots[i].x, acSlots[i].y, 0xcbd5e1, double);
          }
        }

        if (g.levels.plasma > 0) {
          const plasmaSlots = [{ x: -22, y: 0 }, { x: 22, y: 0 }, { x: -22, y: 15 }, { x: 22, y: 15 }, { x: -22, y: 30 }, { x: 22, y: 30 }];
          let plasmaCount = Math.min(plasmaSlots.length, Math.ceil(g.levels.plasma / 1.5));
          for (let i = 0; i < plasmaCount; i++) addTurret(plasmaSlots[i].x, plasmaSlots[i].y, 0x22d3ee, false);
        }

        if (g.levels.pointDefense > 0) {
          const pdSlots = [{ x: 0, y: -38 }, { x: -12, y: -28 }, { x: 12, y: -28 }, { x: -28, y: -10 }, { x: 28, y: -10 }, { x: -28, y: 10 }, { x: 28, y: 10 }, { x: -28, y: 30 }, { x: 28, y: 30 }];
          let pdCount = Math.min(pdSlots.length, Math.ceil(g.levels.pointDefense));
          for (let i = 0; i < pdCount; i++) addTurret(pdSlots[i].x, pdSlots[i].y, 0xfbbf24, false);
        }

        if (g.levels.missiles > 0) {
          const missileSlots = [{ x: -25, y: -5 }, { x: 25, y: -5 }, { x: -25, y: 8 }, { x: 25, y: 8 }, { x: -25, y: 21 }, { x: 25, y: 21 }];
          let missileCount = Math.min(missileSlots.length, Math.ceil(g.levels.missiles / 1.5));
          for (let i = 0; i < missileCount; i++) addStaticMissile(missileSlots[i].x, missileSlots[i].y);
        }
      }

      let shipRotZ = pm.rotation.z;
      let worldAimAngle = -(g.player.aimAngle || 0);
      turretsGroup.children.forEach(t => {
        if (t.userData.isAiming) {
            t.rotation.z = (worldAimAngle - Math.PI / 2) - shipRotZ;
        }
      });
    }

    // Pickups
    for (let p of g.pickups) {
      if (!p.active) continue;
      const mesh = getMesh(p, () => {
        const m = new THREE.Mesh(geoms.tetra, mats.pickup);
        m.scale.set(p.radius, p.radius, p.radius);
        return m;
      });
      mesh.position.set(p.x - cx, cy - p.y, 0);
      mesh.rotation.x += 0.05;
      mesh.rotation.y += 0.05;
    }

    // Projectiles
    for (let p of g.projectiles) {
      if (!p.active) continue;
      const mesh = getMesh(p, () => {
        let color = p.isEnemy ? 0xd946ef : 0xff0000;
        const m = new THREE.Mesh(geoms.sphere, new THREE.MeshBasicMaterial({ color, wireframe: true }));
        m.scale.set(p.radius, p.radius, p.radius);
        return m;
      });
      mesh.position.set(p.x - cx, cy - p.y, 0);

      if (p.type === 'missile' || p.type === 'enemy_missile') {
        mesh.scale.set(p.radius * 0.5, p.radius * 2, p.radius * 0.5);
        mesh.rotation.z = Math.atan2(-p.vy, p.vx) - Math.PI / 2;
      }
    }

    // Enemies
    for (let e of g.enemies) {
      if (!e.active) continue;
      const mesh = getMesh(e, () => {
        const isHeavy = e.type === 'heavy';
        let geo = isHeavy ? new THREE.BoxGeometry(1, 1, 1) : geoms.cone;
        if (e.type === 'shooter') geo = new THREE.BoxGeometry(1, 0.5, 1);
        else if (e.type === 'missile_boat') geo = new THREE.BoxGeometry(1.5, 0.5, 1.5);
        else if (e.type === 'shielded') geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
        
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: e.color, wireframe: true }));
        if (isHeavy) m.scale.set(e.radius * 2, e.radius * 2, e.radius * 2);
        else m.scale.set(e.radius * 2, e.radius * 2, e.radius);
        
        return m;
      });
      mesh.position.set(e.x - cx, cy - e.y, 0);
      // Face player
      let dx = g.player.x - e.x;
      let dy = e.y - g.player.y; // flipped Y to math coordinates
      mesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }

    // Particles
    for (let p of g.particles) {
      if (!p.active) continue;
      const mesh = getMesh(p, () => {
        const m = new THREE.Mesh(geoms.box, new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, transparent: true }));
        m.scale.set(3, 3, 3);
        return m;
      });
      mesh.position.set(p.x - cx, cy - p.y, p.z || 0);
      mesh.material.opacity = p.life / p.maxLife;
    }

    // Line effects (Point Defense lasers)
    for (let e of g.effects) {
      if (e.type === 'laser') {
        const mesh = getMesh(e, () => {
          const mat = mats.laser;
          return new THREE.Line(new THREE.BufferGeometry(), mat);
        });
        if (e.source && e.target) {
            mesh.geometry.setFromPoints([
                new THREE.Vector3(e.source.x - cx, cy - e.source.y, 0),
                new THREE.Vector3(e.target.x - cx, cy - e.target.y, 0)
            ]);
        }
        mesh.material.opacity = e.life * 10;
      }
    }

    // Cleanup dead objects
    for (let [obj, mesh] of meshes.entries()) {
      if (!activeKeys.has(obj)) {
        scene.remove(mesh);
        meshes.delete(obj);
      }
    }

    renderer.render(scene, camera);

    // --- HUD 2D Overlay ---
    const ctx = canvasRef.current;
    if (ctx && (statusRef.current === 'playing' || statusRef.current === 'shop')) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.width = w; ctx.height = h;
      const c2d = ctx.getContext('2d');
      c2d.clearRect(0, 0, w, h);

      c2d.fillStyle = 'rgba(0, 0, 0, 0.4)'; c2d.fillRect(0, 0, w, 60);

      c2d.fillStyle = '#ef4444'; c2d.fillRect(20, 15, 200, 12);
      c2d.fillStyle = '#22c55e'; c2d.fillRect(20, 15, 200 * Math.max(0, g.player.hp / g.player.maxHp), 12);

      if (g.player.maxShield > 0) {
        c2d.fillStyle = 'rgba(255,255,255,0.2)'; c2d.fillRect(20, 32, 200, 6);
        c2d.fillStyle = '#3b82f6'; c2d.fillRect(20, 32, 200 * Math.max(0, g.player.shield / g.player.maxShield), 6);
      }

      c2d.fillStyle = '#ffffff'; c2d.font = 'bold 12px sans-serif'; c2d.textAlign = 'left';
      c2d.fillText(`HULL: ${Math.ceil(g.player.hp)} / ${g.player.maxHp}`, 230, 25);

      c2d.fillStyle = '#facc15'; c2d.font = 'bold 24px monospace'; c2d.textAlign = 'right';
      c2d.fillText(`SCRAP: ${g.scrap}`, w - 20, 35);

      c2d.fillStyle = '#ffffff'; c2d.font = 'bold 20px monospace'; c2d.textAlign = 'center';
      let mins = Math.floor(g.totalTime / 60); let secs = Math.floor(g.totalTime % 60).toString().padStart(2, '0');
      c2d.fillText(`TIME: ${mins}:${secs}`, w / 2, 35);

      if (statusRef.current === 'playing') {
        c2d.fillStyle = g.totalTime % 1 > 0.5 ? '#39ff14' : '#013220';
        c2d.font = 'bold 18px sans-serif';
        c2d.fillText(`PRESS [SPACE] FOR UPGRADES`, w / 2, h - 30);
      }
      
      // Draw Enemy HP & Damage Indicators
      for (let e of g.enemies) {
        if (!e.active || e.hp >= e.maxHp) continue;
        const barW = 30;
        const hpRatio = Math.max(0, e.hp / e.maxHp);
        c2d.fillStyle = 'rgba(57, 255, 20, 0.2)';
        c2d.fillRect(e.x - barW/2, e.y - e.radius - 12, barW, 4);
        c2d.fillStyle = '#39ff14';
        c2d.fillRect(e.x - barW/2, e.y - e.radius - 12, barW * hpRatio, 4);
      }

      for (let e of g.effects) {
        if (e.type === 'dmg') {
          c2d.fillStyle = `rgba(57, 255, 20, ${Math.min(1, e.life * 2)})`;
          c2d.font = 'bold 16px monospace';
          c2d.textAlign = 'center';
          c2d.fillText(e.text, e.x, e.y);
        }
      }
    }
  };

  useEffect(() => {
    resetGame();
    initThree();

    const loop = (time) => {
      if (!game.current) return;
      let dt = (time - game.current.lastTime) / 1000;
      game.current.lastTime = time;
      if (dt > 0.1) dt = 0.1;

      if (statusRef.current === 'playing') {
        updatePhysics(dt, game.current);
      }

      if (threeRef.current) {
        drawThree(threeRef.current, game.current);
      }

      reqRef.current = requestAnimationFrame(loop);
    };

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === ' ' && !e.repeat) {
        setGameState(prev => {
          if (prev === 'playing') {
            setUiScrap(game.current.scrap);
            setUiLevels({ ...game.current.levels });
            return 'shop';
          } else if (prev === 'shop') return 'playing';
          else if (prev === 'start' || prev === 'gameover') { startGame(); return 'playing'; }
          return prev;
        });
      }
      if (game.current) game.current.keys[key] = true;
    };

    const handleKeyUp = (e) => { if (game.current) game.current.keys[e.key.toLowerCase()] = false; };

    const handleResize = () => {
      if (threeRef.current) {
        threeRef.current.camera.aspect = window.innerWidth / window.innerHeight;
        // Adjust Z to keep 1unit = 1px at Z=0
        threeRef.current.camera.position.z = (window.innerHeight / 2) / Math.tan((50 * Math.PI / 180) / 2);
        threeRef.current.camera.updateProjectionMatrix();
        threeRef.current.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', handleResize);
    handleResize();

    reqRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(reqRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (threeRef.current && containerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        containerRef.current.removeChild(threeRef.current.renderer.domElement);
        threeRef.current.renderer.dispose();
      }
    };
  }, []);

  const buyUpgrade = (key, cost) => {
    if (uiScrap >= cost) {
      setUiScrap(prev => prev - cost);
      game.current.scrap -= cost;
      setUiLevels(prev => {
        const nextLevel = prev[key] + 1;
        game.current.levels[key] = nextLevel;

        if (key === 'hull') { game.current.player.maxHp += 50; game.current.player.hp += 50; }
        if (key === 'shield') { game.current.player.maxShield = nextLevel * 20; game.current.player.shield = game.current.player.maxShield; }

        return { ...prev, [key]: nextLevel };
      });
    }
  };

  return (
    <div className="w-full h-screen bg-[#0a0a14] overflow-hidden relative font-sans select-none">

      {/* 3D Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={(e) => { if (statusRef.current === 'playing' && game.current) { game.current.mouse.x = e.clientX; game.current.mouse.y = e.clientY; game.current.mouse.active = true; } }}
        onPointerMove={(e) => { if (statusRef.current === 'playing' && game.current) { game.current.mouse.x = e.clientX; game.current.mouse.y = e.clientY; if(e.buttons > 0) game.current.mouse.active = true; } }}
        onPointerUp={() => { if (game.current) game.current.mouse.active = false; }}
        onPointerLeave={() => { if (game.current) game.current.mouse.active = false; }}
      />

      {/* 2D HUD Canvas Overlay */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Shop Overlay */}
      {gameState === 'shop' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40 backdrop-blur-sm">
          <div className="bg-gray-900/95 border border-blue-500/50 rounded-xl p-6 w-full max-w-5xl shadow-2xl shadow-blue-900/30 overflow-y-auto max-h-screen">
            <div className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-gray-700 pb-4">
              <div>
                <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">SYSTEM UPGRADES</h2>
                <p className="text-gray-400 mt-1">Upgrade your battleship systems to survive.</p>
              </div>
              <div className="text-3xl font-mono text-yellow-400 flex items-center gap-3 bg-black/50 px-6 py-3 rounded-lg border border-yellow-500/30">
                <div className="w-4 h-4 bg-yellow-400 rounded-sm shadow-[0_0_10px_#facc15]"></div> {uiScrap}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(UPGRADE_DATA).map(([key, data]) => {
                const currentLevel = uiLevels?.[key] || 0;
                const cost = Math.floor(data.baseCost * Math.pow(data.costMult, currentLevel));
                const isMax = currentLevel >= data.maxLevel;
                const canAfford = uiScrap >= cost;

                return (
                  <div key={key}
                    onClick={() => { if (!isMax && canAfford) buyUpgrade(key, cost); }}
                    className={`relative p-5 rounded-xl border flex flex-col h-full transition-all duration-200 
                                        ${isMax ? 'border-green-500/30 bg-green-900/10' :
                        canAfford ? 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/40 hover:scale-[1.02] cursor-pointer' :
                          'border-gray-700 bg-gray-800/40 opacity-75'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <data.icon className={`w-10 h-10 ${isMax ? 'text-green-400' : 'text-blue-400'}`} />
                      <div className="text-xs font-mono bg-black/60 px-2 py-1 rounded text-gray-300 border border-gray-700">
                        LVL {currentLevel}/{data.maxLevel}
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-white">{data.name}</h3>
                    <p className="text-sm text-gray-400 mb-6 flex-grow">{data.desc}</p>
                    <div className="mt-auto pt-4 border-t border-gray-700/50">
                      {isMax ? (
                        <div className="text-green-400 font-bold text-center tracking-widest">MAXED OUT</div>
                      ) : (
                        <div className={`font-bold text-xl text-center flex items-center justify-center gap-2 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                          <div className="w-3 h-3 bg-current rounded-sm"></div> {cost}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-8 flex justify-center">
              <button className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-transform hover:scale-105 flex items-center gap-3" onClick={() => setGameState('playing')}>
                <Play className="w-6 h-6 fill-current" /> RESUME COMBAT (SPACE)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {gameState === 'start' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-50 backdrop-blur-md">
          <div className="relative mb-8">
            <Rocket className="w-24 h-24 text-blue-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
            <h1 className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-200 drop-shadow-lg text-center">SPACE SENTINEL</h1>
          </div>
          <p className="text-xl text-gray-300 mb-12 max-w-lg text-center leading-relaxed">You are the core. Defend yourself against endless waves. Gather scrap from fallen enemies to dynamically upgrade your ship systems. Survive.</p>
          <button className="px-10 py-5 bg-blue-600 hover:bg-blue-500 rounded-full font-black text-2xl transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_50px_rgba(37,99,235,0.6)] hover:scale-105 flex items-center gap-3" onClick={startGame}>
            <Play className="w-8 h-8 fill-current" /> INITIALIZE SEQUENCE (SPACE)
          </button>
          <div className="mt-12 text-gray-400 flex flex-wrap justify-center gap-8 font-mono bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2"><span className="text-white border border-gray-600 px-2 rounded">W A S D</span> / <span className="text-white border border-gray-600 px-2 rounded">Drag</span> to Move</div>
            <div className="flex items-center gap-2"><Crosshair className="w-4 h-4 text-yellow-400" /> Auto-Fire</div>
            <div className="flex items-center gap-2"><span className="text-white border border-gray-600 px-2 py-1 rounded">SPACE</span> to Upgrade</div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 text-white z-50 backdrop-blur-md">
          <Heart className="w-24 h-24 text-red-500 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
          <h1 className="text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-600">HULL BREACHED</h1>
          <p className="text-red-300 text-xl mb-10 tracking-widest font-mono">SYSTEMS OFFLINE</p>

          <div className="bg-black/50 p-8 rounded-2xl border border-red-900/50 mb-10 min-w-[350px]">
            <div className="flex justify-between items-center mb-4 text-2xl">
              <span className="text-gray-400">TIME SURVIVED:</span>
              <span className="font-mono font-bold">{Math.floor(game.current?.totalTime || 0)}s</span>
            </div>
            <div className="flex justify-between items-center text-2xl">
              <span className="text-gray-400">TOTAL SCRAP:</span>
              <span className="font-mono font-bold text-yellow-400 flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> {game.current?.totalScrapEarned || 0}
              </span>
            </div>
          </div>

          <button className="px-10 py-5 bg-red-600 hover:bg-red-500 rounded-full font-black text-2xl transition-all shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)] hover:scale-105 flex items-center gap-3" onClick={startGame}>
            <RotateCcw className="w-8 h-8" /> REDEPLOY (SPACE)
          </button>
        </div>
      )}
    </div>
  );
}