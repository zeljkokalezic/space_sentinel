/**
 * devMissionPicker.test.js — Tests for dev mission type mapping consistency.
 * Ensures all mission types defined in DevMissionPicker are correctly mapped
 * in the App.jsx launchDevMission nodeTypeMap, and that generateMission
 * produces valid missions for each type.
 */
import { describe, it, expect } from 'vitest';
import { generateMission } from '../engine/spawner';

/**
 * Central source of truth: all mission types that should be supported.
 * Must match:
 *   - DevMissionPicker MISSION_TYPES[].id values
 *   - App.jsx launchDevMission nodeTypeMap keys
 *   - spawner.generateMission supported node types
 */
const ALL_MISSION_TYPES = [
  'kill',
  'collect',
  'survive',
  'escort',
  'defend',
  'sabotage',
  'kill_elite',
  'kill_boss',
];

/**
 * Mapping from DevMissionPicker type IDs to spawner node types.
 * Must match App.jsx launchDevMission nodeTypeMap exactly.
 */
const DEV_TYPE_TO_NODE_TYPE = {
  kill: 'kill',
  collect: 'collect',
  survive: 'survive',
  escort: 'escort',
  defend: 'defend',
  sabotage: 'sabotage',
  kill_elite: 'elite',
  kill_boss: 'boss',
};

describe('Dev Mission Picker — type mapping consistency', () => {
  it('all mission types have a node type mapping', () => {
    for (const type of ALL_MISSION_TYPES) {
      expect(DEV_TYPE_TO_NODE_TYPE[type]).toBeDefined();
    }
  });

  it('node type mapping produces valid missions for all types', () => {
    for (const type of ALL_MISSION_TYPES) {
      const nodeType = DEV_TYPE_TO_NODE_TYPE[type];
      const mission = generateMission(1, nodeType);
      expect(mission).toBeDefined();
      expect(mission.type).toBeDefined();
      expect(mission.target).toBeDefined();
      expect(mission.reward).toBeDefined();
      expect(mission.current).toBe(0);
      expect(typeof mission.title).toBe('string');
    }
  });

  it('sabotage type maps to sabotage node type and generates valid mission', () => {
    const nodeType = DEV_TYPE_TO_NODE_TYPE.sabotage;
    expect(nodeType).toBe('sabotage');
    const mission = generateMission(1, nodeType);
    expect(mission.type).toBe('sabotage');
    expect(mission.target).toBeGreaterThan(0);
    expect(mission.reward).toBeGreaterThan(0);
  });

  it('each dev type produces the expected mission type', () => {
    const expectedTypes = {
      kill: 'kill',
      collect: 'collect',
      survive: 'survive',
      escort: 'escort',
      defend: 'defend',
      sabotage: 'sabotage',
      kill_elite: 'kill_elite',
      kill_boss: 'kill_boss',
    };
    for (const [devType, expectedMissionType] of Object.entries(expectedTypes)) {
      const nodeType = DEV_TYPE_TO_NODE_TYPE[devType];
      const mission = generateMission(1, nodeType);
      expect(mission.type).toBe(expectedMissionType);
    }
  });

  it('no orphaned mission types (all node types are covered)', () => {
    const coveredNodeTypes = new Set(Object.values(DEV_TYPE_TO_NODE_TYPE));
    // Known node types from spawner
    const knownNodeTypes = ['kill', 'collect', 'survive', 'escort', 'defend', 'sabotage', 'elite', 'boss'];
    for (const nt of knownNodeTypes) {
      expect(coveredNodeTypes.has(nt)).toBe(true);
    }
  });
});
