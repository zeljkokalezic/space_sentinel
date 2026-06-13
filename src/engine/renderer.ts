/**
 * renderer.ts — Barrel module re-exporting 3D and 2D rendering.
 */
import { raycastToPlane, projectToScreen, initThreeScene, draw3DFrame } from './renderer3d';
import type { ThreeScene } from './renderer3d';
import { draw2DFrame } from './renderer2d';
import type { GameState } from './state';

export { raycastToPlane, projectToScreen, initThreeScene, draw3DFrame };
export { draw2DFrame };
export type { ThreeScene };

export const drawFrame = (
  threeObj: ThreeScene,
  g: GameState,
  canvasEl: HTMLCanvasElement,
  statusRef: { current: string },
): void => {
  draw3DFrame(threeObj, g);
  draw2DFrame(threeObj.camera as unknown as Record<string, unknown>, g, canvasEl, statusRef, projectToScreen);
};
