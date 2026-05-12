import React, { useState, useEffect, useRef } from 'react';

import { createGameState }      from './engine/state';
import { generateMission }         from './engine/spawner';
import { setupCombatMission }      from './engine/missionSetup';

import { useGameLoop } from './hooks/useGameLoop';
import { useInput }    from './hooks/useInput';

import MapOverlay    from './components/MapOverlay';
import ShopOverlay   from './components/ShopOverlay';
import StartScreen   from './components/StartScreen';
import GameOverScreen from './components/GameOverScreen';
import VictoryScreen from './components/VictoryScreen';
import EventScreen   from './components/EventScreen';
import DevMissionPicker from './components/DevMissionPicker';

export default function App() {
  // ─── React state ────────────────────────────────────────────────────────────
  const [gameState,       setGameState]       = useState('start');
  const [uiScrap,         setUiScrap]         = useState(0);
  const [uiLevels,        setUiLevels]        = useState(null);
  const [mapStateVersion, setMapStateVersion] = useState(0);
  const [devMode,         setDevMode]         = useState(false);

  // ─── Mutable refs (shared across hooks) ─────────────────────────────────────
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const game         = useRef(null);

  // ─── Game state initialisation ─────────────────────────────────────────────
  const resetGame = () => {
    game.current = createGameState();
  };

  const startGame = () => { resetGame(); setGameState(devMode ? 'dev' : 'map'); };

  // ─── Dev mode: launch a specific mission ────────────────────────────────────
  const launchDevMission = ({ type, level }) => {
    resetGame();
    game.current.level = level;

    // Map dev type names to node types for generateMission
    const nodeTypeMap = {
      kill: 'kill',
      collect: 'collect',
      survive: 'survive',
      escort: 'escort',
      defend: 'defend',
      sabotage: 'sabotage',
      kill_elite: 'elite',
      kill_boss: 'boss',
    };
    const nodeType = nodeTypeMap[type] || 'kill';
    const mission = generateMission(level, nodeType);

    game.current.devMode = true;
    setupCombatMission(game.current, mission, level);

    setUiLevels({ ...game.current.levels });
    setGameState('playing');
  };

  // ─── Upgrade purchase ──────────────────────────────────────────────────────
  const buyUpgrade = (key, cost) => {
    if (uiScrap < cost) return;
    setUiScrap(prev => prev - cost);
    game.current.scrap -= cost;
    setUiLevels(prev => {
      const nextLevel = prev[key] + 1;
      game.current.levels[key] = nextLevel;
      if (key === 'hull')   { game.current.player.maxHp += 50; game.current.player.hp += 50; }
      if (key === 'shield') { game.current.player.maxShield = nextLevel * 20; game.current.player.shield = game.current.player.maxShield; }
      return { ...prev, [key]: nextLevel };
    });
  };

  // ─── Init game state on mount ──────────────────────────────────────────────
  useEffect(() => { resetGame(); }, []);

  // ─── Hooks ──────────────────────────────────────────────────────────────────
  const { threeRef, statusRef } = useGameLoop({
    containerRef, canvasRef, game, gameState, setGameState, setMapStateVersion, devMode,
  });

  const { onPointerDown, onPointerMove, onPointerUp } = useInput({
    game, threeRef, gameState, statusRef, devMode, setGameState, setDevMode, startGame,
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-screen bg-[#0a0a14] overflow-hidden relative font-sans select-none">

      {/* Three.js canvas container */}
      <div
        ref={containerRef}
        className={`absolute inset-0 cursor-crosshair touch-none ${gameState === 'playing' ? 'opacity-100 z-10' : 'opacity-20 z-0'} transition-opacity duration-500`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />

      {/* 2D HUD canvas */}
      <canvas ref={canvasRef} className={`absolute inset-0 pointer-events-none z-20 ${gameState === 'playing' ? 'opacity-100' : 'opacity-0'}`} />

      {/* Sector Map */}
      { }
      {gameState === 'map' && (
        <MapOverlay
          game={game.current}
          setGameState={setGameState}
          setUiScrap={setUiScrap}
          setUiLevels={setUiLevels}
          setMapStateVersion={setMapStateVersion}
          mapStateVersion={mapStateVersion}
        />
      )}

      {gameState === 'shop'     && <ShopOverlay    uiScrap={uiScrap} uiLevels={uiLevels} buyUpgrade={buyUpgrade} setGameState={setGameState} />}
      {gameState === 'start'    && <StartScreen    startGame={startGame} devMode={devMode} />}
      {gameState === 'gameover' && <GameOverScreen  gameRef={game} startGame={startGame} />}
      {gameState === 'victory'  && <VictoryScreen   gameRef={game} startGame={startGame} />}
      {gameState === 'event'    && <EventScreen     gameRef={game} setGameState={setGameState} setUiScrap={setUiScrap} setUiLevels={setUiLevels} />}
      {gameState === 'dev'      && <DevMissionPicker onLaunch={launchDevMission} onExit={() => { setDevMode(false); setGameState('start'); }} />}
    </div>
  );
}
