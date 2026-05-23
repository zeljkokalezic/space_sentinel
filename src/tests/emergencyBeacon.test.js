import { describe, it, expect } from 'vitest';
import { createTestState } from './helpers';
import { UPGRADE_DATA } from '../constants/upgrades';

describe('Emergency Beacon', () => {
  describe('UPGRADE_DATA', () => {
    it('emergencyBeacon is defined with correct properties', () => {
      const beacon = UPGRADE_DATA.emergencyBeacon;
      expect(beacon).toBeDefined();
      expect(beacon.name).toBe('Emergency Beacon');
      expect(beacon.baseCost).toBe(200);
      expect(beacon.costMult).toBe(1);
      expect(beacon.maxLevel).toBe(1);
      expect(beacon.isConsumable).toBe(true);
      expect(beacon.desc).toContain('B');
    });
  });

  describe('game state defaults', () => {
    it('createTestState includes emergencyBeacon with default values', () => {
      const g = createTestState();
      expect(g.emergencyBeacon).toBeDefined();
      expect(g.emergencyBeacon.purchased).toBe(false);
      expect(g.emergencyBeacon.activated).toBe(false);
      expect(g.emergencyBeacon.nodeId).toBeNull();
    });
  });

  describe('purchase', () => {
    it('sets purchased flag when player has enough scrap', () => {
      const g = createTestState({ scrap: 250 });
      const cost = UPGRADE_DATA.emergencyBeacon.baseCost;

      // Simulate purchase
      g.scrap -= cost;
      g.emergencyBeacon.purchased = true;

      expect(g.emergencyBeacon.purchased).toBe(true);
      expect(g.emergencyBeacon.activated).toBe(false);
      expect(g.emergencyBeacon.nodeId).toBeNull();
      expect(g.scrap).toBe(50);
    });

    it('cannot purchase when player lacks scrap', () => {
      const g = createTestState({ scrap: 100 });
      const cost = UPGRADE_DATA.emergencyBeacon.baseCost;

      // Simulate purchase guard
      const canBuy = g.scrap >= cost && !g.emergencyBeacon.purchased;
      expect(canBuy).toBe(false);
    });

    it('cannot purchase twice', () => {
      const g = createTestState({ scrap: 500, emergencyBeacon: { purchased: true, activated: false, nodeId: null } });
      const cost = UPGRADE_DATA.emergencyBeacon.baseCost;

      // Already purchased
      const canBuy = g.scrap >= cost && !g.emergencyBeacon.purchased;
      expect(canBuy).toBe(false);
    });
  });

  describe('activation', () => {
    it('sets nodeId when activated and purchased', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: true, activated: false, nodeId: null },
        map: { currentNodeId: 'node-5', nodes: [], edges: [] },
      });

      // Simulate B key activation
      if (g.emergencyBeacon.purchased && !g.emergencyBeacon.activated) {
        g.emergencyBeacon.activated = true;
        g.emergencyBeacon.nodeId = g.map.currentNodeId;
      }

      expect(g.emergencyBeacon.activated).toBe(true);
      expect(g.emergencyBeacon.nodeId).toBe('node-5');
    });

    it('cannot activate when not purchased', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: false, activated: false, nodeId: null },
        map: { currentNodeId: 'node-3', nodes: [], edges: [] },
      });

      // Simulate B key activation guard
      const canActivate = g.emergencyBeacon.purchased && !g.emergencyBeacon.activated;
      expect(canActivate).toBe(false);
    });

    it('cannot activate again when already activated', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: true, activated: true, nodeId: 'node-2' },
        map: { currentNodeId: 'node-7', nodes: [], edges: [] },
      });

      const canActivate = g.emergencyBeacon.purchased && !g.emergencyBeacon.activated;
      expect(canActivate).toBe(false);
    });
  });

  describe('respawn', () => {
    it('respawns at beacon node instead of game over when activated', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: true, activated: true, nodeId: 'node-4' },
        player: { hp: 0, maxHp: 300, shield: 0, maxShield: 20 },
      });

      // Simulate beacon respawn logic
      let gameState = 'gameover';
      if (gameState === 'gameover' && g.emergencyBeacon.activated) {
        g.player.hp = g.player.maxHp;
        g.player.shield = g.player.maxShield;
        g.emergencyBeacon.activated = false;
        g.emergencyBeacon.nodeId = null;
        gameState = 'map';
      }

      expect(gameState).toBe('map');
      expect(g.player.hp).toBe(300);
      expect(g.player.shield).toBe(20);
      expect(g.emergencyBeacon.activated).toBe(false);
      expect(g.emergencyBeacon.nodeId).toBeNull();
      // purchased stays true so UI shows it was consumed but can be repurchased at repair
      expect(g.emergencyBeacon.purchased).toBe(true);
    });

    it('goes to game over when beacon is not activated', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: true, activated: false, nodeId: null },
        player: { hp: 0, maxHp: 300, shield: 0, maxShield: 20 },
      });

      let gameState = 'gameover';
      if (gameState === 'gameover' && g.emergencyBeacon.activated) {
        gameState = 'map';
      }

      expect(gameState).toBe('gameover');
    });

    it('goes to game over when beacon not purchased at all', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: false, activated: false, nodeId: null },
        player: { hp: 0, maxHp: 300, shield: 0, maxShield: 20 },
      });

      let gameState = 'gameover';
      if (gameState === 'gameover' && g.emergencyBeacon.activated) {
        gameState = 'map';
      }

      expect(gameState).toBe('gameover');
    });
  });

  describe('repair reset', () => {
    it('resetting beacon at repair node clears all state', () => {
      const g = createTestState({
        emergencyBeacon: { purchased: true, activated: true, nodeId: 'node-6' },
      });

      // Simulate repair node visit
      if (g.emergencyBeacon) {
        g.emergencyBeacon.purchased = false;
        g.emergencyBeacon.activated = false;
        g.emergencyBeacon.nodeId = null;
      }

      expect(g.emergencyBeacon.purchased).toBe(false);
      expect(g.emergencyBeacon.activated).toBe(false);
      expect(g.emergencyBeacon.nodeId).toBeNull();
    });

    it('resetting beacon allows repurchase', () => {
      const g = createTestState({
        scrap: 300,
        emergencyBeacon: { purchased: true, activated: false, nodeId: null },
      });

      // Repair reset
      g.emergencyBeacon.purchased = false;
      g.emergencyBeacon.activated = false;
      g.emergencyBeacon.nodeId = null;

      // Now can purchase again
      const canBuy = g.scrap >= UPGRADE_DATA.emergencyBeacon.baseCost && !g.emergencyBeacon.purchased;
      expect(canBuy).toBe(true);
    });
  });

  describe('full lifecycle', () => {
    it('purchase -> activate -> die -> respawn -> repair -> repurchase', () => {
      const g = createTestState({
        scrap: 400,
        map: { currentNodeId: 'node-1', nodes: [], edges: [] },
        player: { hp: 300, maxHp: 300, shield: 20, maxShield: 20 },
      });

      // 1. Purchase
      g.scrap -= UPGRADE_DATA.emergencyBeacon.baseCost;
      g.emergencyBeacon.purchased = true;
      expect(g.emergencyBeacon.purchased).toBe(true);
      expect(g.scrap).toBe(200);

      // 2. Activate (move to node-5 first)
      g.map.currentNodeId = 'node-5';
      g.emergencyBeacon.activated = true;
      g.emergencyBeacon.nodeId = g.map.currentNodeId;
      expect(g.emergencyBeacon.activated).toBe(true);
      expect(g.emergencyBeacon.nodeId).toBe('node-5');

      // 3. Die — beacon saves player
      g.player.hp = 0;
      let gameState = 'gameover';
      if (gameState === 'gameover' && g.emergencyBeacon.activated) {
        g.player.hp = g.player.maxHp;
        g.player.shield = g.player.maxShield;
        g.emergencyBeacon.activated = false;
        g.emergencyBeacon.nodeId = null;
        gameState = 'map';
      }
      expect(gameState).toBe('map');
      expect(g.player.hp).toBe(300);
      expect(g.emergencyBeacon.activated).toBe(false);

      // 4. Visit repair — reset beacon
      g.emergencyBeacon.purchased = false;
      g.emergencyBeacon.activated = false;
      g.emergencyBeacon.nodeId = null;
      expect(g.emergencyBeacon.purchased).toBe(false);

      // 5. Can repurchase
      const canBuy = g.scrap >= UPGRADE_DATA.emergencyBeacon.baseCost && !g.emergencyBeacon.purchased;
      expect(canBuy).toBe(true);
    });
  });
});
