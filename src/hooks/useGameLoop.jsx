/**
 * hooks/useGameLoop.jsx — Three.js init, animation frame loop, and resize handling.
 *
 * Returns { threeRef, statusRef, devModeRef, physicsCbs }
 * where physicsCbs is the callback object to pass to updatePhysics.
 *
 * threeRef.current  — Three.js scene object from initThreeScene
 * statusRef.current — synced copy of gameState
 * devModeRef.current — synced copy of devMode
 */
import { useRef, useEffect } from 'react';
import { initThreeScene, drawFrame } from '../engine/renderer';
import { updatePhysics } from '../engine/physics';

export const useGameLoop = ({
  containerRef,
  canvasRef,
  game,
  gameState,
  setGameState,
  setMapStateVersion,
  devMode,
}) => {
  const threeRef = useRef(null);
  const reqRef = useRef(null);
  const statusRef = useRef(gameState);
  const devModeRef = useRef(devMode);

  // Keep refs in sync with React state
  useEffect(() => { statusRef.current = gameState; }, [gameState]);
  useEffect(() => { devModeRef.current = devMode; }, [devMode]);

  // Dev-aware state setter — redirects 'map' -> 'dev' when devMode is on
  const devAwareSetState = (state) => {
    if (state === 'map' && devModeRef.current) {
      setGameState('dev');
    } else {
      setGameState(state);
    }
  };
  const physicsCbs = { setGameState: devAwareSetState, setMapStateVersion };

  useEffect(() => {
    // Init Three.js scene
    if (!threeRef.current) {
      threeRef.current = initThreeScene(containerRef.current);
    }

    const loop = (time) => {
      if (!game.current) return;
      let dt = (time - game.current.lastTime) / 1000;
      game.current.lastTime = time;
      if (dt > 0.1) dt = 0.1;

      if (statusRef.current === 'playing') {
        updatePhysics(dt, game.current, physicsCbs);
      }

      if (threeRef.current) {
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
      cancelAnimationFrame(reqRef.current);
      window.removeEventListener('resize', handleResize);
      if (threeRef.current && containerRef.current) {
        containerRef.current.removeChild(threeRef.current.renderer.domElement);
        threeRef.current.renderer.dispose();
        threeRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { threeRef, statusRef, devModeRef, physicsCbs };
};
