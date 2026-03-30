import React, { useState, useEffect, useRef } from 'react';
import { Shield, Heart, Zap, Crosshair, Rocket, Activity, Magnet, Wrench, Play, RotateCcw } from 'lucide-react';

const UPGRADE_DATA = {
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

  const canvasRef = useRef(null);
  const game = useRef(null);
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
      scrap: 9999999, totalScrapEarned: 0,
      wave: 1, timeInWave: 0, totalTime: 0,
      spawnCooldown: 2,
      enemies: [], projectiles: [], particles: [], pickups: [], effects: [],
      stars: Array.from({ length: 150 }, () => ({
        x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 1, speed: Math.random() * 80 + 20
      })),
      levels: { autocannon: 1, plasma: 0, missiles: 0, hull: 1, shield: 0, thrusters: 1, magnet: 1, pointDefense: 0 },
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
    g.projectiles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: type === 'plasma' ? 8 : (type === 'missile' ? 5 : 3),
      damage, type, active: true, pierce: pierceCount, hitList: [], life: 0,
      target: type === 'missile' ? g.enemies.filter(e => e.active)[Math.floor(Math.random() * g.enemies.filter(e => e.active).length)] : null
    });
  };

  const createParticles = (g, x, y, color, count) => {
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 50 + 20;
      g.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
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
    let type = 'fighter', hp = 30 * diffMult, speed = 100 + Math.random() * 50, radius = 12, color = '#ef4444';

    if (typeRoll > 0.8) { type = 'heavy'; hp = 100 * diffMult; speed = 40 + Math.random() * 30; radius = 22; color = '#a855f7'; }
    else if (typeRoll > 0.6) { type = 'interceptor'; hp = 15 * diffMult; speed = 180 + Math.random() * 50; radius = 10; color = '#f97316'; }

    g.enemies.push({ id: Math.random(), x, y, hp, maxHp: hp, speed, radius, color, type, active: true });
  };

  const updatePhysics = (dt, g) => {
    g.totalTime += dt;

    // --- Spawning ---
    g.spawnCooldown -= dt;
    let currentSpawnRate = Math.max(0.15, 2.0 - g.totalTime / 90);
    if (g.spawnCooldown <= 0) {
      spawnEnemy(g);
      g.spawnCooldown = currentSpawnRate + Math.random() * 0.5;
    }

    // --- Player Movement ---
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

    // --- Weapons Cooldowns & Firing ---
    for (let k in g.cooldowns) g.cooldowns[k] -= dt;

    if (g.levels.autocannon > 0 && g.cooldowns.autocannon <= 0) {
      let target = getNearestEnemy(g.player.x, g.player.y, g.enemies);
      if (target) {
        let angle = Math.atan2(target.y - g.player.y, target.x - g.player.x);
        let dmg = 10 + g.levels.autocannon * 5;
        let shots = 1 + Math.floor(g.levels.autocannon / 3); // More turrets = more simultaneous shots
        for (let i = 0; i < shots; i++) {
          let spread = (i - (shots - 1) / 2) * 0.1;
          fireProjectile(g, g.player.x, g.player.y, angle + spread, 700 + (Math.random() * 50), dmg, 'autocannon', false);
        }
        g.cooldowns.autocannon = Math.max(0.08, 0.4 - g.levels.autocannon * 0.025);
      }
    }

    if (g.levels.plasma > 0 && g.cooldowns.plasma <= 0) {
      let target = getNearestEnemy(g.player.x, g.player.y, g.enemies);
      if (target) {
        let angle = Math.atan2(target.y - g.player.y, target.x - g.player.x);
        let shots = 1 + Math.floor(g.levels.plasma / 3);
        for (let i = 0; i < shots; i++) {
          let spread = (i - (shots - 1) / 2) * 0.15;
          fireProjectile(g, g.player.x, g.player.y, angle + spread, 350, 30 + g.levels.plasma * 15, 'plasma', 1 + Math.floor(g.levels.plasma / 2));
        }
        g.cooldowns.plasma = Math.max(0.5, 2.0 - g.levels.plasma * 0.1);
      }
    }

    if (g.levels.missiles > 0 && g.cooldowns.missiles <= 0) {
      let count = g.levels.missiles;
      for (let i = 0; i < count; i++) {
        let angle = (Math.PI * 2 / count) * i;
        fireProjectile(g, g.player.x, g.player.y, angle, 250, 20 + g.levels.missiles * 5, 'missile', 0);
      }
      g.cooldowns.missiles = Math.max(1.0, 3.0 - g.levels.missiles * 0.15);
    }

    if (g.levels.pointDefense > 0 && g.cooldowns.pointDefense <= 0) {
      let range = 100 + g.levels.pointDefense * 15;
      let dmg = 5 + g.levels.pointDefense * 3;
      let hit = false;
      let hits = 0;
      let maxHits = 1 + Math.floor(g.levels.pointDefense / 2); // Targets multiple enemies
      for (let e of g.enemies) {
        if (!e.active) continue;
        if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < range) {
          e.hp -= dmg; hit = true;
          g.effects.push({ type: 'laser', x1: g.player.x, y1: g.player.y, x2: e.x, y2: e.y, life: 0.1 });
          createParticles(g, e.x, e.y, 'cyan', 3);
          hits++;
          if (hits >= maxHits) break;
        }
      }
      if (hit) g.cooldowns.pointDefense = Math.max(0.2, 0.5 - g.levels.pointDefense * 0.03);
    }

    if (g.levels.shield > 0 && g.cooldowns.shieldRegen <= 0 && g.player.shield < g.player.maxShield) {
      g.player.shield = Math.min(g.player.maxShield, g.player.shield + 2);
      g.cooldowns.shieldRegen = 0.5;
    }

    // --- Entities Update ---
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
        let speed = Math.hypot(p.vx, p.vy) + 100 * dt; // accelerate
        p.vx = Math.cos(nAngle) * speed; p.vy = Math.sin(nAngle) * speed;
        if (Math.random() < 0.3) createParticles(g, p.x, p.y, '#f97316', 1);
      }
      p.x += p.vx * dt; p.y += p.vy * dt;

      // Projectile vs Enemy collision
      for (let e of g.enemies) {
        if (!e.active || p.hitList.includes(e.id)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
          e.hp -= p.damage;
          createParticles(g, p.x, p.y, p.type === 'plasma' ? '#22d3ee' : '#fde047', 5);
          if (p.pierce > 0) { p.pierce--; p.hitList.push(e.id); }
          else { p.active = false; }
          break;
        }
      }
    }

    for (let e of g.enemies) {
      if (!e.active) continue;
      let angle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      if (e.type === 'interceptor') angle += Math.sin(g.totalTime * 4 + e.id) * 0.8; // Zig-zag
      e.x += Math.cos(angle) * e.speed * dt;
      e.y += Math.sin(angle) * e.speed * dt;

      // Enemy vs Player collision
      if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < e.radius + g.player.radius) {
        let dmg = e.type === 'heavy' ? 20 : 10;
        if (g.player.shield > 0) {
          let absorb = Math.min(g.player.shield, dmg);
          g.player.shield -= absorb; dmg -= absorb;
        }
        g.player.hp -= dmg;
        e.hp -= 20; // Crash damage to enemy

        // Knockback
        e.x += Math.cos(angle + Math.PI) * 30; e.y += Math.sin(angle + Math.PI) * 30;
        createParticles(g, g.player.x, g.player.y, '#ef4444', 10);

        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }

      // Death
      if (e.hp <= 0) {
        e.active = false;
        createParticles(g, e.x, e.y, e.color, 15);
        let val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
        g.pickups.push({ x: e.x, y: e.y, value: val, active: true, radius: 4 });
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
    }

    for (let e of g.effects) e.life -= dt;

    // Garbage collection
    if (g.totalTime % 5 < dt) {
      g.enemies = g.enemies.filter(e => e.active);
      g.projectiles = g.projectiles.filter(p => p.active);
      g.particles = g.particles.filter(p => p.active);
      g.pickups = g.pickups.filter(p => p.active);
      g.effects = g.effects.filter(e => e.life > 0);
    }
  };

  const draw = (ctx, g) => {
    ctx.fillStyle = '#0a0a14'; // Very dark blue/black
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Stars parallax
    ctx.fillStyle = '#ffffff';
    for (let s of g.stars) {
      if (statusRef.current === 'playing') {
        s.y += s.speed * ((performance.now() - g.lastTime) / 1000);
        if (s.y > window.innerHeight) { s.y = 0; s.x = Math.random() * window.innerWidth; }
      }
      ctx.globalAlpha = s.size / 3;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1.0;

    // Pickups
    for (let p of g.pickups) {
      if (!p.active) continue;
      ctx.fillStyle = '#facc15';
      ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      ctx.strokeStyle = '#ca8a04'; ctx.strokeRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
    }

    // Effects (Point defense lines)
    for (let e of g.effects) {
      if (e.type === 'laser') {
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${e.life * 10})`;
        ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Projectiles
    for (let p of g.projectiles) {
      if (!p.active) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      if (p.type === 'autocannon') { ctx.fillStyle = '#fde047'; ctx.fillRect(-6, -2, 12, 4); }
      else if (p.type === 'plasma') {
        ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
      }
      else if (p.type === 'missile') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-6, -3, 12, 6);
        ctx.fillStyle = '#f97316'; ctx.fillRect(-10, -2, 4, 4);
      }
      ctx.restore();
    }

    // Enemies
    for (let e of g.enemies) {
      if (!e.active) continue;
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(g.player.y - e.y, g.player.x - e.x));
      ctx.fillStyle = e.color;
      ctx.beginPath();
      if (e.type === 'heavy') {
        ctx.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      } else {
        ctx.moveTo(e.radius, 0); ctx.lineTo(-e.radius, e.radius);
        ctx.lineTo(-e.radius / 2, 0); ctx.lineTo(-e.radius, -e.radius);
      }
      ctx.fill(); ctx.restore();

      // Enemy HP Bar
      ctx.fillStyle = 'rgba(255,0,0,0.5)'; ctx.fillRect(e.x - 10, e.y - e.radius - 8, 20, 3);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(e.x - 10, e.y - e.radius - 8, 20 * (e.hp / e.maxHp), 3);
    }

    // Player
    ctx.save();
    ctx.translate(g.player.x, g.player.y);
    let tilt = (g.player.vx / g.player.speed) * 0.4;
    ctx.rotate(tilt); // Bank left/right slightly based on movement

    // Shield visual
    if (g.player.maxShield > 0) {
      ctx.beginPath(); ctx.arc(0, 0, g.player.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(59, 130, 246, ${Math.max(0.2, g.player.shield / g.player.maxShield)})`;
      ctx.lineWidth = 4; ctx.stroke();
    }

    // --- Battleship Hull ---
    ctx.beginPath();
    ctx.moveTo(0, -45); // Nose
    ctx.lineTo(15, -20);
    ctx.lineTo(30, -10); // Flare out wider for more hardpoints
    ctx.lineTo(30, 30);  // Main body right
    ctx.lineTo(10, 35);  // Back right
    ctx.lineTo(-10, 35); // Back left
    ctx.lineTo(-30, 30); // Main body left
    ctx.lineTo(-30, -10);
    ctx.lineTo(-15, -20);
    ctx.closePath();

    // Hull Fill & Stroke
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bridge / Superstructure
    ctx.fillStyle = '#334155';
    ctx.fillRect(-12, -5, 24, 18);
    ctx.strokeStyle = '#60a5fa'; ctx.strokeRect(-12, -5, 24, 18);
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(-8, -2, 16, 4); // Bridge window glow

    // --- Engine Glows ---
    const drawEngine = (x, y) => {
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 10 + Math.random() * 20); ctx.lineTo(x + 6, y);
      ctx.fillStyle = '#38bdf8'; ctx.fill();
    };
    drawEngine(-18, 32);
    drawEngine(0, 35);
    drawEngine(18, 32);

    // --- Dynamic Turrets ---
    // Find nearest enemy to point turrets at
    let nearestEnemy = null;
    let minDist = Infinity;
    for (let e of g.enemies) {
      if (!e.active) continue;
      let dist = Math.hypot(e.x - g.player.x, e.y - g.player.y);
      if (dist < minDist) { minDist = dist; nearestEnemy = e; }
    }

    let targetAngle = -Math.PI / 2; // Default facing UP relative to the ship orientation
    if (nearestEnemy) {
      targetAngle = Math.atan2(nearestEnemy.y - g.player.y, nearestEnemy.x - g.player.x) - tilt;
    }

    const drawTurret = (tx, ty, size, barrelL, barrelW, color, doubleBarrel = false) => {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(targetAngle + Math.PI / 2);
      ctx.fillStyle = '#94a3b8';
      if (doubleBarrel) {
        ctx.fillRect(-barrelW - 1, -barrelL, barrelW, barrelL);
        ctx.fillRect(1, -barrelL, barrelW, barrelL);
      } else {
        ctx.fillRect(-barrelW / 2, -barrelL, barrelW, barrelL);
      }
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    };

    // 1. Autocannons (Main Guns - unlocks 1 turret per 2 levels)
    if (g.levels.autocannon > 0) {
      const acSlots = [
        { x: 0, y: -25 }, { x: 0, y: 15 }, { x: 0, y: -8 },
        { x: -14, y: -15 }, { x: 14, y: -15 },
        { x: -14, y: 5 }, { x: 14, y: 5 },
        { x: -14, y: 22 }, { x: 14, y: 22 }
      ];
      let acCount = Math.min(acSlots.length, Math.ceil(g.levels.autocannon / 2));
      for (let i = 0; i < acCount; i++) {
        let double = g.levels.autocannon >= (i + 1) * 2;
        if (i === 0 && g.levels.autocannon >= 2) double = true; // First gun gets double barrel early
        drawTurret(acSlots[i].x, acSlots[i].y, 6, 12, 3, '#cbd5e1', double);
      }
    }

    // 2. Plasma Piercers (Side Batteries - unlocks 1 per 1.5 levels)
    if (g.levels.plasma > 0) {
      const plasmaSlots = [
        { x: -22, y: 0 }, { x: 22, y: 0 },
        { x: -22, y: 15 }, { x: 22, y: 15 },
        { x: -22, y: 30 }, { x: 22, y: 30 }
      ];
      let plasmaCount = Math.min(plasmaSlots.length, Math.ceil(g.levels.plasma / 1.5));
      for (let i = 0; i < plasmaCount; i++) {
        drawTurret(plasmaSlots[i].x, plasmaSlots[i].y, 5, 10, 4, '#22d3ee', false);
      }
    }

    // 3. Point Defense (Auto-lasers - fills edges as you level)
    if (g.levels.pointDefense > 0) {
      const pdSlots = [
        { x: 0, y: -38 },
        { x: -12, y: -28 }, { x: 12, y: -28 },
        { x: -28, y: -10 }, { x: 28, y: -10 },
        { x: -28, y: 10 }, { x: 28, y: 10 },
        { x: -28, y: 30 }, { x: 28, y: 30 }
      ];
      let pdCount = Math.min(pdSlots.length, Math.ceil(g.levels.pointDefense));
      for (let i = 0; i < pdCount; i++) {
        drawTurret(pdSlots[i].x, pdSlots[i].y, 3, 6, 2, '#fbbf24', false);
      }
    }

    // 4. Missile Pods (Static, built into outer wings)
    if (g.levels.missiles > 0) {
      const missileSlots = [
        { x: -25, y: -5 }, { x: 25, y: -5 },
        { x: -25, y: 8 }, { x: 25, y: 8 },
        { x: -25, y: 21 }, { x: 25, y: 21 }
      ];
      let missileCount = Math.min(missileSlots.length, Math.ceil(g.levels.missiles / 1.5));
      for (let i = 0; i < missileCount; i++) {
        let mx = missileSlots[i].x;
        let my = missileSlots[i].y;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(mx - 4, my - 6, 8, 12);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(mx - 2, my - 4, 4, 3);
        ctx.fillRect(mx - 2, my + 1, 4, 3);
      }
    }

    ctx.restore();

    // Particles
    for (let p of g.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // --- HUD Overlay on Canvas ---
    if (statusRef.current === 'playing' || statusRef.current === 'shop') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; ctx.fillRect(0, 0, window.innerWidth, 60);

      // HP Bar
      ctx.fillStyle = '#ef4444'; ctx.fillRect(20, 15, 200, 12);
      ctx.fillStyle = '#22c55e'; ctx.fillRect(20, 15, 200 * Math.max(0, g.player.hp / g.player.maxHp), 12);

      // Shield Bar
      if (g.player.maxShield > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(20, 32, 200, 6);
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(20, 32, 200 * Math.max(0, g.player.shield / g.player.maxShield), 6);
      }

      // Text Details
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`HULL: ${Math.ceil(g.player.hp)} / ${g.player.maxHp}`, 230, 25);

      // Scrap
      ctx.fillStyle = '#facc15'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`SCRAP: ${g.scrap}`, window.innerWidth - 20, 35);

      // Timer
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
      let mins = Math.floor(g.totalTime / 60); let secs = Math.floor(g.totalTime % 60).toString().padStart(2, '0');
      ctx.fillText(`TIME: ${mins}:${secs}`, window.innerWidth / 2, 35);

      // Upgrades Prompt
      if (statusRef.current === 'playing') {
        ctx.fillStyle = g.totalTime % 1 > 0.5 ? '#60a5fa' : '#bfdbfe';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`PRESS [SPACE] FOR UPGRADES`, window.innerWidth / 2, window.innerHeight - 30);
      }
    }
  };

  useEffect(() => {
    resetGame(); // Ensure game is fully initialized before first render

    const loop = (time) => {
      if (!game.current) return;
      let dt = (time - game.current.lastTime) / 1000;
      game.current.lastTime = time;
      if (dt > 0.1) dt = 0.1; // Cap to prevent huge jumps

      if (statusRef.current === 'playing') {
        updatePhysics(dt, game.current);
      }

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        draw(ctx, game.current);
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
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight;
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
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block cursor-crosshair touch-none"
        onPointerDown={(e) => { if (statusRef.current === 'playing' && game.current) game.current.mouse = { x: e.clientX, y: e.clientY, active: true }; }}
        onPointerMove={(e) => { if (statusRef.current === 'playing' && game.current && game.current.mouse.active) { game.current.mouse.x = e.clientX; game.current.mouse.y = e.clientY; } }}
        onPointerUp={() => { if (game.current) game.current.mouse.active = false; }}
        onPointerLeave={() => { if (game.current) game.current.mouse.active = false; }}
      />

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