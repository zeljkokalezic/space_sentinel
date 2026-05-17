/**
 * targeting.js — Shared hostile target selection.
 */

export const getTargetPosition = (target) => {
  if (!target) return null;
  return { x: target.x, y: target.y };
};

export const isTargetActive = (target) => {
  if (!target) return false;
  if (target.kind === 'structure') return target.active && target.hp > 0;
  if (target.active !== undefined) return target.active && target.hp > 0;
  return target.hp > 0;
};

export const getHostileTargets = (g) => {
  const targets = [];
  for (const e of g.enemies || []) {
    if (e.active && e.hp > 0) targets.push({ ...e, kind: 'enemy', ref: e });
  }
  if (g.boss?.active && g.boss.hp > 0) {
    targets.push({ ...g.boss, kind: 'boss', ref: g.boss });
  }
  if (g.miniboss?.active && g.miniboss.hp > 0) {
    targets.push({ ...g.miniboss, kind: 'miniboss', ref: g.miniboss });
  }
  if (g.sabotage?.active) {
    for (const s of g.sabotage.structures || []) {
      if (s.active && s.hp > 0) targets.push({ ...s, kind: 'structure', ref: s });
    }
  }
  return targets;
};

export const getNearestHostileTarget = (x, y, g) => {
  let nearest = null;
  let minDist = Infinity;
  for (const target of getHostileTargets(g)) {
    const dist = Math.hypot(target.x - x, target.y - y);
    if (dist < minDist) {
      minDist = dist;
      nearest = target.ref;
    }
  }
  return nearest;
};
