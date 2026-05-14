/**
 * systems/pickups.js — Scrap pickup magnet attraction and collection.
 */
import { GAME_CONFIG } from '../../constants/gameConfig';

/**

 * @param {number} dt — Delta time
 * @param {object} g — Game state
 * @param {function} completeMission — Mission completion callback
 */
export const updatePickups = (dt, g, completeMission) => {
  const C = GAME_CONFIG
  // ── Combo timer decay ──
  if (g.combo && g.combo.timer > 0) {
    g.combo.timer -= dt
    if (g.combo.timer <= 0) {
      g.combo.count = 0
      g.combo.multiplier = 1
      g.combo.timer = 0
    }
  }
  const currentMagnet = g.player.magnetRadius + (g.levels.magnet - 1) * C.magnet.radiusPerLevel
  for (let p of g.pickups) {
    if (!p.active) continue
    const dist = Math.hypot(p.x - g.player.x, p.y - g.player.y)
    if (dist < currentMagnet) {
      const angle = Math.atan2(g.player.y - p.y, g.player.x - p.x)
      p.x += Math.cos(angle) * C.magnet.pullSpeed * dt
      p.y += Math.sin(angle) * C.magnet.pullSpeed * dt
      if (Math.hypot(p.x - g.player.x, p.y - g.player.y) < g.player.radius + p.radius) {
        const mult = g.combo?.multiplier ?? 1
        const value = Math.floor(p.value * mult)
        g.scrap += value
        g.totalScrapEarned += value
        if (g.stats) g.stats.totalScrap += value
        p.active = false
        if (g.mission && g.mission.type === 'collect') {
          g.mission.current += p.value
          if (g.mission.current >= g.mission.target) completeMission()
        }
      }
    }
  }
}
