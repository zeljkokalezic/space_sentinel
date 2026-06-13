/**
 * hooks/useGameLoop.tsx — Three.js init, animation frame loop, and resize handling.
 *
 * Returns { threeRef, statusRef, devModeRef, physicsCbs }
 * where physicsCbs is the callback object to pass to updatePhysics.
 *
 * threeRef.current  — Three.js scene object from initThreeScene
 * statusRef.current — synced copy of gameState
 * devModeRef.current — synced copy of devMode
 */
import { useRef, useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { initThreeScene, drawFrame } from '../engine/renderer';
import type { ThreeScene } from '../engine/renderer';
import { updatePhysics } from '../engine/physics';
import type { PhysicsCallbacks } from '../engine/physics';
import type { GameRef, GameStateName } from '../components/types';

interface UseGameLoopArgs {
  containerRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  game: GameRef;
  gameState: GameStateName;
  setGameState: (state: GameStateName) => void;
  setMapStateVersion: (updater: (v: number) => number) => void;
  setNotificationVersion: (version: number) => void;
  devMode: boolean;
}

export const useGameLoop = ({
  containerRef,
  canvasRef,
  game,
  gameState,
  setGameState,
  setMapStateVersion,
  setNotificationVersion,
  devMode,
}: UseGameLoopArgs) => {
  const threeRef = useRef<ThreeScene | null>(null);
  const reqRef = useRef<number | null>(null);
  const statusRef = useRef<GameStateName>(gameState);
  const devModeRef = useRef<boolean>(devMode);

  const physicsCbsRef = useRef<PhysicsCallbacks | null>(null);

  // Keep refs in sync with React state
  useEffect(() => { statusRef.current = gameState; }, [gameState]);
  useEffect(() => { devModeRef.current = devMode; }, [devMode]);

  // Dev-aware state setter — redirects 'map' -> 'dev' when devMode is on
  const devAwareSetState = (state: string) => {
    if (state === 'map' && devModeRef.current) {
      setGameState('dev');
    } else {
      setGameState(state as GameStateName);
    }
  };

  // Update physicsCbs ref on every render so the loop closure always sees latest
  physicsCbsRef.current = { setGameState: devAwareSetState, setMapStateVersion, setNotificationVersion };
  const physicsCbs = physicsCbsRef.current;

  useEffect(() => {
    const containerEl = containerRef.current;
    // Init Three.js scene
    if (!threeRef.current) {
      threeRef.current = initThreeScene(containerEl);
    }

    const loop = (time: number) => {
      if (!game.current) return;
      let dt = (time - game.current.lastTime) / 1000;
      game.current.lastTime = time;
      if (dt > 0.1) dt = 0.1;

      if (statusRef.current === 'playing' && !game.current?.paused && physicsCbsRef.current) {
        updatePhysics(dt, game.current, physicsCbsRef.current);
      }

      if (threeRef.current && canvasRef.current) {
        drawFrame(threeRef.current, game.current, canvasRef.current, statusRef);
      }

      reqRef.current = requestAnimationFrame(loop);
    };

    const handleResize = () => {
      if (!threeRef.current) return;
      threeRef.current.camera.aspect = window.innerWidth / window.innerHeight;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    reqRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqRef.current !== null) cancelAnimationFrame(reqRef.current);
      window.removeEventListener('resize', handleResize);
      if (threeRef.current && containerEl) {
        containerEl.removeChild(threeRef.current.renderer.domElement);
        threeRef.current.renderer.dispose();
        threeRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { threeRef, statusRef, devModeRef, physicsCbs };
};
