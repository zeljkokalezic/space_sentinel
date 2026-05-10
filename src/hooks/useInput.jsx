/**
 * hooks/useInput.jsx — Keyboard and pointer event handlers.
 *
 * Receives refs created by App (or useGameLoop) so both hooks
 * operate on the same mutable state.
 *
 * Returns { onPointerDown, onPointerMove, onPointerUp }
 * to attach to the canvas container element.
 */
import { useEffect } from 'react';
import { raycastToPlane } from '../engine/renderer';

export const useInput = ({
  game,
  threeRef,       // useRef from useGameLoop — .current is the Three.js scene
  gameState,
  statusRef,      // useRef synced to gameState
  setGameState,
  setDevMode,
  startGame,
}) => {
  // ─── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();

      if (key === ' ' && !e.repeat) {
        setGameState(prev => {
          if (prev === 'shop') return 'map';
          if (prev === 'start' || prev === 'gameover') { setTimeout(startGame, 0); return prev; }
          return prev;
        });
      }

      if (key === '`' && !e.repeat) {
        const currentGameState = statusRef.current;
        if (currentGameState === 'start' || currentGameState === 'gameover' || currentGameState === 'victory') {
          setDevMode(dm => !dm);
        } else if (currentGameState === 'playing' && game.current?.devMode) {
          setDevMode(true);
          setGameState('dev');
        }
        if (game.current) game.current.keys[key] = true;
        return;
      }

      if (game.current) game.current.keys[key] = true;
    };

    const handleKeyUp = (e) => {
      if (game.current) game.current.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pointer (mouse + touch) ───────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (gameState !== 'playing' || !game.current) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (game.current.touchId === null) {
        game.current.touchId = e.pointerId;
        game.current.touchBase = { x: e.clientX, y: e.clientY };
        game.current.touchCurrent = { x: e.clientX, y: e.clientY };
      }
    } else {
      game.current.mouse.x = e.clientX;
      game.current.mouse.y = e.clientY;
      game.current.mouse.active = true;
      if (threeRef.current) {
        const wm = raycastToPlane(e.clientX, e.clientY, threeRef.current.camera);
        if (wm) game.current.worldMouse = wm;
      }
    }
  };

  const onPointerMove = (e) => {
    if (gameState !== 'playing' || !game.current) return;
    if ((e.pointerType === 'touch' || e.pointerType === 'pen') && e.pointerId === game.current.touchId) {
      game.current.touchCurrent = { x: e.clientX, y: e.clientY };
    } else if (e.pointerType === 'mouse') {
      game.current.mouse.x = e.clientX;
      game.current.mouse.y = e.clientY;
      if (e.buttons > 0) game.current.mouse.active = true;
      if (threeRef.current) {
        const wm = raycastToPlane(e.clientX, e.clientY, threeRef.current.camera);
        if (wm) game.current.worldMouse = wm;
      }
    }
  };

  const onPointerUp = (e) => {
    if (!game.current) return;
    if (e.pointerId === game.current.touchId) {
      game.current.touchId = null;
      game.current.touchBase = null;
      game.current.touchCurrent = null;
    }
    if (e.pointerType === 'mouse') game.current.mouse.active = false;
  };

  return { onPointerDown, onPointerMove, onPointerUp };
};
