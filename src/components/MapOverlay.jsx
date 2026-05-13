import React, { useEffect } from 'react';
import { Skull, Heart, Zap, Crosshair, Activity, Magnet, Wrench, Target, AlertTriangle, Map as MapIcon, Navigation, Shield, Bomb } from 'lucide-react';
import { enterNodeMission } from '../engine/missionSetup';

/**
 * MapOverlay — Sector map screen (Slay-the-Spire style).
 *
 * Props:
 *   game            — game.current ref value (the live mutable state object)
 *   setGameState    — React state setter
 *   setUiScrap      — React state setter
 *   setUiLevels     — React state setter
 *   setMapStateVersion — React state setter (forces re-render after repairs)
 *   mapStateVersion — number (consumed only to trigger re-renders, not used directly)
 */
export default function MapOverlay({ game, setGameState, setUiScrap, setUiLevels, setMapStateVersion, mapStateVersion }) {
  // Force re-render when mapStateVersion changes (e.g. after repair node)
  useEffect(() => {}, [mapStateVersion]);

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
    if (type === 'elite')    return <Activity className="w-6 h-6" />;
    if (type === 'shop')     return <Wrench className="w-5 h-5" />;
    if (type === 'repair')   return <Heart className="w-5 h-5" />;
    if (type === 'event')    return <AlertTriangle className="w-5 h-5" />;
    if (type === 'escort')   return <Navigation className="w-5 h-5" />;
    if (type === 'defend')   return <Shield className="w-5 h-5" />;
    if (type === 'sabotage') return <Bomb className="w-5 h-5" />;
    return <Target className="w-5 h-5" />;
  };

  const getColor = (type, status) => {
    if (status === 'locked')  return 'border-gray-700 text-gray-600 bg-gray-900 shadow-none hover:border-gray-500';
    if (status === 'cleared') return 'border-green-600 text-green-500 bg-green-900/40 shadow-[0_0_10px_#16a34a]';
    if (type === 'boss')     return 'border-red-500 text-red-500 bg-red-900/60 shadow-[0_0_20px_#ef4444]';
    if (type === 'elite')    return 'border-purple-500 text-purple-400 bg-purple-900/60 shadow-[0_0_15px_#a855f7]';
    if (type === 'shop')     return 'border-blue-500 text-blue-400 bg-blue-900/60 shadow-[0_0_15px_#3b82f6]';
    if (type === 'repair')   return 'border-pink-500 text-pink-400 bg-pink-900/60 shadow-[0_0_15px_#ec4899]';
    if (type === 'event')    return 'border-yellow-500 text-yellow-400 bg-yellow-900/60 shadow-[0_0_15px_#eab308]';
    if (type === 'escort')   return 'border-pink-400 text-pink-400 bg-pink-900/60 shadow-[0_0_15px_#f472b6]';
    if (type === 'defend')   return 'border-cyan-400 text-cyan-400 bg-cyan-900/60 shadow-[0_0_15px_#22d3ee]';
    if (type === 'sabotage') return 'border-amber-500 text-amber-400 bg-amber-900/60 shadow-[0_0_15px_#f59e0b]';
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
      setGameState('shop');
    } else if (n.type === 'repair') {
      n.status = 'cleared';
      const heal = Math.floor(game.player.maxHp * 0.3);
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
      unlockNext();
      setMapStateVersion(v => v + 1);
    } else if (n.type === 'event') {
      n.status = 'cleared';
      unlockNext();
      setGameState('event');
    } else {
      // Combat / elite / boss node
      enterNodeMission(game, game.level, n.type);
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
        <div className="flex items-center gap-3"><Skull        className="w-5 h-5 text-red-500"    /> <span className="text-gray-300 font-bold uppercase tracking-wider text-red-400">Sector Boss</span></div>
      </div>

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
          </div>
        );
      })}
    </div>
  );
}
