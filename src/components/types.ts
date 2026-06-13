/**
 * types.ts — Shared prop types for the React overlay components.
 *
 * The engine's mutable game state lives in a React ref (`game` in App.jsx).
 * Components read from `gameRef.current` and call back into App-owned setters.
 */
import type { MutableRefObject } from 'react';
import type { GameState } from '../engine/state';

/** A ref holding the live, mutable game state (or null before init). */
export type GameRef = MutableRefObject<GameState | null>;

/** The React gameState string union owned by App.jsx. */
export type GameStateName =
  | 'start'
  | 'map'
  | 'playing'
  | 'shop'
  | 'event'
  | 'gameover'
  | 'victory'
  | 'dev'
  | 'relicChoice';
