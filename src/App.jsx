import React, { useState, useEffect, useRef } from 'react';

import { createGameState }      from './engine/state';
import { generateMission }         from './engine/spawner';
import { setupCombatMission }      from './engine/missionSetup';
import { setupHazards }            from './engine/hazardSetup';
import { SHIP_SKINS }              from './constants/skins';

import { useGameLoop } from './hooks/useGameLoop';
import { useInput }    from './hooks/useInput';

import MapOverlay             from './components/MapOverlay';
import ShopOverlay            from './components/ShopOverlay';
import StartScreen            from './components/StartScreen';
import GameOverScreen         from './components/GameOverScreen';
import VictoryScreen          from './components/VictoryScreen';
import EventScreen            from './components/EventScreen';
import DevMissionPicker       from './components/DevMissionPicker';
import PauseOverlay           from './components/PauseOverlay';
import PostMissionSummary     from './components/PostMissionSummary';
import AchievementNotification from './components/AchievementNotification';

export default function App() {
  // ─── React state ────────────────────────────────────────────────────────────
  const [gameState,       setGameState]       = useState('start');
  const [uiScrap,         setUiScrap]         = useState(0);
  const [uiLevels,        setUiLevels]        = useState(null);
  const [uiShipSkin,      setUiShipSkin]      = useState(0);
  const [uiUnlockedSkins, setUiUnlockedSkins] = useState(() => SHIP_SKINS.map(s => s.cost === 0));
  const [mapStateVersion, setMapStateVersion] = useState(0);
  const [notificationVersion, setNotificationVersion] = useState(0);
  const [devMode,         setDevMode]         = useState(false);
  const [paused,          setPaused]          = useState(false);

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
  const launchDevMission = ({ type, level, hazard }) => {
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
      kill_miniboss: 'miniboss',
    };
    const nodeType = nodeTypeMap[type] || 'kill';
    const mission = generateMission(level, nodeType);

    game.current.devMode = true;
    setupCombatMission(game.current, mission, level);

    // Set up hazard if selected
    if (hazard && hazard !== 'none') {
      setupHazards(game.current, level, [hazard]);
    }

    setUiLevels({ ...game.current.levels });
    setGameState('playing');
  };

  // ─── Upgrade purchase ──────────────────────────────────────────────────────
  const buyUpgrade = (key, cost) => {
    const g = game.current;
    if (g.scrap < cost) return;
    g.scrap -= cost;
    const nextLevel = g.levels[key] + 1;
    g.levels[key] = nextLevel;
    if (key === 'hull')   { g.player.maxHp += 50; g.player.hp += 50; }
    if (key === 'shield') { g.player.maxShield = nextLevel * 20; g.player.shield = g.player.maxShield; }
    setUiScrap(g.scrap);
    setUiLevels({ ...g.levels });
  };

  // ─── Ship skin purchase / equip ─────────────────────────────────────────────
  const buySkin = (index) => {
    const g = game.current;
    if (!g || index < 0 || index >= SHIP_SKINS.length) return;
    if (g.unlockedSkins[index]) {
      // Already owned — just equip
      g.shipSkin = index;
      setUiShipSkin(index);
      return;
    }
    const skinCost = SHIP_SKINS[index]?.cost ?? 0;
    if (g.scrap < skinCost) return;
    g.scrap -= skinCost;
    const newUnlocked = [...g.unlockedSkins];
    newUnlocked[index] = true;
    g.unlockedSkins = newUnlocked;
    g.shipSkin = index;
    setUiScrap(g.scrap);
    setUiShipSkin(index);
    setUiUnlockedSkins([...g.unlockedSkins]);
  };

  // ─── Init game state on mount ──────────────────────────────────────────────
  useEffect(() => { resetGame(); }, []);

  // ─── Hooks ──────────────────────────────────────────────────────────────────
  const { threeRef, statusRef } = useGameLoop({
    containerRef, canvasRef, game, gameState, setGameState, setMapStateVersion, setNotificationVersion, devMode,
  });

  const { onPointerDown, onPointerMove, onPointerUp } = useInput({
    game, threeRef, gameState, statusRef, devMode, setGameState, setDevMode, startGame, paused, setPaused,
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
          setUiShipSkin={setUiShipSkin}
          setUiUnlockedSkins={setUiUnlockedSkins}
          setMapStateVersion={setMapStateVersion}
          mapStateVersion={mapStateVersion}
        />
      )}

      {gameState === 'shop'     && <ShopOverlay    uiScrap={uiScrap} uiLevels={uiLevels} buyUpgrade={buyUpgrade} setGameState={setGameState} uiShipSkin={uiShipSkin} uiUnlockedSkins={uiUnlockedSkins} buySkin={buySkin} />}
      {gameState === 'start'    && <StartScreen    startGame={startGame} devMode={devMode} gameRef={game} />}
      {gameState === 'gameover' && <GameOverScreen  gameRef={game} startGame={startGame} />}
      {gameState === 'victory'  && <VictoryScreen   gameRef={game} startGame={startGame} />}
      {gameState === 'event'    && <EventScreen     gameRef={game} setGameState={setGameState} setUiScrap={setUiScrap} setUiLevels={setUiLevels} />}
      {gameState === 'dev'      && <DevMissionPicker onLaunch={launchDevMission} onExit={() => { setDevMode(false); setGameState('start'); }} />}
      {gameState === 'playing' && paused && <PauseOverlay gameRef={game} startGame={startGame} setPaused={setPaused} />}
      {gameState === 'playing' && game?.current?.transitionTimer !== undefined && <PostMissionSummary game={game} visible={true} />}
      {gameState === 'playing' && <AchievementNotification game={game} visible={true} notificationVersion={notificationVersion} onBumpNotification={setNotificationVersion} />}
    </div>
  );
}
