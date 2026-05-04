import React, { useState, useEffect, useRef } from 'react';

import { generateMap }       from './engine/mapGenerator';
import { updatePhysics }     from './engine/physics';
import { initThreeScene, drawFrame, raycastToPlane } from './engine/renderer';

import MapOverlay    from './components/MapOverlay';
import ShopOverlay   from './components/ShopOverlay';
import StartScreen   from './components/StartScreen';
import GameOverScreen from './components/GameOverScreen';
import VictoryScreen from './components/VictoryScreen';
import EventScreen   from './components/EventScreen';
import DevMissionPicker from './components/DevMissionPicker';

export default function App() {
  const [gameState,       setGameState]       = useState('start');
  const [uiScrap,         setUiScrap]         = useState(0);
  const [uiLevels,        setUiLevels]        = useState(null);
  const [mapStateVersion, setMapStateVersion] = useState(0);
  const [devMode,         setDevMode]         = useState(false);

  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const game         = useRef(null);
  const threeRef     = useRef(null);
  const reqRef       = useRef();
  const statusRef    = useRef(gameState);
  const devModeRef   = useRef(devMode);

  useEffect(() => { statusRef.current = gameState; }, [gameState]);
  useEffect(() => { devModeRef.current = devMode; }, [devMode]);

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

  const startGame = () => { resetGame(); setGameState(devModeRef.current ? 'dev' : 'map'); };

  // ─── Dev mode: launch a specific mission ────────────────────────────────────
  const launchDevMission = ({ type, level }) => {
    resetGame();
    game.current.level = level;

    // Create mission directly based on selected type
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

    // Set up escort if needed
    if (type === 'escort') {
      const lvl = level;
      game.current.escort.active = true;
      game.current.escort.hp = game.current.escort.maxHp = 120 + lvl * 25;
      game.current.escort.lives = Math.max(1, 3 - Math.floor(lvl / 4));
      game.current.escort.x = (Math.random() - 0.5) * 300;
      game.current.escort.y = (Math.random() - 0.5) * 300;
      const angle = Math.random() * Math.PI * 2;
      const distance = 1000 + lvl * 80;
      game.current.escort.targetX = Math.max(-3500, Math.min(3500, game.current.escort.x + Math.cos(angle) * distance));
      game.current.escort.targetY = Math.max(-3500, Math.min(3500, game.current.escort.y + Math.sin(angle) * distance));
      game.current.escort.speed = 55 + lvl * 3;
      game.current.escort.respawnTimer = 0;
      game.current.escort.evasionTimer = 0;
      game.current.escort.evasionAngle = 0;
      game.current.escort.startDist = distance;
    } else {
      game.current.escort.active = false;
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

  // ─── Main effect: three.js init + game loop ────────────────────────────────
  useEffect(() => {
    resetGame();

    // Init Three.js
    if (!threeRef.current) {
      threeRef.current = initThreeScene(containerRef.current);
    }

    // In dev mode, redirect 'map' transitions back to 'dev' picker
    const devAwareSetState = (state) => {
      if (state === 'map' && devModeRef.current) {
        setGameState('dev');
      } else {
        setGameState(state);
      }
    };
    const physicsCbs = { setGameState: devAwareSetState, setMapStateVersion };

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

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === ' ' && !e.repeat) {
        setGameState(prev => {
          if (prev === 'shop') return 'map';
          if (prev === 'start' || prev === 'gameover') { setTimeout(startGame, 0); return prev; }
          return prev;
        });
      }
      // Toggle dev mode with backtick ` key on start/gameover/victory screens
      if (key === '`' && !e.repeat) {
        const currentGameState = statusRef.current;
        if (currentGameState === 'start' || currentGameState === 'gameover' || currentGameState === 'victory') {
          setDevMode(dm => !dm);
        } else if (currentGameState === 'playing' && game.current?.devMode) {
          // During gameplay in dev mode: abort mission, go back to picker
          setDevMode(true); // keep dev mode on
          setGameState('dev');
        }
        if (game.current) game.current.keys[key] = true;
        return;
      }
      if (game.current) game.current.keys[key] = true;
    };
    const handleKeyUp = (e) => { if (game.current) game.current.keys[e.key.toLowerCase()] = false; };
    const handleResize = () => {
      if (!threeRef.current) return;
      threeRef.current.camera.aspect = window.innerWidth / window.innerHeight;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);
    window.addEventListener('resize',  handleResize);
    handleResize();
    reqRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(reqRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup',   handleKeyUp);
      window.removeEventListener('resize',  handleResize);
      if (threeRef.current && containerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        containerRef.current.removeChild(threeRef.current.renderer.domElement);
        threeRef.current.renderer.dispose();
        threeRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Pointer event helpers (inline to keep access to threeRef & game) ─────
  const onPointerDown = (e) => {
    if (gameState !== 'playing' || !game.current) return;
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (game.current.touchId === null) {
        game.current.touchId      = e.pointerId;
        game.current.touchBase    = { x: e.clientX, y: e.clientY };
        game.current.touchCurrent = { x: e.clientX, y: e.clientY };
      }
    } else {
      game.current.mouse.x = e.clientX; game.current.mouse.y = e.clientY; game.current.mouse.active = true;
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
      game.current.mouse.x = e.clientX; game.current.mouse.y = e.clientY;
      if (e.buttons > 0) game.current.mouse.active = true;
      if (threeRef.current) {
        const wm = raycastToPlane(e.clientX, e.clientY, threeRef.current.camera);
        if (wm) game.current.worldMouse = wm;
      }
    }
  };

  const onPointerUp = (e) => {
    if (!game.current) return;
    if (e.pointerId === game.current.touchId) { game.current.touchId = null; game.current.touchBase = null; game.current.touchCurrent = null; }
    if (e.pointerType === 'mouse') game.current.mouse.active = false;
  };

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