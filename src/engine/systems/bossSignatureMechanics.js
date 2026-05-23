/**
 * systems/bossSignatureMechanics.js — Boss signature mechanic system.
 *
 * Handles boss-unique mechanics based on each boss's signatureMechanic config:
 * - Void Reaper: void_zones — dark zones that damage and slow the player
 * - Nexus Prime: shield_regen — regenerates HP when not taking damage
 * - Phantom Warden: phase_shift — teleports boss and leaves a decoy
 *
 * Pure engine module; no React imports.
 */

import { fireProjectile } from '../combat';

/* ──────────────────────────────────────────────
 * Public API
 * ────────────────────────────────────────────── */

/**
 * Main dispatcher — delegates to the appropriate mechanic handler
 * based on boss.signatureMechanic.type.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} boss — Boss state object (from g.boss)
 * @param {object} g — Full game state
 */
export function updateBossSignatureMechanics(dt, boss, g) {
  if (!boss.active || !boss.signatureMechanic) return;

  const type = boss.signatureMechanic.type;

  switch (type) {
    case 'void_zones':
      updateVoidZones(dt, boss, g);
      break;
    case 'shield_regen':
      updateShieldRegen(dt, boss);
      break;
    case 'phase_shift':
      updatePhaseShift(dt, boss, g);
      break;
    default:
      break;
  }
}

/**
 * Call this when the boss takes damage. Resets the shield regen timer
 * for Nexus Prime so regeneration is paused.
 *
 * @param {object} boss — Boss state object
 */
export function onBossDamaged(boss) {
  if (!boss.signatureMechanic) return;

  if (boss.signatureMechanic.type === 'shield_regen') {
    boss.regenTimer = 0;
    boss.regenActive = false;
  }
}

/**
 * Check player collision against all active void zones.
 * Applies damage per second and speed slow factor while inside.
 *
 * @param {object} g — Full game state
 */
export function checkVoidZoneCollision(g) {
  const boss = g.boss;
  const player = g.player;

  if (!boss || !boss.voidZones || !player) return;
  if (player.active === false) return;

  let inZone = false;

  for (const zone of boss.voidZones) {
    if (!zone.active) continue;

    const dx = player.x - zone.x;
    const dy = player.y - zone.y;
    const dist = Math.hypot(dx, dy);

    if (dist < zone.radius + player.radius) {
      inZone = true;
      break;
    }
  }

  if (inZone && boss.signatureMechanic && boss.signatureMechanic.type === 'void_zones') {
    // Apply slow factor to player speed
    const slowFactor = boss.signatureMechanic.zoneSlowFactor ?? 0.7;
    player.speed = (boss._originalSpeed ?? g.player.speed) * slowFactor;

    // Track that player is in a void zone for continuous damage in the game loop
    player._inVoidZone = true;
  } else {
    // Restore original speed when leaving zone
    if (boss._originalSpeed && player._inVoidZone) {
      player.speed = boss._originalSpeed;
    }
    player._inVoidZone = false;
  }
}

/**
 * Update a decoy entity — fires at the player and expires after its lifetime.
 *
 * @param {number} dt — Delta time in seconds
 * @param {object} decoy — Decoy entity
 * @param {object} g — Full game state
 * @returns {boolean} — True if decoy is still alive
 */
export function updateDecoy(dt, decoy, g) {
  if (!decoy || !decoy.active) return false;

  // Decrease lifetime
  decoy.life -= dt;
  if (decoy.life <= 0) {
    decoy.active = false;
    return false;
  }

  // Fire at player
  decoy.fireTimer -= dt;
  if (decoy.fireTimer <= 0 && g.player && g.player.active !== false) {
    const dx = g.player.x - decoy.x;
    const dy = g.player.y - decoy.y;
    const angle = Math.atan2(dy, dx);

    fireProjectile(
      g,
      decoy.x,
      decoy.y,
      angle,
      decoy.projectileSpeed ?? 350,
      decoy.damage,
      'enemy_bullet'
    );

    decoy.fireTimer = decoy.fireRate;
  }

  return true;
}

/* ──────────────────────────────────────────────
 * Void Reaper — void_zones mechanic
 * ────────────────────────────────────────────── */

/**
 * Spawn a single void zone at a random position 300-800 units from the player.
 *
 * @param {object} boss — Boss state
 * @param {object} g — Game state
 */
function spawnVoidZone(boss, g) {
  const player = g.player;
  if (!player) return;

  const config = boss.signatureMechanic;
  const minDist = 300;
  const maxDist = 800;

  const angle = Math.random() * Math.PI * 2;
  const dist = minDist + Math.random() * (maxDist - minDist);

  const zone = {
    x: player.x + Math.cos(angle) * dist,
    y: player.y + Math.sin(angle) * dist,
    radius: 60,
    life: config.zoneLifetime ?? 8,
    maxLife: config.zoneLifetime ?? 8,
    active: true,
  };

  boss.voidZones.push(zone);
}

/**
 * Update void zones: spawn new ones, expire old ones, apply damage.
 *
 * @param {number} dt — Delta time
 * @param {object} boss — Boss state
 * @param {object} g — Game state
 */
function updateVoidZones(dt, boss, g) {
  const config = boss.signatureMechanic;
  if (!config) return;

  // Store original speed on first call
  if (boss._originalSpeed === undefined && g.player) {
    boss._originalSpeed = g.player.speed;
  }

  // Update spawn timer
  boss.voidZoneSpawnTimer -= dt;

  // Determine spawn interval based on phase
  const spawnInterval =
    boss.phase >= 2 && config.phase2SpawnInterval
      ? config.phase2SpawnInterval
      : config.spawnInterval;

  // Spawn new zone if timer expired and under max
  if (boss.voidZoneSpawnTimer <= 0) {
    const activeCount = boss.voidZones.filter(z => z.active).length;
    const maxZones = config.maxZones ?? 3;

    if (activeCount < maxZones) {
      spawnVoidZone(boss, g);
    }

    boss.voidZoneSpawnTimer = spawnInterval;
  }

  // Update existing zones: decrement lifetime, remove expired
  for (let i = boss.voidZones.length - 1; i >= 0; i--) {
    const zone = boss.voidZones[i];
    if (!zone.active) {
      boss.voidZones.splice(i, 1);
      continue;
    }

    zone.life -= dt;
    if (zone.life <= 0) {
      zone.active = false;
      boss.voidZones.splice(i, 1);
    }
  }

  // Apply damage to player if inside any zone
  if (g.player && g.player.active !== false && g.player._inVoidZone) {
    const dmgPerSec = config.zoneDamagePerSecond ?? 10;
    const damage = dmgPerSec * dt;
    g.player.hp -= damage;
  }
}

/* ──────────────────────────────────────────────
 * Nexus Prime — shield_regen mechanic
 * ────────────────────────────────────────────── */

/**
 * Update shield regeneration: track time since last damage,
 * regenerate HP after threshold.
 *
 * @param {number} dt — Delta time
 * @param {object} boss — Boss state
 */
function updateShieldRegen(dt, boss) {
  const config = boss.signatureMechanic;
  if (!config) return;

  // Increment regen timer (time since last damage)
  boss.regenTimer += dt;

  const threshold = config.noDamageThreshold ?? 3;

  // Start regenerating after threshold is met
  if (boss.regenTimer > threshold) {
    boss.regenActive = true;

    const regenPercent = config.regenPercentPerSecond ?? 0.05;
    const regenAmount = boss.maxHp * regenPercent * dt;
    boss.hp = Math.min(boss.maxHp, boss.hp + regenAmount);
  } else {
    boss.regenActive = false;
  }
}

/* ──────────────────────────────────────────────
 * Phantom Warden — phase_shift mechanic
 * ────────────────────────────────────────────── */

/**
 * Update phase shift: countdown timer, teleport boss, spawn decoy.
 *
 * @param {number} dt — Delta time
 * @param {object} boss — Boss state
 * @param {object} g — Game state
 */
function updatePhaseShift(dt, boss, g) {
  const config = boss.signatureMechanic;
  if (!config) return;

  // Initialize timer from config if not set
  if (boss.phaseShiftTimer === 0) {
    boss.phaseShiftTimer = config.teleportInterval ?? 15;
  }

  // Update existing decoy
  if (boss.decoy && boss.decoy.active) {
    const alive = updateDecoy(dt, boss.decoy, g);
    if (!alive) {
      boss.decoy = null;
    }
  }

  // Decrement phase shift timer
  boss.phaseShiftTimer -= dt;

  // Trigger phase shift when timer expires
  if (boss.phaseShiftTimer <= 0) {
    triggerPhaseShift(boss);
  }
}

/**
 * Execute a phase shift: teleport boss to a random edge,
 * leave a decoy at the old position.
 *
 * @param {object} boss — Boss state
 */
function triggerPhaseShift(boss) {
  const config = boss.signatureMechanic;
  if (!config) return;

  // Save old position for decoy
  const oldX = boss.x;
  const oldY = boss.y;

  // Teleport boss to a random edge of the arena
  const edge = Math.floor(Math.random() * 4);
  const arenaHalf = 1200; // approximate arena half-size

  switch (edge) {
    case 0: // top
      boss.x = (Math.random() - 0.5) * arenaHalf * 2;
      boss.y = -arenaHalf;
      break;
    case 1: // bottom
      boss.x = (Math.random() - 0.5) * arenaHalf * 2;
      boss.y = arenaHalf;
      break;
    case 2: // left
      boss.x = -arenaHalf;
      boss.y = (Math.random() - 0.5) * arenaHalf * 2;
      break;
    case 3: // right
      boss.x = arenaHalf;
      boss.y = (Math.random() - 0.5) * arenaHalf * 2;
      break;
  }

  // Create decoy at old position
  boss.decoy = {
    active: true,
    x: oldX,
    y: oldY,
    hp: 50,
    maxHp: 50,
    radius: 30,
    life: config.decoyLifetime ?? 3,
    maxLife: config.decoyLifetime ?? 3,
    fireTimer: 0.5, // fire shortly after spawning
    fireRate: config.decoyFireRate ?? 1.0,
    damage: config.decoyProjectileDamage ?? 15,
    projectileSpeed: 350,
    color: 0x22d3ee,
  };

  // Reset phase shift timer for next teleport
  boss.phaseShiftTimer = config.teleportInterval ?? 15;
}
