import { GAME_CONFIG } from '../constants/gameConfig';

interface MapNode {
  id: string;
  row: number;
  col: number;
  type: string;
  status: string;
  hazardTypes?: string[];
  weatherTypes?: string[];
}

interface MapEdge {
  from: string;
  to: string;
}

interface GameMap {
  nodes: MapNode[];
  edges: MapEdge[];
  currentRow: number;
  currentNodeId: string | null;
  weatherTypes: string[];
}

export const generateMap = (): GameMap => {
    const rows = 15;
    const cols = 5;
    let nodeIdCounter = 0;

    const grid: (MapNode | null)[][] = Array.from({length: rows}, () => Array(cols).fill(null));
    const edgesObj: Record<string, MapEdge> = {};

    const numPaths = 4;
    const paths: {row: number; col: number}[][] = [];
    const startCols = [0, 1, 3, 4];
    for (let p = 0; p < numPaths; p++) {
        paths.push([{row: 0, col: startCols[p]}]);
    }

    // Build independent paths upwards
    for (let r = 0; r < rows - 2; r++) {
        for (let p = 0; p < numPaths; p++) {
            const cx = paths[p][r].col;
            const possibleNexts = [cx - 1, cx, cx + 1].filter(x => x >= 0 && x < cols);
            const nx = possibleNexts[Math.floor(Math.random() * possibleNexts.length)];
            paths[p].push({row: r + 1, col: nx});
        }
    }

    // Connect all paths to the final boss node
    for (let p = 0; p < numPaths; p++) {
        paths[p].push({row: rows - 1, col: Math.floor(cols / 2)});
    }

    // Translate geometric paths into Node objects and Edge references
    paths.forEach(path => {
        for (let i = 0; i < path.length; i++) {
            const info = path[i];
            if (!grid[info.row][info.col]) {
                grid[info.row][info.col] = {
                   id: `node-${nodeIdCounter++}`,
                   row: info.row,
                   col: info.col,
                   type: 'combat',
                   status: info.row === 0 ? 'available' : 'locked',
                };
            }
            if (i > 0) {
                const fromNode = grid[path[i-1].row][path[i-1].col]!;
                const toNode = grid[info.row][info.col]!;
                edgesObj[`${fromNode.id}_${toNode.id}`] = { from: fromNode.id, to: toNode.id };
            }
        }
    });

    // Weave additional cross-links
    for (let r = 0; r < rows - 2; r++) {
       for (let c = 0; c < cols; c++) {
          const node = grid[r][c];
          if (node && Math.random() < 0.25) {
             const potentialTargets: MapNode[] = [];
             if (c > 0 && grid[r+1][c-1]) potentialTargets.push(grid[r+1][c-1]!);
             if (grid[r+1][c]) potentialTargets.push(grid[r+1][c]!);
             if (c < cols-1 && grid[r+1][c+1]) potentialTargets.push(grid[r+1][c+1]!);
             if (potentialTargets.length > 0) {
                const t = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                edgesObj[`${node.id}_${t.id}`] = { from: node.id, to: t.id };
             }
          }
       }
    }

    // Assign node types row by row
    let eliteAssigned = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const node = grid[r][c];
            if (!node) continue;

            if (r === rows - 1) node.type = 'boss';
            else if (r === rows - 2) node.type = 'repair';
            else if (r === Math.floor(rows / 2)) node.type = 'shop';
            else if (r > 0) {
                 let hasShopParent = false;

                 for (const edge of Object.values(edgesObj)) {
                     if (edge.to === node.id) {
                         const parentRow = r - 1;
                         for (let pc = 0; pc < cols; pc++) {
                             if (grid[parentRow][pc] && grid[parentRow][pc]!.id === edge.from) {
                                 if (grid[parentRow][pc]!.type === 'shop') hasShopParent = true;
                             }
                         }
                     }
                 }

                const rnum = Math.random();
                 if (rnum > 0.92) { node.type = 'elite'; eliteAssigned = true; }
                 else if (rnum > 0.82) node.type = 'defend';
                 else if (rnum > 0.72) node.type = 'sabotage';
                 else if (rnum > 0.62) node.type = 'escort';
                 else if (rnum > 0.54) node.type = 'event';
                 else if (rnum > 0.49) node.type = 'gauntlet';
                 else if (rnum > 0.46) node.type = 'wave_surge';
                 else if (rnum > 0.21 && !hasShopParent) node.type = 'shop';
                 else if (rnum > 0.11) node.type = 'repair';
                 else node.type = 'combat';
            }
        }
    }

    // Guarantee at least one elite node
    if (!eliteAssigned) {
        let placed = false;
        for (let r = 2; r < rows - 2; r++) {
            for (let c = 0; c < cols && !placed; c++) {
                const node = grid[r][c];
                if (node && node.type === 'combat') {
                    node.type = 'elite';
                    placed = true;
                }
            }
            if (placed) break;
        }
    }

    // Guarantee at least one event node
    let eventAssigned = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const node = grid[r][c];
            if (node && node.type === 'event') { eventAssigned = true; break; }
        }
        if (eventAssigned) break;
    }
    if (!eventAssigned) {
        let placed = false;
        for (let r = 2; r < rows - 2; r++) {
            for (let c = 0; c < cols && !placed; c++) {
                const node = grid[r][c];
                if (node && node.type === 'combat') {
                    node.type = 'event';
                    placed = true;
                }
            }
            if (placed) break;
        }
    }

    // Place mini-boss nodes
    const spawnInterval = GAME_CONFIG.miniboss.spawnInterval;
    for (let r = spawnInterval; r < rows - 2; r += spawnInterval) {
        let placed = false;
        for (let c = 0; c < cols && !placed; c++) {
            const node = grid[r][c];
            if (node && node.type === 'combat') {
                node.type = 'miniboss';
                placed = true;
            }
        }
        if (!placed) {
            for (let c = 0; c < cols && !placed; c++) {
                const node = grid[r][c];
                if (node && ['defend', 'escort', 'sabotage'].includes(node.type)) {
                    node.type = 'miniboss';
                    placed = true;
                }
            }
        }
    }

    // Assign environmental hazards to combat nodes
    const hazCfg = GAME_CONFIG.environmentalHazards;
    const hazardTypes = ['asteroidField', 'gravityWell', 'plasmaStorm', 'empZone'];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const node = grid[r][c];
            if (!node) continue;
            const combatTypes = ['combat', 'elite', 'escort', 'defend', 'sabotage'];
            if (!combatTypes.includes(node.type)) continue;
            const hazardChance = Math.min(
                hazCfg.maxChance,
                hazCfg.baseChance + r * hazCfg.chancePerLevel
            );
            if (Math.random() < hazardChance) {
                const maxHazards = Math.min(
                    hazCfg.maxHazardsPerMission,
                    r >= 9 ? 2 : 1
                );
                const chosen: string[] = [];
                const shuffled = [...hazardTypes].sort(() => Math.random() - 0.5);
                for (let h = 0; h < maxHazards; h++) {
                    chosen.push(shuffled[h]);
                }
                node.hazardTypes = chosen;
            }
        }
    }

    // Assign weather types to sector
    const weatherKeys = Object.keys(GAME_CONFIG.weather.types);
    const shuffledWeather = [...weatherKeys].sort(() => Math.random() - 0.5);
    const sectorWeatherCount = Math.floor(Math.random() * 3);
    const sectorWeatherTypes = shuffledWeather.slice(0, sectorWeatherCount);

    const nodes: MapNode[] = [];
    for (let r = 0; r < rows; r++) {
         for (let c = 0; c < cols; c++) {
              if (grid[r][c]) nodes.push(grid[r][c]!);
         }
    }

    return {
      nodes,
      edges: Object.values(edgesObj),
      currentRow: -1,
      currentNodeId: null,
      weatherTypes: sectorWeatherTypes,
    };
};
