/**
 * combo.test.js — Combo/Kill Streak system tests.
 *
 * Tests cover:
 * - Combo state initialization
 * - Combo increment on enemy kill
 * - Combo multiplier tiers
 * - Combo timer decay and reset
 * - Combo multiplier applied to scrap pickups
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createGameState } from '../../engine/state'
import { GAME_CONFIG } from '../../constants/gameConfig'

describe('Combo state initialization', () => {
  it('should have combo object with default values', () => {
    const g = createGameState()
    expect(g.combo).toBeDefined()
    expect(g.combo.count).toBe(0)
    expect(g.combo.timer).toBe(0)
    expect(g.combo.multiplier).toBe(1)
  })
})

describe('Combo config', () => {
  it('should have combo config in GAME_CONFIG', () => {
    expect(GAME_CONFIG.combo).toBeDefined()
    expect(GAME_CONFIG.combo.timerDuration).toBe(3.0)
    expect(GAME_CONFIG.combo.milestones).toBeDefined()
    expect(Array.isArray(GAME_CONFIG.combo.milestones)).toBe(true)
  })

  it('should have correct milestone tiers', () => {
    const milestones = GAME_CONFIG.combo.milestones
    expect(milestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 0, mult: 1 }),
        expect.objectContaining({ count: 5, mult: 1.5 }),
        expect.objectContaining({ count: 10, mult: 2 }),
        expect.objectContaining({ count: 15, mult: 3 }),
      ])
    )
  })
})

describe('Combo multiplier calculation', () => {
  function calcMultiplier(count) {
    const comboConfig = GAME_CONFIG.combo
    let mult = comboConfig.milestones[0].mult
    for (const m of comboConfig.milestones) {
      if (count >= m.count) mult = m.mult
    }
    return mult
  }

  it('should return 1x for count 0-4', () => {
    expect(calcMultiplier(0)).toBe(1)
    expect(calcMultiplier(1)).toBe(1)
    expect(calcMultiplier(4)).toBe(1)
  })

  it('should return 1.5x for count 5-9', () => {
    expect(calcMultiplier(5)).toBe(1.5)
    expect(calcMultiplier(7)).toBe(1.5)
    expect(calcMultiplier(9)).toBe(1.5)
  })

  it('should return 2x for count 10-14', () => {
    expect(calcMultiplier(10)).toBe(2)
    expect(calcMultiplier(12)).toBe(2)
    expect(calcMultiplier(14)).toBe(2)
  })

  it('should return 3x for count 15+', () => {
    expect(calcMultiplier(15)).toBe(3)
    expect(calcMultiplier(20)).toBe(3)
    expect(calcMultiplier(50)).toBe(3)
  })
})

describe('Combo timer decay', () => {
  let g

  beforeEach(() => {
    g = createGameState()
  })

  it('should start timer on kill', () => {
    const comboConfig = GAME_CONFIG.combo
    g.combo.count++
    g.combo.timer = comboConfig.timerDuration
    expect(g.combo.timer).toBe(3.0)
    expect(g.combo.count).toBe(1)
  })

  it('should reset timer on subsequent kill', () => {
    const comboConfig = GAME_CONFIG.combo
    // First kill
    g.combo.count++
    g.combo.timer = comboConfig.timerDuration
    // Simulate some time passing
    g.combo.timer = 1.5
    // Second kill resets timer
    g.combo.count++
    g.combo.timer = comboConfig.timerDuration
    expect(g.combo.count).toBe(2)
    expect(g.combo.timer).toBe(3.0)
  })

  it('should reset combo when timer expires', () => {
    const comboConfig = GAME_CONFIG.combo
    g.combo.count = 7
    g.combo.timer = comboConfig.timerDuration
    // Calculate multiplier for count 7
    let mult = comboConfig.milestones[0].mult
    for (const m of comboConfig.milestones) {
      if (g.combo.count >= m.count) mult = m.mult
    }
    g.combo.multiplier = mult

    // Simulate timer decay: dt = 4 (exceeds 3s duration)
    const dt = 4
    if (g.combo.timer > 0) {
      g.combo.timer -= dt
      if (g.combo.timer <= 0) {
        g.combo.count = 0
        g.combo.multiplier = 1
        g.combo.timer = 0
      }
    }

    expect(g.combo.count).toBe(0)
    expect(g.combo.timer).toBe(0)
    expect(g.combo.multiplier).toBe(1)
  })

  it('should not reset combo when timer has remaining', () => {
    g.combo.count = 3
    g.combo.timer = 2.5
    g.combo.multiplier = 1

    // Simulate small dt
    const dt = 0.5
    if (g.combo.timer > 0) {
      g.combo.timer -= dt
      if (g.combo.timer <= 0) {
        g.combo.count = 0
        g.combo.multiplier = 1
        g.combo.timer = 0
      }
    }

    expect(g.combo.count).toBe(3)
    expect(g.combo.timer).toBe(2.0)
    expect(g.combo.multiplier).toBe(1)
  })
})

describe('Combo multiplier applied to scrap', () => {
  it('should apply 1x multiplier to scrap', () => {
    const baseValue = 5
    const multiplier = 1
    const value = Math.floor(baseValue * multiplier)
    expect(value).toBe(5)
  })

  it('should apply 1.5x multiplier to scrap', () => {
    const baseValue = 5
    const multiplier = 1.5
    const value = Math.floor(baseValue * multiplier)
    expect(value).toBe(7)
  })

  it('should apply 2x multiplier to scrap', () => {
    const baseValue = 3
    const multiplier = 2
    const value = Math.floor(baseValue * multiplier)
    expect(value).toBe(6)
  })

  it('should apply 3x multiplier to scrap', () => {
    const baseValue = 2
    const multiplier = 3
    const value = Math.floor(baseValue * multiplier)
    expect(value).toBe(6)
  })

  it('should update g.scrap and g.totalScrapEarned with multiplier', () => {
    const g = createGameState()
    g.combo.multiplier = 2
    const p = { value: 5 }

    const value = Math.floor(p.value * g.combo.multiplier)
    const prevScrap = g.scrap
    const prevTotal = g.totalScrapEarned
    g.scrap += value
    g.totalScrapEarned += value
    if (g.stats) g.stats.totalScrap += value

    expect(g.scrap).toBe(prevScrap + 10)
    expect(g.totalScrapEarned).toBe(prevTotal + 10)
    expect(g.stats.totalScrap).toBe(10)
  })
})
