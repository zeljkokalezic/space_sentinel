/**
 * systems/environmentalHazards.js — Environmental hazard simulation.
 * Handles asteroid collision, gravity wells, plasma storms, and EMP zones.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} g — Game state
 * @returns {boolean} true if player died (gameover)
 */
import { GAME_CONFIG } from '../../constants/gameConfig';
import { createParticles } from '../combat';

export const updateEnvironmentalHazards = (dt, g) => {
  // Guard for backwards compatibility with tests
  if (!g || !g.hazards || g.hazards.length === 0) return false;

  const player = g.player;
  if (!player) return false;

  for (let i = 0; i < g.hazards.length; i++) {
    const h = g.hazards[i];
    if (!h || !h.active) continue;

    if (h.type === 'asteroid') {
      updateAsteroid(dt, h, g);
    } else if (h.type === 'gravityWell') {
      updateGravityWell(dt, h, g);
    } else if (h.type === 'plasmaStorm') {
      updatePlasmaStorm(dt, h, g);
    } else if (h.type === 'emp') {
      updateEMP(dt, h, g);
    }
  }

  return player.hp <= 0;
};

// ─── Asteroid Field ──────────────────────────────────────────────────────────

const updateAsteroid = (dt, h, g) => {
  const player = g.player;
  const { x, y, radius } = h;

  // Rotate asteroid for visual effect
  h.rotX += h.rotationSpeed * dt;
  h.rotY += h.rotationSpeed * 0.7 * dt;

  // Player collision — push back along collision normal
  const pdx = player.x - x;
  const pdy = player.y - y;
  const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
  const minDist = radius + player.radius;
  if (pdist < minDist && pdist > 0.01) {
    const nx = pdx / pdist;
    const ny = pdy / pdist;
    // Push player to edge of asteroid + small buffer
    const overlap = minDist - pdist;
    player.x += nx * (overlap + 1);
    player.y += ny * (overlap + 1);
    // Dampen velocity in collision direction
    const velDotNormal = player.vx * nx + player.vy * ny;
    if (velDotNormal < 0) {
      player.vx -= velDotNormal * nx * 0.8;
      player.vy -= velDotNormal * ny * 0.8;
    }
  }

  // Enemy collision — push enemies back
  for (const e of g.enemies) {
    if (!e.active) continue;
    const edx = e.x - x;
    const edy = e.y - y;
    const edist = Math.sqrt(edx * edx + edy * edy);
    const eMinDist = radius + (e.radius || 20);
    if (edist < eMinDist && edist > 0.01) {
      const enx = edx / edist;
      const eny = edy / edist;
      const eOverlap = eMinDist - edist;
      e.x += enx * (eOverlap + 1);
      e.y += eny * (eOverlap + 1);
    }
  }

  // Projectile collision — absorb projectiles
  for (const p of g.projectiles) {
    if (!p.active) continue;
    const ppx = p.x - x;
    const ppy = p.y - y;
    const ppDist = Math.sqrt(ppx * ppx + ppy * ppy);
    if (ppDist < radius + (p.radius || 3)) {
      p.active = false;
      // Spawn impact particles
      createParticles(g, p.x, p.y, 3, '#6b7280', 80, 0.5);
    }
  }
};

// ─── Gravity Well ─────────────────────────────────────────────────────────────

const updateGravityWell = (dt, h, g) => {
  const { x, y, radius: pullRadius, pullStrength } = h;

  // Pull player toward center
  const pdx = x - g.player.x;
  const pdy = y - g.player.y;
  const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
  if (pdist < pullRadius && pdist > 1) {
    const nx = pdx / pdist;
    const ny = pdy / pdist;
    // Weaker pull at edge, stronger at center (inverse distance)
    const strength = pullStrength * (1 - pdist / pullRadius) * dt;
    g.player.x += nx * strength;
    g.player.y += ny * strength;
  }

  // Pull enemies toward center
  for (const e of g.enemies) {
    if (!e.active) continue;
    const edx = x - e.x;
    const edy = y - e.y;
    const edist = Math.sqrt(edx * edx + edy * edy);
    if (edist < pullRadius && edist > 1) {
      const enx = edx / edist;
      const eny = edy / edist;
      const strength = pullStrength * (1 - edist / pullRadius) * dt;
      e.x += enx * strength;
      e.y += eny * strength;
    }
  }

  // Pull projectiles toward center (weaker effect)
  for (const p of g.projectiles) {
    if (!p.active) continue;
    const ppdx = x - p.x;
    const ppdy = y - p.y;
    const ppdist = Math.sqrt(ppdx * ppdx + ppdy * ppdy);
    if (ppdist < pullRadius && ppdist > 1) {
      const pnx = ppdx / ppdist;
      const pny = ppdy / ppdist;
      const strength = pullStrength * 0.3 * (1 - ppdist / pullRadius) * dt;
      p.vx += pnx * strength * 10;
      p.vy += pny * strength * 10;
    }
  }
};

// ─── Plasma Storm ─────────────────────────────────────────────────────────────

const updatePlasmaStorm = (dt, h, g) => {
  const { damagePerSecond, radius, respawnTimer: respawnDuration } = h;

  if (h.respawning) {
    // Storm is respawning — move timer down, then respawn
    h.respawnTimer -= dt;
    if (h.respawnTimer <= 0) {
      // Respawn at new edge position
      const angle = Math.random() * Math.PI * 2;
      const dist = 900;
      h.x = Math.cos(angle) * dist;
      h.y = Math.sin(angle) * dist;
      const dirAngle = Math.atan2(-h.y, -h.x) + (Math.random() - 0.5) * 0.5;
      const speed = 60 + g.level * 2;
      h.vx = Math.cos(dirAngle) * speed;
      h.vy = Math.sin(dirAngle) * speed;
      h.timer = 25;
      h.respawning = false;
    }
    return;
  }

  // Move storm
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.timer -= dt;

  // When timer expires, enter respawn phase
  if (h.timer <= 0) {
    h.respawning = true;
    h.respawnTimer = respawnDuration;
    return;
  }

  // Damage player if inside storm
  const pdx = g.player.x - h.x;
  const pdy = g.player.y - h.y;
  const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
  if (pdist < radius) {
    const damage = damagePerSecond * dt;
    // Apply to shield first, then hull
    if (g.player.shield > 0) {
      const shieldAbsorb = Math.min(g.player.shield, damage);
      g.player.shield -= shieldAbsorb;
      const remaining = damage - shieldAbsorb;
      g.player.hp -= remaining;
    } else {
      g.player.hp -= damage;
    }
    // Spawn ambient particles inside storm
    if (Math.random() < 0.3) {
      createParticles(g, h.x + (Math.random() - 0.5) * radius, h.y + (Math.random() - 0.5) * radius, 1, '#a855f7', 60, 0.4);
    }
  }

  // Damage enemies inside storm (2x multiplier)
  for (const e of g.enemies) {
    if (!e.active) continue;
    const edx = e.x - h.x;
    const edy = e.y - h.y;
    const edist = Math.sqrt(edx * edx + edy * edy);
    if (edist < radius) {
      const damage = damagePerSecond * 2 * dt;
      e.hp -= damage;
      if (e.hp <= 0) {
        e.active = false;
        createParticles(g, e.x, e.y, 8, '#a855f7', 100, 0.8);
        // Track kill for persistent stats
        if (g.stats) g.stats.enemiesDestroyed++;
        // Track mission progress (same flow as enemies.js)
        if (g.mission) {
          if (g.mission.type === 'kill') {
            g.mission.current++;
          } else if (g.mission.type === 'kill_elite' && (e.type === 'missile_boat' || e.type === 'shielded' || e.type === 'heavy')) {
            g.mission.current++;
          }
        }
        // Award scrap pickup (same as normal enemy death)
        const val = e.type === 'heavy' ? 5 : (e.type === 'interceptor' ? 2 : 1);
        g.pickups.push({ id: Math.random(), x: e.x, y: e.y, value: val, active: true, radius: 6 });
        // Combo increment
        if (g.combo) {
          const comboConfig = GAME_CONFIG.combo;
          g.combo.count++;
          g.combo.timer = comboConfig.timerDuration;
          let mult = comboConfig.milestones[0].mult;
          for (const m of comboConfig.milestones) {
            if (g.combo.count >= m.count) mult = m.mult;
          }
          g.combo.multiplier = mult;
        }
      }
    }
  }
};

// ─── EMP Zone ─────────────────────────────────────────────────────────────────

const updateEMP = (dt, h, g) => {
  const { radius, cooldown, disableDuration } = h;

  if (h.empActive > 0) {
    // EMP is currently active — countdown
    h.empTimer -= dt;
    if (h.empTimer <= 0) {
      h.empActive = 0;
      h.timer = cooldown; // Reset to full cooldown
    }
    return;
  }

  // Check cooldown
  h.timer -= dt;
  if (h.timer > 0) return;

  // Check if player is within EMP radius
  const pdx = g.player.x - h.x;
  const pdy = g.player.y - h.y;
  const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

  if (pdist < radius) {
    // Activate EMP
    h.empActive = 1;
    h.empTimer = disableDuration;

    // Disable player weapons
    g.cooldowns.autocannon = Math.max(g.cooldowns.autocannon, disableDuration);
    g.cooldowns.plasma = Math.max(g.cooldowns.plasma, disableDuration);
    g.cooldowns.missiles = Math.max(g.cooldowns.missiles, disableDuration);
    g.cooldowns.pointDefense = Math.max(g.cooldowns.pointDefense, disableDuration);

    // Disable enemy weapons
    for (const e of g.enemies) {
      if (!e.active) continue;
      const edx = e.x - h.x;
      const edy = e.y - h.y;
      const edist = Math.sqrt(edx * edx + edy * edy);
      if (edist < radius) {
        e.fireCooldown = Math.max(e.fireCooldown || 0, disableDuration);
      }
    }
  }
};
