# Space Sentinel - Project Architecture & AI Instructions

> **CRITICAL INSTRUCTION FOR ALL AI SESSIONS:**  
> This file (`gemini.md`) serves as the core architectural map for this project. If you (the AI) make **any** structural changes to the codebase (such as creating new files, extracting major components, or adding new root dependencies), you MUST immediately update this document to reflect those changes. 

## Codebase Overview
"Space Sentinel" is a Vite + React application wrapping a vanilla Three.js engine. The source code has been broken out into isolated directories to prevent main-loop engine cross-contamination.

### `/src`
The core directory containing the React-Three.js bridge.
- `App.jsx`: The central loop. It manages absolute game state `[start, playing, shop, gameover, victory]`, contains the Three.js physics & rendering implementation (`updatePhysics`), and structurally integrates the overlay components.
- `main.jsx`: Standard Vite React DOM initialization.

### `/src/components`
Contains purely functional, isolated React GUI Overlays that render safely on top of the 3D canvas depending on the state of the game loop.
- `StartScreen.jsx`: The initial sequence trigger.
- `ShopOverlay.jsx`: Renders system upgrades, consuming `uiScrap` and `uiLevels` props.
- `VictoryScreen.jsx`: Handles end-of-sector boss clears.
- `GameOverScreen.jsx`: Handles hull-breach resets.

### `/src/constants`
Static data designed to be completely safely modifiable without touching core game loops.
- `upgrades.js`: Contains `UPGRADE_DATA`, balancing numbers, names, descriptions, and scaling modifiers for ship systems.

### `/src/engine`
Standalone mathematical and generation algorithms detached entirely from React state.
- `mapGenerator.js`: Defines `generateMap()`, a multi-path algorithm creating 4 continuous, intersecting pathways culminating in a Boss Node (Slay the Spire style maps).
