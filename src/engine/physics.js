/**
 * physics.js — Main game-loop physics & simulation step.
 * No React imports; state changes are delivered via a callbacks object.
 *
 * @param {number} dt      - Delta time in seconds
 * @param {object} g       - Live game state (game.current)
 * @param {object} cbs     - { setGameState, setMapStateVersion }
 */
import { getNearestEnemy, fireProjectile, createParticles } from './combat.js';
import { spawnEnemy } from './spawner.js';

export const updatePhysics = (dt, g, cbs) => {
  const { setGameState, setMapStateVersion } = cbs;

  // ─── Transition timer (runs after mission complete, before returning to map) ───
  if (g.transitionTimer !== undefined) {
    g.transitionTimer -= dt;
    if (g.transitionTimer <= 0) {
      if (g.isVictory) {
        setGameState('victory');
      } else {
        setGameState('map');
        setMapStateVersion(v => v + 1);
      }
      g.transitionTimer = undefined;
      g.enemies = []; g.projectiles = []; g.particles = []; g.pickups = []; g.effects = [];
    }
    return;
  }

  // ─── Mission completion ───────────────────────────────────────────────────────
  const completeMission = () => {
    if (g.mission.completed) return;
    g.scrap += g.mission.reward;
    g.totalScrapEarned += g.mission.reward;
    g.effects.push({
      type: 'mission_complete',
      x: window.innerWidth / 2,
      y: Math.max(100, window.innerHeight / 4),
      text: `AREA CLEARED! +${g.mission.reward} SCRAP`,
      life: 3.0,
    });
    g.mission.completed = true;
    g.transitionTimer = 3.0;

    if (g.mission.type === 'kill_boss') g.isVictory = true;

    if (g.map.currentNodeId) {
      let cur = g.map.nodes.find(n => n.id === g.map.currentNodeId);
      if (cur) cur.status = 'cleared';

      let nextEdges = g.map.edges.filter(e => e.from === g.map.currentNodeId);
      nextEdges.forEach(e => {
        let n = g.map.nodes.find(node => node.id === e.to);
        if (n) n.status = 'available';
      });
    }
    g.level++;
  };

  if (g.mission && !g.mission.completed) {
    if (g.mission.type === 'survive') {
      g.mission.current += dt;
      if (g.mission.current >= g.mission.target) completeMission();
    }
  }

  // ─── Time & spawn ─────────────────────────────────────────────────────────────
  g.totalTime += dt;
  g.spawnCooldown -= dt;

  const currentDiffMult = 0.5 + (g.level * 0.15) + Math.pow(g.level, 1.6) * 0.04 + g.totalTime / 100;
  const currentSpawnRate = Math.max(0.1, 2.5 - (g.level * 0.1) - (g.totalTime / 400));

  if (g.spawnCooldown <= 0) {
    spawnEnemy(g);
    g.spawnCooldown = currentSpawnRate + Math.random() * 0.5;
  }

  // ─── Player movement (yaw-based) ─────────────────────────────────────────────
  if (g.player.yaw === undefined) g.player.yaw = Math.PI / 2;
  const turnSpeed = 1.4; // radians per second
  let thrust = 0;

  if (g.touchBase && g.touchCurrent) {
    let tx = g.touchCurrent.x - g.touchBase.x;
    let ty = g.touchCurrent.y - g.touchBase.y;
    let dist = Math.hypot(tx, ty);
    if (dist > 10) {
      let nx = tx / Math.max(dist, 60);
      let ny = ty / Math.max(dist, 60);
      g.player.yaw -= nx * turnSpeed * dt * 3;
      thrust = -ny;
      if (dist > 60) {
        g.touchBase.x = g.touchCurrent.x - (tx / dist) * 60;
        g.touchBase.y = g.touchCurrent.y - (ty / dist) * 60;
      }
    }
  } else {
    if (g.keys['a'] || g.keys['arrowleft'])  g.player.yaw += turnSpeed * dt;
    if (g.keys['d'] || g.keys['arrowright']) g.player.yaw -= turnSpeed * dt;
    if (g.keys['w'] || g.keys['arrowup'])    thrust =  1;
    if (g.keys['s'] || g.keys['arrowdown'])  thrust = -1;
  }

  const currentSpeed = g.player.speed + (g.levels.thrusters - 1) * 30;
  const fwdX = Math.cos(g.player.yaw);
  const fwdY = Math.sin(g.player.yaw);
  g.player.vx = fwdX * thrust * currentSpeed;
  g.player.vy = fwdY * thrust * currentSpeed;
  g.player.x += g.player.vx * dt;
  g.player.y += g.player.vy * dt;
  g.player.x = Math.max(-4000, Math.min(4000, g.player.x));
  g.player.y = Math.max(-4000, Math.min(4000, g.player.y));

  // ─── Aiming (turret tracking) ─────────────────────────────────────────────────
  let adx = g.worldMouse.x - g.player.x;
  let ady = g.worldMouse.y - g.player.y;
  if (g.touchBase && g.touchCurrent) { adx = fwdX; ady = fwdY; }
  if (g.levels.autoAim > 0) {
    const ne = getNearestEnemy(g.player.x, g.player.y, g.enemies);
    if (ne) { adx = ne.x - g.player.x; ady = ne.y - g.player.y; }
    else    { adx = fwdX; ady = fwdY; }
  }
  const targetAim = Math.atan2(ady, adx);
  if (g.player.aimAngle === undefined) g.player.aimAngle = targetAim;
  let adiff = targetAim - g.player.aimAngle;
  while (adiff >  Math.PI) adiff -= Math.PI * 2;
  while (adiff < -Math.PI) adiff += Math.PI * 2;
  g.player.aimAngle += adiff * 15 * dt;

  // ─── Weapon cooldowns ─────────────────────────────────────────────────────────
  for (let k in g.cooldowns) g.cooldowns[k] -= dt;

  const hasTarget = g.levels.autoAim > 0
    ? (getNearestEnemy(g.player.x, g.player.y, g.enemies) !== null)
    : true;

  // Autocannon
  if (g.levels.autocannon > 0 && g.cooldowns.autocannon <= 0 && hasTarget) {
    const angle = g.player.aimAngle;
    const dmg = 10 + g.levels.autocannon * 5;
    const shots = 1 + Math.floor(g.levels.autocannon / 3);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 18;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      fireProjectile(g, bx, by, angle, 700 + (Math.random() * 50), dmg, 'autocannon', false);
    }
    g.cooldowns.autocannon = Math.max(0.08, 0.4 - g.levels.autocannon * 0.025);
  }

  // Plasma
  if (g.levels.plasma > 0 && g.cooldowns.plasma <= 0 && hasTarget) {
    const angle = g.player.aimAngle;
    const shots = 1 + Math.floor(g.levels.plasma / 3);
    const perpX = -Math.sin(angle);
    const perpY =  Math.cos(angle);
    for (let i = 0; i < shots; i++) {
      const lateralOff = (i - (shots - 1) / 2) * 22;
      const bx = g.player.x + Math.cos(angle) * 50 + perpX * lateralOff;
      const by = g.player.y + Math.sin(angle) * 50 + perpY * lateralOff;
      fireProjectile(g, bx, by, angle, 350, 30 + g.levels.plasma * 15, 'plasma', 1 + Math.floor(g.levels.plasma / 2));
    }
    g.cooldowns.plasma = Math.max(0.5, 2.0 - g.levels.plasma * 0.1);
  }

  // Missiles
  if (g.levels.missiles > 0 && g.cooldowns.missiles <= 0) {
    const count = g.levels.missiles;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      fireProjectile(g, g.player.x, g.player.y, angle, 250, 20 + g.levels.missiles * 5, 'missile', 0);
    }
    g.cooldowns.missiles = Math.max(1.0, 3.0 - g.levels.missiles * 0.15);
  }

  // Point Defense
  if (g.levels.pointDefense > 0 && g.cooldowns.pointDefense <= 0) {
    const range = 250 + g.levels.pointDefense * 10;
    const dmg = 50 + g.levels.pointDefense * 20;
    const maxHits = 1 + Math.floor(g.levels.pointDefense / 2);
    let hits = 0;
    let hit = false;

    // Target enemy missiles first
    const enemyMissiles = g.projectiles.filter(p => p.active && p.isEnemy && p.type === 'enemy_missile');
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
          let ad = dmg;
          if (e.shield > 0) { const ab = Math.min(e.shield, ad); e.shield -= ab; ad -= ab; }
          e.hp -= ad; hit = true;
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

  // Shield regen
  if (g.levels.shield > 0 && g.cooldowns.shieldRegen <= 0 && g.player.shield < g.player.maxShield) {
    g.player.shield = Math.min(g.player.maxShield, g.player.shield + 2);
    g.cooldowns.shieldRegen = 0.5;
  }

  // ─── Projectile simulation ────────────────────────────────────────────────────
  for (let p of g.projectiles) {
    if (!p.active) continue;
    p.life += dt;
    if (p.life > 4) { p.active = false; continue; }

    // Player missile homing
    if (p.type === 'missile' && p.target && p.target.hp > 0) {
      const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      const cAngle = Math.atan2(p.vy, p.vx);
      let diff = angle - cAngle;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const tSpeed = 5 * dt;
      const nAngle = cAngle + Math.max(-tSpeed, Math.min(tSpeed, diff));
      const speed = Math.hypot(p.vx, p.vy) + 100 * dt;
      p.vx = Math.cos(nAngle) * speed;
      p.vy = Math.sin(nAngle) * speed;
      if (Math.random() < 0.3) createParticles(g, p.x, p.y, 0xf97316, 1);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.isEnemy) {
      // Enemy missile homing
      if (p.type === 'enemy_missile' && p.target && g.player.hp > 0 && p.life < 4.0) {
        const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        const cAngle = Math.atan2(p.vy, p.vx);
        let diff = angle - cAngle;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const nAngle = cAngle + Math.max(-2 * dt, Math.min(2 * dt, diff));
        const currentSpeed = Math.hypot(p.vx, p.vy) + 50 * dt;
        p.vx = Math.cos(nAngle) * currentSpeed;
        p.vy = Math.sin(nAngle) * currentSpeed;
        if (Math.random() < 0.3) createParticles(g, p.x, p.y, 0xd946ef, 1);
      }

      // Enemy projectile hits player
      if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
        let dmg = p.damage;
        if (g.player.shield > 0) {
          const absorb = Math.min(g.player.shield, dmg);
          g.player.shield -= absorb; dmg -= absorb;
        }
        g.player.hp -= dmg;
        createParticles(g, p.x, p.y, 0xef4444, 5);
        p.active = false;
        g.effects.push({ type: 'dmg', x: g.player.x, y: g.player.y - 10, text: Math.ceil(p.damage).toString(), life: 0.8 });
        if (g.player.hp <= 0) { setGameState('gameover'); return; }
      }
    } else {
      // Player projectile hits enemies
      for (let e of g.enemies) {
        if (!e.active || p.hitList.includes(e.id)) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
          let actualDmg = p.damage;
          if (e.shield > 0) { const absorb = Math.min(e.shield, actualDmg); e.shield -= absorb; actualDmg -= absorb; }
          e.hp -= actualDmg;
          g.effects.push({ type: 'dmg', x: e.x + (Math.random() - 0.5) * 10, y: e.y + (Math.random() - 0.5) * 10, text: Math.ceil(p.damage).toString(), life: 0.8 });
          createParticles(g, p.x, p.y, p.type === 'plasma' ? 0x22d3ee : 0xfde047, 5);
          if (p.pierce > 0) { p.pierce--; p.hitList.push(e.id); }
          else              { p.active = false; }
          break;
        }
      }
    }
  }

  // ─── Enemy AI & collision ─────────────────────────────────────────────────────
  for (let e of g.enemies) {
    if (!e.active) continue;

    const distToPlayer = Math.hypot(g.player.x - e.x, g.player.y - e.y);
    const angle = Math.atan2(g.player.y - e.y, g.player.x - e.x);
    let moveAngle = angle;
    if (e.type === 'interceptor') moveAngle += Math.sin(g.totalTime * 4 + e.id) * 0.8;

    let moveSpeed = e.speed;
    if (e.type === 'shooter') {
      if      (distToPlayer < 300) moveSpeed = e.speed * -0.5;
      else if (distToPlayer < 400) moveSpeed = 0;
    } else if (e.type === 'missile_boat') {
      if      (distToPlayer < 500) moveSpeed = e.speed * -1;
      else if (distToPlayer < 700) moveSpeed = 0;
    }

    e.x += Math.cos(moveAngle) * moveSpeed * dt;
    e.y += Math.sin(moveAngle) * moveSpeed * dt;

    if (e.fireCooldown !== undefined) {
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0) {
        if (e.type === 'shooter' && distToPlayer < 600) {
          fireProjectile(g, e.x, e.y, angle, 250, 15 * currentDiffMult, 'enemy_bullet');
          e.fireCooldown = 1.8 + Math.random();
        } else if (e.type === 'missile_boat' && distToPlayer < 800) {
          fireProjectile(g, e.x, e.y, angle - 0.5, 120, 25 * currentDiffMult, 'enemy_missile');
          fireProjectile(g, e.x, e.y, angle + 0.5, 120, 25 * currentDiffMult, 'enemy_missile');
          e.fireCooldown = 4.0;
        }
      }
    }

    // Enemy rams player
    if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < e.radius + g.player.radius) {
      const baseDmg = e.type === 'heavy' ? 20 : 10;
      let dmg = baseDmg * currentDiffMult;
      if (g.player.shield > 0) {
        const absorb = Math.min(g.player.shield, dmg);
        g.player.shield -= absorb; dmg -= absorb;
      }
      g.player.hp -= dmg;
      let eDamage = 20;
      if (e.shield > 0) { const absorb = Math.min(e.shield, eDamage); e.shield -= absorb; eDamage -= absorb; }
      e.hp -= eDamage;
      g.effects.push({ type: 'dmg', x: e.x, y: e.y - 10, text: '20', life: 0.8 });
      e.x += Math.cos(angle + Math.PI) * 30;
      e.y += Math.sin(angle + Math.PI) * 30;
      createParticles(g, g.player.x, g.player.y, 0xef4444, 10);
      if (g.player.hp <= 0) { setGameState('gameover'); return; }
    }

    // Enemy dies
    if (e.hp <= 0) {
      e.active = false;
      if (g.mission.type === 'kill') {
        g.mission.current++;
        if (g.mission.current >= g.mission.target) completeMission();
      } else if (g.mission.type === 'kill_elite' && (e.type === 'missile_boat' || e.type === 'shielded' || e.type === 'heavy')) {
        g.mission.current++;
        if (g.mission.current >= g.mission.target) completeMission();
      }
      createParticles(g, e.x, e.y, e.color, 15);
      const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
      g.pickups.push({ x: e.x, y: e.y, value: val, active: true, radius: 6 });
    }
  }

  // ─── Pickup magnet ────────────────────────────────────────────────────────────
  const currentMagnet = g.player.magnetRadius + (g.levels.magnet - 1) * 35;
  for (let p of g.pickups) {
    if (!p.active) continue;
    const dist = Math.hypot(p.x - g.player.x, p.y - g.player.y);
    if (dist < currentMagnet) {
      const angle = Math.atan2(g.player.y - p.y, g.player.x - p.x);
      p.x += Math.cos(angle) * 500 * dt;
      p.y += Math.sin(angle) * 500 * dt;
      if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
        g.scrap += p.value;
        g.totalScrapEarned += p.value;
        p.active = false;
        if (g.mission.type === 'collect') {
          g.mission.current += p.value;
          if (g.mission.current >= g.mission.target) completeMission();
        }
      }
    }
  }

  // ─── Particles ────────────────────────────────────────────────────────────────
  for (let p of g.particles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.vz) p.z = (p.z || 0) + p.vz * dt;
  }

  // ─── Effects ──────────────────────────────────────────────────────────────────
  for (let e of g.effects) {
    e.life -= dt;
    if (e.type === 'dmg') e.y += 40 * dt;
  }

  // ─── Pool cleanup (every 5 seconds) ──────────────────────────────────────────
  if (g.totalTime % 5 < dt) {
    g.enemies     = g.enemies.filter(e => e.active);
    g.projectiles = g.projectiles.filter(p => p.active);
    g.particles   = g.particles.filter(p => p.active);
    g.pickups     = g.pickups.filter(p => p.active);
    g.effects     = g.effects.filter(e => e.life > 0);
  }
};
