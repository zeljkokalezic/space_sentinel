import React, { useState, useEffect, useRef, useCallback } from 'react';

import { createGameState }      from './engine/state';
import { generateMap }          from './engine/mapGenerator';
import { generateMission }         from './engine/spawner';
import { setupCombatMission }      from './engine/missionSetup';
import { setupHazards }            from './engine/hazardSetup';
import { loadGame }                from './engine/saveManager';
import { SoundManager }            from './engine/audio';
import { clearMissionState }       from './engine/stateCleanup';
import { resetEntityPools }         from './engine/pool';
import { SHIP_SKINS }              from './constants/skins';
import { UPGRADE_DATA }            from './constants/upgrades';
import {
  resetSector,
} from './engine/sectorRank';
import { tryAddRelic, getRelicById } from './engine/relicSystem';

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
import RelicChoice from './components/RelicChoice';

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
  const [uiEmergencyBeacon, setUiEmergencyBeacon] = useState({ purchased: false, activated: false, nodeId: null });

  // ─── Mutable refs (shared across hooks) ─────────────────────────────────────
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const game         = useRef(null);

  // ─── Game state initialisation ─────────────────────────────────────────────
  const resetGame = () => {
    game.current = createGameState();
    SoundManager.setVolume(game.current.settings?.volume ?? 0.5);
    SoundManager.setSfxVolume(game.current.settings?.sfxVolume ?? 0.7);
    SoundManager.setMusicVolume(game.current.settings?.musicVolume ?? 0.5);
    SoundManager.setMuted(game.current.audio?.muted ?? false);
  };

  const startGame = useCallback(() => { resetGame(); setGameState(devMode ? 'dev' : 'relicChoice'); }, [devMode]);

  const selectStartingRelic = (relicId) => {
    tryAddRelic(game.current, relicId);
    setGameState('map');
  };

  const skipRelicChoice = () => {
    setGameState('map');
  };

  const nextSector = () => {
    const g = game.current;
    if (!g) return;
    resetSector(g);
    g.map = generateMap();
    clearMissionState(g);
    g.spawnCooldown = 2;
    g.wave = 1;
    g.totalTime = 0;
    g.player.x = 0; g.player.y = 0;
    g.player.vx = 0; g.player.vy = 0;
    g.player.yaw = Math.PI / 2;
    g.paused = false;
    setPaused(false);
    syncUiFromGame();
    setUiEmergencyBeacon({ ...g.emergencyBeacon });
    setGameState(devMode ? 'dev' : 'map');
  };

  const syncUiFromGame = () => {
    const g = game.current;
    if (!g) return;
    setUiScrap(g.scrap);
    setUiLevels({ ...g.levels });
    setUiShipSkin(g.shipSkin ?? 0);
    setUiUnlockedSkins([...(g.unlockedSkins ?? SHIP_SKINS.map(s => s.cost === 0))]);
    setMapStateVersion(v => v + 1);
  };

  const continueGame = () => {
    resetGame();
    if (!loadGame(game.current, 'auto')) return;
    game.current.devMode = false;
    game.current.paused = false;
    setPaused(false);
    setDevMode(false);
    syncUiFromGame();
    setGameState('map');
  };

  // ─── Dev mode: launch a specific mission ────────────────────────────────────
  const launchDevMission = ({ type, level, hazard, variantIndex }) => {
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
    if (variantIndex != null) {
      game.current.devVariantIndex = variantIndex;
    }
    setupCombatMission(game.current, mission, level);

    // Set up hazard if selected
    if (hazard && hazard !== 'none') {
      setupHazards(game.current, level, [hazard]);
    }

    syncUiFromGame();
    setGameState('playing');
  };

  // ─── Upgrade purchase ──────────────────────────────────────────────────────
  const buyUpgrade = (key, cost) => {
    const g = game.current;
    if (!g) return;
    const upgrade = UPGRADE_DATA[key];
    if (!upgrade || g.levels[key] >= upgrade.maxLevel) return;

    // Handle free_weapon buff: first weapon purchase is free
    const weaponKeys = ['autocannon', 'plasma', 'missiles', 'pointDefense', 'autoAim'];
    if (g.sector?.activeBuff === 'free_weapon' && weaponKeys.includes(key)) {
      g.sector.activeBuff = null; // Clear buff after use
    } else if (g.scrap < cost) {
      return;
    } else {
      g.scrap -= cost;
    }

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

  // ─── Emergency Beacon purchase ──────────────────────────────────────────────
  const buyBeacon = (cost) => {
    const g = game.current;
    if (!g || g.scrap < cost) return;
    if (g.emergencyBeacon?.purchased) return;
    g.scrap -= cost;
    g.emergencyBeacon.purchased = true;
    setUiScrap(g.scrap);
    setUiEmergencyBeacon({ ...g.emergencyBeacon });
  };

  // ─── Relic purchase ─────────────────────────────────────────────────
  const buyRelic = (relicId, cost) => {
    const g = game.current;
    if (!g || g.scrap < cost) return;
    const relic = getRelicById(relicId);
    if (!relic) return;
    if (!tryAddRelic(g, relicId)) return;
    g.scrap -= cost;
    setUiScrap(g.scrap);
  };

  // ─── Beacon-aware state setter (intercepts gameover for respawn) ────────────
  const effectiveSetState = (state) => {
    if (state === 'gameover' && game.current?.emergencyBeacon?.activated) {
      // Respawn at beacon node instead of game over
      const g = game.current;
      g.player.hp = g.player.maxHp;
      g.player.shield = g.player.maxShield;
      g.emergencyBeacon.purchased = false;
      g.emergencyBeacon.activated = false;
      g.emergencyBeacon.nodeId = null;
      // Clear entity arrays to prevent stale enemies/projectiles from persisting
      resetEntityPools(g);
      setUiEmergencyBeacon({ purchased: false, activated: false, nodeId: null });
      // Sync player stats to UI
      setUiLevels({ ...g.levels });
      setUiScrap(g.scrap);
      setGameState('map');
      return;
    }
    setGameState(state);
  };

  // ─── Init game state on mount ──────────────────────────────────────────────
  useEffect(() => { resetGame(); }, []);

  // ─── Hooks ──────────────────────────────────────────────────────────────────
  const { threeRef, statusRef } = useGameLoop({
    containerRef, canvasRef, game, gameState, setGameState: effectiveSetState, setMapStateVersion, setNotificationVersion, devMode,
  });

  const { onPointerDown, onPointerMove, onPointerUp } = useInput({
    game, threeRef, gameState, statusRef, devMode, setGameState, setDevMode, startGame, paused, setPaused, setUiEmergencyBeacon,
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
          setUiEmergencyBeacon={setUiEmergencyBeacon}
        />
      )}

      {gameState === 'shop'     && <ShopOverlay    uiScrap={uiScrap} uiLevels={uiLevels} buyUpgrade={buyUpgrade} setGameState={setGameState} uiShipSkin={uiShipSkin} uiUnlockedSkins={uiUnlockedSkins} buySkin={buySkin} uiEmergencyBeacon={uiEmergencyBeacon} buyBeacon={buyBeacon} activeBuff={game.current?.sector?.activeBuff} buyRelic={buyRelic} uiRelics={game.current?.relics || []} uiRelicSlotLimit={game.current?.relicSlotLimit || 5} />}
      {gameState === 'relicChoice' && (
        <RelicChoice onSelect={selectStartingRelic} onSkip={skipRelicChoice} />
      )}
      {gameState === 'start'    && <StartScreen    startGame={startGame} continueGame={continueGame} devMode={devMode} gameRef={game} />}
      {gameState === 'gameover' && <GameOverScreen  gameRef={game} startGame={startGame} />}
      {gameState === 'victory'  && <VictoryScreen   gameRef={game} startGame={startGame} nextSector={nextSector} />}
      {gameState === 'event'    && <EventScreen     gameRef={game} setGameState={setGameState} setUiScrap={setUiScrap} setUiLevels={setUiLevels} />}
      {gameState === 'dev'      && <DevMissionPicker onLaunch={launchDevMission} onExit={() => { setDevMode(false); setGameState('start'); }} />}
      {gameState === 'playing' && paused && <PauseOverlay gameRef={game} startGame={startGame} setPaused={setPaused} />}
      {gameState === 'playing' && game?.current?.transitionTimer !== undefined && <PostMissionSummary game={game} visible={true} />}
      {gameState === 'playing' && <AchievementNotification game={game} visible={true} notificationVersion={notificationVersion} onBumpNotification={setNotificationVersion} />}
    </div>
  );
}
