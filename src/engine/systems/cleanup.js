/**
 * systems/cleanup.js - Dead entity recycling and spatial culling.
 */

/**
 * @param {number} dt — Delta time
 * @param {object} g — Game state
 */
export const cleanup = (dt, g) => {
  const cullDistSq = 3000 * 3000;
  const px = g.player.x;
  const py = g.player.y;

  cleanupEntities(g, 'enemies', (e) => e.active && inBounds(e, px, py, cullDistSq));
  cleanupEntities(g, 'projectiles', (p) => p.active && inBounds(p, px, py, cullDistSq));
  cleanupEntities(g, 'particles', (p) => p.active && p.life > 0 && inBounds(p, px, py, cullDistSq));
  cleanupEntities(g, 'pickups', (p) => p.active && inBounds(p, px, py, cullDistSq));
  cleanupEntities(g, 'powerups', (p) => p.active && inBounds(p, px, py, cullDistSq));
  cleanupEntities(g, 'effects', (e) => e.life > 0);

  compactArray(g.spawnFlashes, (f) => f.active);
  compactArray(g.scrapFloats, (f) => f.active);
};

function cleanupEntities(g, type, keep) {
  const pool = g.entityPools?.[type];
  if (pool && g[type] === pool.active) recyclePool(pool, keep);
  else compactArray(g[type], keep);
}

function inBounds(e, px, py, cullDistSq) {
  const dx = e.x - px, dy = e.y - py;
  return dx * dx + dy * dy < cullDistSq;
}

function recyclePool(pool, keep) {
  if (!pool) return;
  for (let i = pool.active.length - 1; i >= 0; i--) {
    const entity = pool.active[i];
    if (!keep(entity)) pool.release(entity);
  }
}

function compactArray(arr, keep) {
  if (!arr) return;
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    const item = arr[read];
    if (keep(item)) {
      arr[write] = item;
      write++;
    }
  }
  arr.length = write;
}
