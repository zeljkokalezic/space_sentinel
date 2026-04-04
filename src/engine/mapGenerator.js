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
                let r = info.row;
                let type = 'combat'; 
                if (r === rows - 1) type = 'boss';
                else if (r === rows - 2) type = 'repair';
                else if (r > 0) {
                     let rnum = Math.random();
                     if (rnum > 0.85) type = 'elite';
                     else if (rnum > 0.65) type = 'event';
                     else if (rnum > 0.50) type = 'shop';
                     else if (rnum > 0.40) type = 'repair';
                }
                grid[info.row][info.col] = {
                   id: `node-${nodeIdCounter++}`,
                   row: info.row,
                   col: info.col,
                   type: type,
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
      currentNodeId: null
    };
};
