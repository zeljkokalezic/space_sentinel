import React from 'react';
import { Skull, Heart, Zap, Crosshair, Activity, Magnet, Wrench, Target, AlertTriangle, Map as MapIcon, Navigation, Shield, Bomb, Mountain, Wind, CloudLightning, Hexagon, Sun, CircleDashed, Radio } from 'lucide-react';
import { enterNodeMission } from '../engine/missionSetup';
import { getRelicById } from '../engine/relicSystem';
import { CATEGORY_COLORS } from '../constants/relics';

/**
 * MapOverlay — Sector map screen (Slay-the-Spire style).
 *
 * Props:
 *   game            — game.current ref value (the live mutable state object)
 *   setGameState    — React state setter
 *   setUiScrap      — React state setter
 *   setUiLevels     — React state setter
 *   setUiShipSkin   — React state setter (active skin index)
 *   setUiUnlockedSkins — React state setter (unlocked skins array)
 *   setMapStateVersion — React state setter (forces re-render after repairs)
 *   mapStateVersion — number (consumed only to trigger re-renders, not used directly)
 */
// eslint-disable-next-line no-unused-vars
export default function MapOverlay({ game, setGameState, setUiScrap, setUiLevels, setUiShipSkin, setUiUnlockedSkins, setMapStateVersion, mapStateVersion, setUiEmergencyBeacon }) {
  if (!game || !game.map) return null;

  const { nodes, edges, currentNodeId } = game.map;

  const rowHeight = window.innerHeight > 800 ? 70 : 55;
  const colWidth  = window.innerWidth  > 1000 ? 120 : 80;
  const mapYOffset = game.map.currentRow > 5 ? (game.map.currentRow - 5) * rowHeight : 0;

  const getNodePos = (row, col) => ({
    x: window.innerWidth / 2 + (col - 2) * colWidth,
    y: window.innerHeight - 150 - row * rowHeight + mapYOffset,
  });

  const getIcon = (type) => {
    if (type === 'boss')     return <Skull className="w-8 h-8" />;
    if (type === 'miniboss') return <Skull className="w-6 h-6" />;
    if (type === 'elite')    return <Activity className="w-6 h-6" />;
    if (type === 'shop')     return <Wrench className="w-5 h-5" />;
    if (type === 'repair')   return <Heart className="w-5 h-5" />;
    if (type === 'event')    return <AlertTriangle className="w-5 h-5" />;
    if (type === 'escort')   return <Navigation className="w-5 h-5" />;
    if (type === 'defend')   return <Shield className="w-5 h-5" />;
    if (type === 'sabotage') return <Bomb className="w-5 h-5" />;
    if (type === 'gauntlet') return <span className="text-xl">⚔️</span>;
    if (type === 'wave_surge') return <span className="text-xl">🌊</span>;
    return <Target className="w-5 h-5" />;
  };

  const getColor = (type, status) => {
    if (status === 'locked')  return 'border-gray-700 text-gray-600 bg-gray-900 shadow-none hover:border-gray-500';
    if (status === 'cleared') return 'border-green-600 text-green-500 bg-green-900/40 shadow-[0_0_10px_#16a34a]';
    if (type === 'boss')     return 'border-red-500 text-red-500 bg-red-900/60 shadow-[0_0_20px_#ef4444]';
    if (type === 'miniboss') return 'border-orange-500 text-orange-500 bg-orange-900/60 shadow-[0_0_18px_#f97316]';
    if (type === 'elite')    return 'border-purple-500 text-purple-400 bg-purple-900/60 shadow-[0_0_15px_#a855f7]';
    if (type === 'shop')     return 'border-blue-500 text-blue-400 bg-blue-900/60 shadow-[0_0_15px_#3b82f6]';
    if (type === 'repair')   return 'border-pink-500 text-pink-400 bg-pink-900/60 shadow-[0_0_15px_#ec4899]';
    if (type === 'event')    return 'border-yellow-500 text-yellow-400 bg-yellow-900/60 shadow-[0_0_15px_#eab308]';
    if (type === 'escort')   return 'border-pink-400 text-pink-400 bg-pink-900/60 shadow-[0_0_15px_#f472b6]';
    if (type === 'defend')   return 'border-cyan-400 text-cyan-400 bg-cyan-900/60 shadow-[0_0_15px_#22d3ee]';
    if (type === 'sabotage') return 'border-amber-500 text-amber-400 bg-amber-900/60 shadow-[0_0_15px_#f59e0b]';
    if (type === 'gauntlet') return 'border-red-600 text-red-400 bg-red-900/60 shadow-[0_0_15px_#dc2626]';
    if (type === 'wave_surge') return 'border-yellow-500 text-yellow-400 bg-yellow-900/60 shadow-[0_0_15px_#eab308]';
    return 'border-cyan-500 text-cyan-400 bg-cyan-900/60 shadow-[0_0_15px_#06b6d4]';
  };

  const handleNodeClick = (n) => {
    if (n.status !== 'available') return;

    game.map.currentNodeId = n.id;
    game.map.currentRow    = n.row;

    const unlockNext = () => {
      game.map.edges.filter(e => e.from === n.id).forEach(e => {
        const nd = game.map.nodes.find(x => x.id === e.to);
        if (nd) nd.status = 'available';
      });
    };

    if (n.type === 'shop') {
      n.status = 'cleared';
      unlockNext();
      setUiScrap(game.scrap);
      setUiLevels({ ...game.levels });
      if (setUiShipSkin) setUiShipSkin(game.shipSkin ?? 0);
      if (setUiUnlockedSkins) setUiUnlockedSkins([...game.unlockedSkins]);
      setGameState('shop');
    } else if (n.type === 'repair') {
      n.status = 'cleared';
      const heal = Math.floor(game.player.maxHp * 0.3);
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
      // Reset emergency beacon so player can buy a new one
      if (game.emergencyBeacon) {
        game.emergencyBeacon.purchased = false;
        game.emergencyBeacon.activated = false;
        game.emergencyBeacon.nodeId = null;
        if (setUiEmergencyBeacon) {
          setUiEmergencyBeacon({ purchased: false, activated: false, nodeId: null });
        }
      }
      unlockNext();
      setMapStateVersion(v => v + 1);
    } else if (n.type === 'event') {
      n.status = 'cleared';
      unlockNext();
      setGameState('event');
    } else {
      // Combat / elite / boss node
      enterNodeMission(game, game.level, n.type, n);
      setGameState('playing');
    }
  };

  return (
    <div className="absolute inset-0 bg-[#0a0a14]/95 flex flex-col items-center justify-center z-40 backdrop-blur-md overflow-hidden font-sans">
      {/* Header */}
      <div className="absolute inset-x-0 top-10 flex flex-col items-center pointer-events-none z-50">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-widest drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          SECTOR MAP
        </h2>
        <div className="text-2xl font-mono text-yellow-400 mt-2 flex items-center gap-3 bg-black/80 px-6 py-2 rounded-full border border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
          <div className="w-4 h-4 bg-yellow-400 rounded-sm shadow-[0_0_10px_#facc15]" /> {game.scrap || 0}
        </div>
      </div>

      {/* Weather effects bar */}
      {game.weather && game.weather.active.length > 0 && (
        <div className="absolute top-28 inset-x-0 flex justify-center gap-4 pointer-events-none z-50 flex-wrap px-4">
          {game.weather.active.includes('solarFlare') && (
            <div className="flex items-center gap-2 bg-yellow-900/60 border border-yellow-500/50 rounded-lg px-4 py-2 shadow-[0_0_10px_rgba(234,179,8,0.3)]">
              <Sun className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-300 font-bold text-sm">Solar Flare</span>
              <span className="text-yellow-500 text-xs">— sensor blind</span>
            </div>
          )}
          {game.weather.active.includes('debrisField') && (
            <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-500/50 rounded-lg px-4 py-2 shadow-[0_0_10px_rgba(107,114,128,0.3)]">
              <Mountain className="w-5 h-5 text-gray-400" />
              <span className="text-gray-300 font-bold text-sm">Debris Field</span>
              <span className="text-gray-500 text-xs">— blocks projectiles</span>
            </div>
          )}
          {game.weather.active.includes('gravityAnomaly') && (
            <div className="flex items-center gap-2 bg-purple-900/60 border border-purple-500/50 rounded-lg px-4 py-2 shadow-[0_0_10px_rgba(124,58,237,0.3)]">
              <CircleDashed className="w-5 h-5 text-purple-400" />
              <span className="text-purple-300 font-bold text-sm">Gravity Anomaly</span>
              <span className="text-purple-500 text-xs">— slows projectiles</span>
            </div>
          )}
          {game.weather.active.includes('electromagneticInterference') && (
            <div className="flex items-center gap-2 bg-amber-900/60 border border-amber-500/50 rounded-lg px-4 py-2 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
              <Radio className="w-5 h-5 text-amber-400" />
              <span className="text-amber-300 font-bold text-sm">EMI</span>
              <span className="text-amber-500 text-xs">— disables weapons</span>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-8 left-4 md:left-8 bg-[#0a0a14]/90 border border-gray-700 rounded-xl p-5 font-sans text-sm flex flex-col gap-3 shadow-2xl z-50 backdrop-blur-md">
        <div className="text-gray-400 font-black mb-1 border-b border-gray-700 pb-2 tracking-widest text-xs uppercase">Node Legend</div>
        <div className="flex items-center gap-3"><Target       className="w-5 h-5 text-cyan-400"   /> <span className="text-gray-300 font-bold">Standard Combat</span></div>
        <div className="flex items-center gap-3"><Navigation   className="w-5 h-5 text-pink-400"   /> <span className="text-gray-300 font-bold">Escort Drone</span></div>
        <div className="flex items-center gap-3"><Shield       className="w-5 h-5 text-blue-400"    /> <span className="text-gray-300 font-bold">Defend Beacon</span></div>
        <div className="flex items-center gap-3"><Activity     className="w-5 h-5 text-purple-400" /> <span className="text-gray-300 font-bold">Elite Encounter</span></div>
        <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-yellow-400"/> <span className="text-gray-300 font-bold">Unknown Anomaly</span></div>
        <div className="flex items-center gap-3"><Wrench       className="w-5 h-5 text-blue-400"   /> <span className="text-gray-300 font-bold">Systems Shop</span></div>
        <div className="flex items-center gap-3"><Heart        className="w-5 h-5 text-pink-400"   /> <span className="text-gray-300 font-bold">Emergency Repair</span></div>
        <div className="flex items-center gap-3"><Bomb         className="w-5 h-5 text-amber-400"   /> <span className="text-gray-300 font-bold">Sabotage Turrets</span></div>
        <div className="flex items-center gap-3"><span className="text-lg">⚔️</span> <span className="text-gray-300 font-bold">Gauntlet</span></div>
        <div className="flex items-center gap-3"><span className="text-lg">🌊</span> <span className="text-gray-300 font-bold">Wave Surge</span></div>
        <div className="flex items-center gap-3"><Skull        className="w-5 h-5 text-red-500"    /> <span className="text-gray-300 font-bold uppercase tracking-wider text-red-400">Sector Boss</span></div>
        <div className="text-gray-400 font-black mt-2 mb-1 border-b border-gray-700 pb-2 tracking-widest text-xs uppercase">Hazards</div>
        <div className="flex items-center gap-3"><Mountain     className="w-4 h-4 text-gray-400"    /> <span className="text-gray-400 text-xs">Asteroid Field</span></div>
        <div className="flex items-center gap-3"><Wind         className="w-4 h-4 text-purple-400"  /> <span className="text-gray-400 text-xs">Gravity Well</span></div>
        <div className="flex items-center gap-3"><CloudLightning className="w-4 h-4 text-purple-400"/> <span className="text-gray-400 text-xs">Plasma Storm</span></div>
        <div className="flex items-center gap-3"><Hexagon      className="w-4 h-4 text-yellow-400"  /> <span className="text-gray-400 text-xs">EMP Zone</span></div>
      </div>

      {/* Relic inventory */}
      {game.relics && game.relics.length > 0 && (
        <div className="absolute bottom-8 right-4 bg-[#0a0a14]/90 border border-gray-700 rounded-xl p-5 font-sans text-sm shadow-2xl z-50 backdrop-blur-md">
          <div className="text-gray-400 font-black mb-2 tracking-widest text-xs uppercase">
            RELICS ({game.relics.length}/{game.relicSlotLimit || 5})
          </div>
          <div className="flex flex-wrap gap-2 max-w-48">
            {game.relics.map((rId, i) => {
              const relic = getRelicById(rId);
              if (!relic) return null;
              const color = CATEGORY_COLORS[relic.category] || '#888';
              return (
                <div
                  key={i}
                  className="w-8 h-8 rounded bg-gray-800 border flex items-center justify-center cursor-help"
                  style={{ borderColor: color }}
                  title={`${relic.name}: ${relic.description}`}
                >
                  <span>{relic.icon}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {edges.map((e, i) => {
          const n1 = nodes.find(n => n.id === e.from);
          const n2 = nodes.find(n => n.id === e.to);
          if (!n1 || !n2) return null;
          const p1 = getNodePos(n1.row, n1.col);
          const p2 = getNodePos(n2.row, n2.col);
          const isActive = n1.id === currentNodeId;
          let stroke = '#1f2937', sw = 2;
          if (isActive) { stroke = '#06b6d4'; sw = 4; }
          else if (n1.status === 'cleared' && (n2.status === 'cleared' || n2.status === 'active')) { stroke = '#22c55e'; sw = 3; }
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={sw} style={{ filter: isActive ? 'drop-shadow(0px 0px 8px #06b6d4)' : '' }} className="transition-all duration-300" />;
        })}
      </svg>

      {/* Nodes */}
      {nodes.map(n => {
        const pos = getNodePos(n.row, n.col);
        const isAvailable = n.status === 'available';
        const isCurrent   = n.id === currentNodeId;
        return (
          <div
            key={n.id}
            className={`absolute flex items-center justify-center rounded-full border-2 ${getColor(n.type, n.status)} ${isAvailable ? 'cursor-pointer hover:scale-125 hover:z-20 transition-all duration-200' : 'transition-all duration-200'}`}
            style={{ left: pos.x - 24, top: pos.y - 24, width: 48, height: 48, outline: isCurrent ? '4px solid rgba(34,197,94,0.6)' : 'none', outlineOffset: '4px' }}
            onClick={() => handleNodeClick(n)}
          >
            <div className={n.status === 'locked' ? 'opacity-30' : 'opacity-100'}>{getIcon(n.type)}</div>
            {isAvailable && n.type === 'repair' && <div className="absolute -bottom-7 whitespace-nowrap text-sm font-bold text-pink-400 bg-black/60 px-2 py-1 rounded">REPAIR +30%</div>}
            {isAvailable && n.type === 'shop'   && <div className="absolute -bottom-7 whitespace-nowrap text-sm font-bold text-blue-400 bg-black/60 px-2 py-1 rounded">SYSTEM SHOP</div>}
            {isAvailable && n.type === 'event'  && <div className="absolute -bottom-7 whitespace-nowrap text-sm font-bold text-yellow-400 bg-black/60 px-2 py-1 rounded border border-yellow-500/50">ANOMALY</div>}
            {isAvailable && n.type === 'boss'   && <div className="absolute -bottom-7 whitespace-nowrap text-sm font-black text-red-500 animate-pulse bg-black/80 px-2 py-1 rounded border border-red-500">WARNING</div>}
            {isAvailable && n.type === 'elite'     && <div className="absolute -bottom-7 whitespace-nowrap text-xs font-bold text-purple-400 bg-black/60 px-2 py-1 rounded">ELITE</div>}
            {isAvailable && n.type === 'sabotage'  && <div className="absolute -bottom-7 whitespace-nowrap text-xs font-bold text-amber-400 bg-black/60 px-2 py-1 rounded">SABOTAGE</div>}
            {isAvailable && n.type === 'gauntlet'   && <div className="absolute -bottom-7 whitespace-nowrap text-xs font-bold text-red-400 bg-black/60 px-2 py-1 rounded">GAUNTLET</div>}
            {isAvailable && n.type === 'wave_surge' && <div className="absolute -bottom-7 whitespace-nowrap text-xs font-bold text-yellow-400 bg-black/60 px-2 py-1 rounded">WAVE SURGE</div>}
            {/* Hazard badges */}
            {isAvailable && n.hazardTypes && n.hazardTypes.map((ht, i) => (
              <div key={i} className="absolute -top-2 -right-2 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center border border-gray-600" style={{ transform: `translate(${i * 2}px, ${i * 2}px)` }}>
                {ht === 'asteroidField' && <Mountain className="w-3 h-3 text-gray-400" />}
                {ht === 'gravityWell' && <Wind className="w-3 h-3 text-purple-400" />}
                {ht === 'plasmaStorm' && <CloudLightning className="w-3 h-3 text-purple-400" />}
                {ht === 'empZone' && <Hexagon className="w-3 h-3 text-yellow-400" />}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
