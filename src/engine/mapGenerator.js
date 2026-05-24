import { GAME_CONFIG } from '../constants/gameConfig';

export const generateMap = () => {
    const rows = 15;
    const cols = 5;
    let nodeIdCounter = 0;
    
    let grid = Array.from({length: rows}, () => Array(cols).fill(null));
    let edgesObj = {};

    const numPaths = 4; 
    let paths = []; 
    // Starting coordinates spread across the bottom
    let startCols = [0, 1, 3, 4];
    for (let p = 0; p < numPaths; p++) {
        paths.push([{row: 0, col: startCols[p]}]);
    }

    // Build independent paths upwards
    for (let r = 0; r < rows - 2; r++) { 
        for (let p = 0; p < numPaths; p++) {
            let cx = paths[p][r].col;
            let possibleNexts = [cx - 1, cx, cx + 1].filter(x => x >= 0 && x < cols);
            let nx = possibleNexts[Math.floor(Math.random() * possibleNexts.length)];
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
            let info = path[i];
            if (!grid[info.row][info.col]) {
                grid[info.row][info.col] = {
                   id: `node-${nodeIdCounter++}`,
                   row: info.row,
                   col: info.col,
                   type: 'combat', // placeholder
                   status: info.row === 0 ? 'available' : 'locked'
                };
            }
            if (i > 0) {
                let fromNode = grid[path[i-1].row][path[i-1].col].id;
                let toNode = grid[info.row][info.col].id;
                edgesObj[`${fromNode}_${toNode}`] = { from: fromNode, to: toNode };
            }
        }
    });

    // Weave additional cross-links so paths aren't purely isolated
    for (let r = 0; r < rows - 2; r++) {
       for (let c = 0; c < cols; c++) {
          let node = grid[r][c];
          if (node && Math.random() < 0.25) { 
             let potentialTargets = [];
             if (c > 0 && grid[r+1][c-1]) potentialTargets.push(grid[r+1][c-1]);
             if (grid[r+1][c]) potentialTargets.push(grid[r+1][c]);
             if (c < cols-1 && grid[r+1][c+1]) potentialTargets.push(grid[r+1][c+1]);
             if (potentialTargets.length > 0) {
                let t = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                edgesObj[`${node.id}_${t.id}`] = { from: node.id, to: t.id };
             }
          }
       }
    }

    // Assign node types row by row to guarantee safe vertical distribution
    let eliteAssigned = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let node = grid[r][c];
            if (!node) continue;
            
            if (r === rows - 1) node.type = 'boss';
            else if (r === rows - 2) node.type = 'repair';
            else if (r === Math.floor(rows / 2)) node.type = 'shop';
            else if (r > 0) {
                 let hasShopParent = false;
                 
                 // Look purely at the generated topology to see if ANY incoming path is from a shop
                 for (let edge of Object.values(edgesObj)) {
                     if (edge.to === node.id) {
                         let parentRow = r - 1;
                         for (let pc = 0; pc < cols; pc++) {
                             if (grid[parentRow][pc] && grid[parentRow][pc].id === edge.from) {
                                 if (grid[parentRow][pc].type === 'shop') hasShopParent = true;
                             }
                         }
                     }
                 }

                 let isBeforeMidpoint = (r === Math.floor(rows / 2) - 1);

                let rnum = Math.random();
                 if (rnum > 0.92) { node.type = 'elite'; eliteAssigned = true; }
                 else if (rnum > 0.82) node.type = 'defend';
                 else if (rnum > 0.72) node.type = 'sabotage';
                 else if (rnum > 0.62) node.type = 'escort';
                 else if (rnum > 0.54) node.type = 'event';
                 else if (rnum > 0.49) node.type = 'gauntlet';
                 else if (rnum > 0.46) node.type = 'wave_surge';
                 else if (rnum > 0.21 && !hasShopParent && !isBeforeMidpoint) node.type = 'shop';
                 else if (rnum > 0.11) node.type = 'repair';
                 else node.type = 'combat';
            }
        }
    }
    
    // Guarantee at least one elite node if none was assigned randomly
    if (!eliteAssigned) {
        let placed = false;
        for (let r = 2; r < rows - 2; r++) {
            for (let c = 0; c < cols && !placed; c++) {
                let node = grid[r][c];
                if (node && node.type === 'combat') {
                    node.type = 'elite';
                    placed = true;
                }
            }
            if (placed) break;
        }
    }

    // Guarantee at least one event node if none was assigned randomly
    let eventAssigned = false;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let node = grid[r][c];
            if (node && node.type === 'event') { eventAssigned = true; break; }
        }
        if (eventAssigned) break;
    }
    if (!eventAssigned) {
        let placed = false;
        for (let r = 2; r < rows - 2; r++) {
            for (let c = 0; c < cols && !placed; c++) {
                let node = grid[r][c];
                if (node && node.type === 'combat') {
                    node.type = 'event';
                    placed = true;
                }
            }
            if (placed) break;
        }
    }

    // Place mini-boss nodes at rows that are multiples of spawnInterval (rows 4, 8, 12)
    // Mini-bosses appear every 3 levels, between regular nodes and the final boss
    const spawnInterval = GAME_CONFIG.miniboss.spawnInterval;
    for (let r = spawnInterval; r < rows - 2; r += spawnInterval) {
        // Find a combat node on this row to convert to mini-boss
        let placed = false;
        for (let c = 0; c < cols && !placed; c++) {
            let node = grid[r][c];
            if (node && node.type === 'combat') {
                node.type = 'miniboss';
                placed = true;
            }
        }
        // If no combat node available, convert a defend/escort/sabotage node (not elite)
        if (!placed) {
            for (let c = 0; c < cols && !placed; c++) {
                let node = grid[r][c];
                if (node && ['defend', 'escort', 'sabotage'].includes(node.type)) {
                    node.type = 'miniboss';
                    placed = true;
                }
            }
        }
    }

    // Assign environmental hazards to combat nodes
    // Uses GAME_CONFIG.environmentalHazards for all probability values
    const hazCfg = GAME_CONFIG.environmentalHazards;
    const hazardTypes = ['asteroidField', 'gravityWell', 'plasmaStorm', 'empZone'];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let node = grid[r][c];
            if (!node) continue;
            // Only assign hazards to combat, elite, escort, defend, sabotage nodes
            const combatTypes = ['combat', 'elite', 'escort', 'defend', 'sabotage'];
            if (!combatTypes.includes(node.type)) continue;
            // Hazard chance scales with row (deeper = more hazards), clamped to max
            const hazardChance = Math.min(
                hazCfg.maxChance,
                hazCfg.baseChance + r * hazCfg.chancePerLevel
            );
            if (Math.random() < hazardChance) {
                // Level 9+ can get up to maxHazardsPerMission
                const maxHazards = Math.min(
                    hazCfg.maxHazardsPerMission,
                    r >= 9 ? 2 : 1
                );
                const chosen = [];
                const shuffled = [...hazardTypes].sort(() => Math.random() - 0.5);
                for (let h = 0; h < maxHazards; h++) {
                    chosen.push(shuffled[h]);
                }
                node.hazardTypes = chosen;
            }
        }
    }

    // Assign weather types to sector (0-2 random weather effects)
    const weatherTypes = Object.keys(GAME_CONFIG.weather.types);
    const shuffledWeather = [...weatherTypes].sort(() => Math.random() - 0.5);
    const sectorWeatherCount = Math.floor(Math.random() * 3); // 0, 1, or 2
    const sectorWeatherTypes = shuffledWeather.slice(0, sectorWeatherCount);

    let nodes = [];
    for (let r = 0; r < rows; r++) {
         for (let c = 0; c < cols; c++) {
              if (grid[r][c]) nodes.push(grid[r][c]);
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
