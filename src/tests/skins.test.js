import { describe, it, expect } from 'vitest';
import { SHIP_SKINS } from '../constants/skins';
import { createGameState } from '../engine/state';

describe('SHIP_SKINS constant', () => {
  it('has exactly 5 entries', () => {
    expect(SHIP_SKINS).toHaveLength(5);
  });

  it('default skin (index 0) has cost 0', () => {
    expect(SHIP_SKINS[0].cost).toBe(0);
  });

  it('default skin has id "default"', () => {
    expect(SHIP_SKINS[0].id).toBe('default');
  });

  it('all skins have required color properties', () => {
    for (const skin of SHIP_SKINS) {
      expect(skin).toHaveProperty('hullColor');
      expect(skin).toHaveProperty('accentColor');
      expect(skin).toHaveProperty('engineGlow');
      expect(typeof skin.hullColor).toBe('number');
      expect(typeof skin.accentColor).toBe('number');
      expect(typeof skin.engineGlow).toBe('number');
    }
  });

  it('all skins have id, name, and cost properties', () => {
    for (const skin of SHIP_SKINS) {
      expect(skin).toHaveProperty('id');
      expect(skin).toHaveProperty('name');
      expect(skin).toHaveProperty('cost');
      expect(typeof skin.id).toBe('string');
      expect(typeof skin.name).toBe('string');
      expect(typeof skin.cost).toBe('number');
    }
  });

  it('non-default skins have positive costs', () => {
    for (let i = 1; i < SHIP_SKINS.length; i++) {
      expect(SHIP_SKINS[i].cost).toBeGreaterThan(0);
    }
  });
});

describe('createGameState — ship skin fields', () => {
  it('includes shipSkin initialized to 0', () => {
    const state = createGameState();
    expect(state.shipSkin).toBe(0);
  });

  it('includes unlockedSkins array', () => {
    const state = createGameState();
    expect(Array.isArray(state.unlockedSkins)).toBe(true);
  });

  it('unlockedSkins has 5 entries matching SHIP_SKINS count', () => {
    const state = createGameState();
    expect(state.unlockedSkins).toHaveLength(SHIP_SKINS.length);
  });

  it('unlockedSkins[0] is true by default (default skin always unlocked)', () => {
    const state = createGameState();
    expect(state.unlockedSkins[0]).toBe(true);
  });

  it('unlockedSkins[1..4] are false by default', () => {
    const state = createGameState();
    for (let i = 1; i < 5; i++) {
      expect(state.unlockedSkins[i]).toBe(false);
    }
  });
});
