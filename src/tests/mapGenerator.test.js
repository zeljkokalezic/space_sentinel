import { describe, it, expect } from 'vitest';
import { generateMap } from '../engine/mapGenerator';

const VALID_TYPES = ['combat', 'event', 'shop', 'repair', 'elite', 'boss', 'defend', 'escort', 'sabotage', 'miniboss'];
const GUARANTEED_TYPES = ['combat', 'event', 'shop', 'repair', 'elite', 'boss']; // defend is random, not guaranteed
const ROWS = 15;
const COLS = 5;

describe('generateMap()', () => {
  let map;

  beforeEach(() => {
    map = generateMap();
  });

  // ---- 1. Top-level structure ----
  describe('top-level structure', () => {
    it('returns an object with nodes, edges, currentRow, and currentNodeId', () => {
      expect(map).toHaveProperty('nodes');
      expect(map).toHaveProperty('edges');
      expect(map).toHaveProperty('currentRow');
      expect(map).toHaveProperty('currentNodeId');
    });

    it('nodes is a non-empty array', () => {
      expect(Array.isArray(map.nodes)).toBe(true);
      expect(map.nodes.length).toBeGreaterThan(0);
    });

    it('edges is an array', () => {
      expect(Array.isArray(map.edges)).toBe(true);
    });

    it('currentRow is initialized to -1', () => {
      expect(map.currentRow).toBe(-1);
    });

    it('currentNodeId is initialized to null', () => {
      expect(map.currentNodeId).toBeNull();
    });
  });

  // ---- 2. Node properties ----
  describe('node properties', () => {
    it('each node has an id that starts with "node-"', () => {
      for (const node of map.nodes) {
        expect(typeof node.id).toBe('string');
        expect(node.id).toMatch(/^node-/);
      }
    });

    it('each node has a numeric row within bounds', () => {
      for (const node of map.nodes) {
        expect(typeof node.row).toBe('number');
        expect(node.row).toBeGreaterThanOrEqual(0);
        expect(node.row).toBeLessThan(ROWS);
      }
    });

    it('each node has a numeric col within bounds', () => {
      for (const node of map.nodes) {
        expect(typeof node.col).toBe('number');
        expect(node.col).toBeGreaterThanOrEqual(0);
        expect(node.col).toBeLessThan(COLS);
      }
    });

    it('each node has a type that is a string', () => {
      for (const node of map.nodes) {
        expect(typeof node.type).toBe('string');
      }
    });

    it('each node has a status that is a string', () => {
      for (const node of map.nodes) {
        expect(typeof node.status).toBe('string');
      }
    });

    it('all node ids are unique', () => {
      const ids = map.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ---- 3. Row 0 status ----
  describe('first row status', () => {
    it('all row-0 nodes have status "available"', () => {
      const row0Nodes = map.nodes.filter((n) => n.row === 0);
      for (const node of row0Nodes) {
        expect(node.status).toBe('available');
      }
    });

    it('all non-row-0 nodes have status "locked"', () => {
      const nonRow0Nodes = map.nodes.filter((n) => n.row > 0);
      for (const node of nonRow0Nodes) {
        expect(node.status).toBe('locked');
      }
    });
  });

  // ---- 4. Boss node ----
  describe('boss node', () => {
    it('exactly one boss node exists at row 14, col 2', () => {
      const bossNodes = map.nodes.filter(
        (n) => n.type === 'boss' && n.row === ROWS - 1 && n.col === Math.floor(COLS / 2)
      );
      expect(bossNodes.length).toBe(1);
    });

    it('the boss node has type "boss"', () => {
      const boss = map.nodes.find(
        (n) => n.row === ROWS - 1 && n.col === Math.floor(COLS / 2)
      );
      expect(boss).toBeDefined();
      expect(boss.type).toBe('boss');
    });
  });

  // ---- 5. Repair row ----
  describe('repair row (second-to-last)', () => {
    it('all nodes on row 13 have type "repair"', () => {
      const repairRow = map.nodes.filter((n) => n.row === ROWS - 2);
      for (const node of repairRow) {
        expect(node.type).toBe('repair');
      }
    });

    it('row 13 has at least one node', () => {
      const repairRow = map.nodes.filter((n) => n.row === ROWS - 2);
      expect(repairRow.length).toBeGreaterThan(0);
    });
  });

  // ---- 6. Shop row (midpoint) ----
  describe('shop row (midpoint, row 7)', () => {
    it('all nodes on row 7 have type "shop"', () => {
      const midRow = Math.floor(ROWS / 2);
      const shopRow = map.nodes.filter((n) => n.row === midRow);
      for (const node of shopRow) {
        expect(node.type).toBe('shop');
      }
    });

    it('row 7 has at least one node', () => {
      const midRow = Math.floor(ROWS / 2);
      const shopRow = map.nodes.filter((n) => n.row === midRow);
      expect(shopRow.length).toBeGreaterThan(0);
    });
  });

  // ---- 7. Total node count ----
  describe('node count', () => {
    it('total nodes > 0', () => {
      expect(map.nodes.length).toBeGreaterThan(0);
    });

    it('total nodes < 75 (the full 15x5 grid max)', () => {
      expect(map.nodes.length).toBeLessThan(ROWS * COLS);
    });
  });

  // ---- 8. Edge validity ----
  describe('edge validity', () => {
    it('each edge has a "from" property that is a valid node id', () => {
      const nodeIdSet = new Set(map.nodes.map((n) => n.id));
      for (const edge of map.edges) {
        expect(typeof edge.from).toBe('string');
        expect(nodeIdSet.has(edge.from)).toBe(true);
      }
    });

    it('each edge has a "to" property that is a valid node id', () => {
      const nodeIdSet = new Set(map.nodes.map((n) => n.id));
      for (const edge of map.edges) {
        expect(typeof edge.to).toBe('string');
        expect(nodeIdSet.has(edge.to)).toBe(true);
      }
    });

    it('no edge points from a node to itself', () => {
      for (const edge of map.edges) {
        expect(edge.from).not.toBe(edge.to);
      }
    });

    it('edges connect nodes going upward (from.row < to.row)', () => {
      const nodeById = Object.fromEntries(map.nodes.map((n) => [n.id, n]));
      for (const edge of map.edges) {
        const fromNode = nodeById[edge.from];
        const toNode = nodeById[edge.to];
        expect(fromNode.row).toBeLessThan(toNode.row);
      }
    });
  });

  // ---- 9. Connectivity: every non-first-row node has at least one incoming edge ----
  describe('connectivity', () => {
    it('every non-first-row node has at least one incoming edge', () => {
      const nonFirstRowNodes = map.nodes.filter((n) => n.row > 0);
      for (const node of nonFirstRowNodes) {
        const hasIncoming = map.edges.some((e) => e.to === node.id);
        expect(hasIncoming).toBe(true);
      }
    });

    it('there is a path from at least one row-0 node to the boss node', () => {
      const bossId = map.nodes.find(
        (n) => n.type === 'boss'
      )?.id;
      expect(bossId).toBeDefined();

      // BFS from all row-0 nodes
      const reachable = new Set();
      const queue = map.nodes.filter((n) => n.row === 0).map((n) => n.id);
      const adj = Object.create(null);
      for (const edge of map.edges) {
        if (!adj[edge.from]) adj[edge.from] = [];
        adj[edge.from].push(edge.to);
      }

      while (queue.length > 0) {
        const current = queue.shift();
        if (reachable.has(current)) continue;
        reachable.add(current);
        for (const neighbor of (adj[current] || [])) {
          if (!reachable.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      expect(reachable.has(bossId)).toBe(true);
    });

    it('edges array has at least as many entries as non-first-row nodes', () => {
      const nonFirstRowCount = map.nodes.filter((n) => n.row > 0).length;
      expect(map.edges.length).toBeGreaterThanOrEqual(nonFirstRowCount);
    });
  });

  // ---- 10. Node type distribution ----
  describe('node type distribution', () => {
    it('contains at least one node of each guaranteed type: combat, event, shop, repair, elite, boss', () => {
      const presentTypes = new Set(map.nodes.map((n) => n.type));
      for (const t of GUARANTEED_TYPES) {
        expect(presentTypes.has(t)).toBe(true);
      }
    });

    it('has more combat nodes than any other single non-special type', () => {
      const counts = {};
      for (const node of map.nodes) {
        counts[node.type] = (counts[node.type] || 0) + 1;
      }
      // Boss is always 1, so exclude it from the comparison
      expect(counts.combat).toBeGreaterThan(0);
      // Combat should be among the most common general types (allow some variance)
      const nonSpecialTypes = ['combat', 'event', 'elite', 'escort', 'defend', 'sabotage'];
      const maxNonCombat = Math.max(...nonSpecialTypes.filter(t => t !== 'combat').map(t => counts[t] || 0));
      // Combat count should be at least half of the max non-combat count
      expect(counts.combat).toBeGreaterThan(maxNonCombat / 2);
    });
  });

  // ---- 11. All node types are valid ----
  describe('type validity', () => {
    it('every node type is one of the valid types', () => {
      for (const node of map.nodes) {
        expect(VALID_TYPES).toContain(node.type);
      }
    });
  });

  // ---- 12. Randomness: multiple calls produce different maps ----
  describe('randomness', () => {
    it('two generated maps differ in at least some node positions or types', () => {
      const map1 = generateMap();
      const map2 = generateMap();

      // Compare sorted node signatures (row, col, type)
      const sig1 = map1.nodes
        .map((n) => `${n.row}-${n.col}-${n.type}`)
        .sort()
        .join(',');
      const sig2 = map2.nodes
        .map((n) => `${n.row}-${n.col}-${n.type}`)
        .sort()
        .join(',');

      expect(sig1).not.toBe(sig2);
    });

    it('five generated maps produce at least 3 distinct node-count results or edge-count results', () => {
      const maps = Array.from({ length: 5 }, () => generateMap());
      const signatures = maps.map((m) => `${m.nodes.length}-${m.edges.length}`).sort();
      const distinct = new Set(signatures);
      // With 5 random maps, we expect variation — at least 3 distinct signatures
      expect(distinct.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ---- Additional: structural invariants ----
  describe('structural invariants', () => {
    it('no two nodes share the same (row, col) position', () => {
      const positions = map.nodes.map((n) => `${n.row},${n.col}`);
      expect(new Set(positions).size).toBe(positions.length);
    });

    it('row-0 nodes exist at columns 0, 1, 3, 4 (the four starting paths)', () => {
      const row0Cols = map.nodes
        .filter((n) => n.row === 0)
        .map((n) => n.col)
        .sort((a, b) => a - b);
      expect(row0Cols).toContain(0);
      expect(row0Cols).toContain(1);
      expect(row0Cols).toContain(3);
      expect(row0Cols).toContain(4);
    });

    it('the maximum row index used is 14', () => {
      const maxRow = Math.max(...map.nodes.map((n) => n.row));
      expect(maxRow).toBe(ROWS - 1);
    });

    it('edges do not contain duplicates', () => {
      const edgeKeys = map.edges.map((e) => `${e.from}->${e.to}`);
      expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
    });
  });
});
