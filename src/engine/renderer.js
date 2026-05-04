/**
 * renderer.js — Barrel module re-exporting 3D and 2D rendering.
 *
 * Split into:
 *   renderer3d.js  — Three.js scene init, camera, meshes, 3D rendering
 *   renderer2d.js  — 2D HUD overlay on canvas
 *
 * For backward compatibility, `drawFrame` calls both 3D and 2D renderers.
 */

// Import locally so `drawFrame` can use them
import { raycastToPlane, projectToScreen, initThreeScene, draw3DFrame } from './renderer3d';
import { draw2DFrame } from './renderer2d';

// Re-export for consumers
export { raycastToPlane, projectToScreen, initThreeScene, draw3DFrame };
export { draw2DFrame };

/**
 * Combined draw call (backward compat — used by App.jsx game loop).
 * Renders the 3D scene then overlays the 2D HUD.
 *
 * @param {object} threeObj — Three.js scene object from initThreeScene
 * @param {object} g       — Game state
 * @param {HTMLCanvasElement} canvasEl — 2D HUD canvas
 * @param {object} statusRef — Ref holding current gameState string
 */
export const drawFrame = (threeObj, g, canvasEl, statusRef) => {
  draw3DFrame(threeObj, g);
  draw2DFrame(threeObj.camera, g, canvasEl, statusRef, projectToScreen);
};
