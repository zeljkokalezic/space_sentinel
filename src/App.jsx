import React, { useState, useEffect, useRef } from 'react';

import { generateMap }       from './engine/mapGenerator';
import { setupEscort, resetEscort } from './engine/escortSetup';

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
    game.current = {
      player: {
        x: 0, y: 0, vx: 0, vy: 0, radius: 38,
        hp: 300, maxHp: 300,
        shield: 20, maxShield: 20,
        speed: 120, magnetRadius: 150,
        yaw: Math.PI / 2,
      },
      scrap: 200, totalScrapEarned: 0,
      wave: 1, totalTime: 0, level: 1, mission: null,
      map: generateMap(),
      spawnCooldown: 2,
      enemies: [], projectiles: [], particles: [], pickups: [], effects: [],
      stars: Array.from({ length: 800 }, () => ({
        x: (Math.random() - 0.5) * 8000,
        y: (Math.random() - 0.5) * 8000,
        z: -Math.random() * 500,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 80 + 20,
      })),
      levels: { autocannon: 1, plasma: 0, missiles: 0, hull: 1, shield: 1, thrusters: 1, magnet: 1, pointDefense: 0, autoAim: 0 },
      cooldowns: { autocannon: 0, plasma: 0, missiles: 0, pointDefense: 0, shieldRegen: 0 },
      escort: {
        active: false,
        x: 0, y: 0,
        targetX: 0, targetY: 0,
        hp: 0, maxHp: 0,
        speed: 80,
        radius: 20,
        lives: 1,
        evasionAngle: 0,
        evasionTimer: 0,
        respawnTimer: 0,
      },
      keys: {}, mouse: { x: 0, y: 0, active: false }, worldMouse: { x: 0, y: 0 },
      touchId: null, touchBase: null, touchCurrent: null,
      lastTime: performance.now(),
    };
  };

  const startGame = () => { resetGame(); setGameState(devMode ? 'dev' : 'map'); };

  // ─── Dev mode: launch a specific mission ────────────────────────────────────
  const launchDevMission = ({ type, level }) => {
    resetGame();
    game.current.level = level;

    let mission;
    if (type === 'kill') {
      const target = 10 + level * 5;
      mission = { type: 'kill', target, current: 0, title: `Destroy ${target} Enemies`, reward: 50 + level * 20 };
    } else if (type === 'collect') {
      const target = 15 + level * 3;
      mission = { type: 'collect', target, current: 0, title: `Collect ${target} Scrap`, reward: 80 + level * 25 };
    } else if (type === 'survive') {
      const target = 20 + level * 10;
      mission = { type: 'survive', target, current: 0, title: `Survive for ${target} Seconds`, reward: 80 + level * 15 };
    } else if (type === 'escort') {
      mission = { type: 'escort', target: 0, current: 0, title: 'Escort the Drone to Safety', reward: 120 + level * 35 };
    } else if (type === 'kill_elite') {
      const target = 3 + Math.floor(level / 3);
      mission = { type: 'kill_elite', target, current: 0, title: `Destroy ${target} Elite Enemies`, reward: 100 + level * 30 };
    } else if (type === 'kill_boss') {
      mission = { type: 'kill_boss', target: 1, current: 0, title: 'Destroy the Sentinel Core', reward: 500 };
    }

    game.current.mission = mission;
    game.current.devMode = true;
    game.current.spawnCooldown = 2.0;
    game.current.totalTime = 0;
    game.current.player.x = 0; game.current.player.y = 0;
    game.current.player.yaw = Math.PI / 2;
    game.current.player.vx = 0; game.current.player.vy = 0;
    game.current.worldMouse = { x: 0, y: 200 };
    game.current.enemies = []; game.current.projectiles = [];
    game.current.particles = []; game.current.pickups = []; game.current.effects = [];

    if (type === 'escort') {
      setupEscort(game.current, level);
    } else {
      resetEscort(game.current);
    }

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
