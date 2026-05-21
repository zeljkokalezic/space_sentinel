import React, { useState } from 'react';
import {
  Target, Activity, Zap, Crosshair,
  Heart, Magnet, Wrench, Shield,
  Rocket, Timer, Package, Navigation,
  Skull, ChevronUp, ChevronDown,
  Bug, Bomb, Mountain, Wind, CloudLightning, Hexagon
} from 'lucide-react';
import { BOSS_ROSTER, MINIBOSS_ROSTER } from '../constants/bosses';

const HAZARD_OPTIONS = [
  { id: 'none',            label: 'None',       icon: null },
  { id: 'asteroidField',   label: 'Asteroids',  icon: Mountain },
  { id: 'gravityWell',     label: 'Gravity',    icon: Wind },
  { id: 'plasmaStorm',     label: 'Plasma',     icon: CloudLightning },
  { id: 'empZone',         label: 'EMP',        icon: Hexagon },
];

const MISSION_TYPES = [
  { id: 'kill',       label: 'Kill',       icon: Target,    color: 'cyan',   desc: 'Destroy N enemies' },
  { id: 'collect',    label: 'Collect',    icon: Package,   color: 'green',  desc: 'Collect N scrap from enemies' },
  { id: 'survive',    label: 'Survive',    icon: Timer,     color: 'orange', desc: 'Survive for N seconds' },
  { id: 'escort',     label: 'Escort',     icon: Navigation, color: 'pink',  desc: 'Protect a drone to its destination' },
  { id: 'defend',     label: 'Defend',     icon: Shield,    color: 'blue',   desc: 'Defend a position from waves' },
  { id: 'sabotage',   label: 'Sabotage',   icon: Bomb,      color: 'amber',  desc: 'Destroy enemy turret structures' },
  { id: 'kill_elite', label: 'Elite Hunt', icon: Activity,  color: 'purple', desc: 'Destroy elite-tier enemies' },
  { id: 'kill_boss',  label: 'Boss Rush',  icon: Skull,     color: 'red',    desc: 'Fight the Sentinel Core boss' },
  { id: 'kill_miniboss', label: 'Mini-Boss', icon: Skull,   color: 'yellow', desc: 'Fight a mini-boss (scaled boss)' },
];

const COLOR_MAP = {
  cyan:   { border: 'border-cyan-500',  bg: 'bg-cyan-900/40',   text: 'text-cyan-400',    glow: 'shadow-[0_0_15px_#06b6d4]' },
  green:  { border: 'border-green-500', bg: 'bg-green-900/40',  text: 'text-green-400',   glow: 'shadow-[0_0_15px_#22c55e]' },
  orange: { border: 'border-orange-500', bg: 'bg-orange-900/40', text: 'text-orange-400',  glow: 'shadow-[0_0_15px_#f97316]' },
  pink:   { border: 'border-pink-500',  bg: 'bg-pink-900/40',   text: 'text-pink-400',    glow: 'shadow-[0_0_15px_#ec4899]' },
  blue:   { border: 'border-blue-500',  bg: 'bg-blue-900/40',   text: 'text-blue-400',    glow: 'shadow-[0_0_15px_#3b82f6]' },
  amber:  { border: 'border-amber-500', bg: 'bg-amber-900/40',  text: 'text-amber-400',   glow: 'shadow-[0_0_15px_#f59e0b]' },
  purple: { border: 'border-purple-500', bg: 'bg-purple-900/40', text: 'text-purple-400',  glow: 'shadow-[0_0_15px_#a855f7]' },
  red:    { border: 'border-red-500',   bg: 'bg-red-900/40',    text: 'text-red-400',     glow: 'shadow-[0_0_15px_#ef4444]' },
  yellow: { border: 'border-yellow-500', bg: 'bg-yellow-900/40', text: 'text-yellow-400',  glow: 'shadow-[0_0_15px_#eab308]' },
};

function MissionCard({ mission, selected, onClick }) {
  const Icon = mission.icon;
  const c = COLOR_MAP[mission.color] || COLOR_MAP.cyan;
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${c.border} ${c.bg} ${c.glow}
        ${selected ? 'scale-105 ring-2 ring-white/40' : 'hover:scale-105 hover:ring-1 hover:ring-white/20'}
      `}
    >
      <Icon className={`w-8 h-8 ${c.text}`} />
      <span className={`font-black text-sm ${c.text}`}>{mission.label}</span>
      <span className="text-gray-400 text-xs text-center">{mission.desc}</span>
      {selected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-black text-xs font-black shadow-lg">
          ✓
        </div>
      )}
    </button>
  );
}

function LevelSlider({ value, onChange, min = 1, max = 20 }) {
  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      <div className="flex items-center gap-3 w-full">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-600 hover:bg-gray-700 flex items-center justify-center transition-colors"
        >
          <ChevronDown className="w-5 h-5 text-gray-300" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-400">
            {value}
          </div>
          <div className="text-xs text-gray-400 uppercase tracking-widest mt-1">Difficulty Level</div>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-600 hover:bg-gray-700 flex items-center justify-center transition-colors"
        >
          <ChevronUp className="w-5 h-5 text-gray-300" />
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-yellow-400"
      />
    </div>
  );
}

function VariantSelector({ roster, value, onChange, label }) {
  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      <div className="text-xs text-gray-400 uppercase tracking-widest font-bold">{label}</div>
      <div className="flex gap-2 flex-wrap justify-center">
        {roster.map((v, i) => (
          <button
            key={v.id}
            onClick={() => onChange(i)}
            className={`px-3 py-2 rounded-lg border transition-all text-xs font-bold
              ${value === i
                ? 'bg-gray-700 scale-105 ring-1 ring-white/30'
                : 'bg-gray-800/50 hover:bg-gray-700 border-gray-600'}
            `}
            style={{ borderColor: value === i ? '#' + v.color.toString(16).padStart(6, '0') : undefined }}
          >
            {v.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DevMissionPicker({ onLaunch, onExit }) {
  const [selectedType, setSelectedType] = useState('kill');
  const [level, setLevel] = useState(1);
  const [selectedHazard, setSelectedHazard] = useState('none');
  const [variantIndex, setVariantIndex] = useState(0);

  const handleLaunch = () => {
    const missionDef = MISSION_TYPES.find(m => m.id === selectedType);
    onLaunch({ type: selectedType, level, hazard: selectedHazard, label: missionDef?.label || selectedType, variantIndex });
  };

  const isBoss = selectedType === 'kill_boss' || selectedType === 'kill_miniboss';
  const roster = selectedType === 'kill_boss' ? BOSS_ROSTER : MINIBOSS_ROSTER;

  return (
    <div className="absolute inset-0 bg-[#0a0a14]/95 flex flex-col items-center justify-center z-50 backdrop-blur-md overflow-y-auto font-sans">
      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-6 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <Bug className="w-5 h-5 text-orange-400" />
          <span className="text-orange-400 font-mono text-sm font-bold tracking-wider">DEV MODE</span>
        </div>
        <button
          onClick={onExit}
          className="pointer-events-auto px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 text-sm font-bold transition-colors"
        >
          Exit Dev
        </button>
      </div>

      {/* Title */}
      <div className="mt-16 mb-8 text-center">
        <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300 tracking-widest drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]">
          MISSION SELECTOR
        </h2>
        <p className="text-gray-400 mt-2 text-sm">Choose your mission type and difficulty</p>
      </div>

      {/* Level Slider */}
      <div className="mb-8 bg-gray-900/60 rounded-xl p-4 border border-gray-700">
        <LevelSlider value={level} onChange={setLevel} />
      </div>

      {/* Mission Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-lg px-4 mb-6">
        {MISSION_TYPES.map(m => (
          <MissionCard
            key={m.id}
            mission={m}
            selected={selectedType === m.id}
            onClick={() => setSelectedType(m.id)}
          />
        ))}
      </div>

      {/* Variant Selector (boss/miniboss only) */}
      {isBoss && (
        <div className="mb-6 bg-gray-900/60 rounded-xl p-4 border border-gray-700">
          <VariantSelector
            roster={roster}
            value={variantIndex}
            onChange={setVariantIndex}
            label={selectedType === 'kill_boss' ? 'Boss Variant' : 'Mini-Boss Variant'}
          />
        </div>
      )}

      {/* Hazard Selector */}
      <div className="mb-6 text-center">
        <div className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-bold">Environmental Hazard</div>
        <div className="flex gap-2 flex-wrap justify-center">
          {HAZARD_OPTIONS.map(h => {
            const Icon = h.icon;
            const isSelected = selectedHazard === h.id;
            const colors = {
              none: 'text-gray-400 border-gray-600',
              asteroidField: 'text-gray-400 border-gray-500',
              gravityWell: 'text-purple-400 border-purple-500',
              plasmaStorm: 'text-purple-400 border-purple-500',
              empZone: 'text-yellow-400 border-yellow-500',
            };
            return (
              <button
                key={h.id}
                onClick={() => setSelectedHazard(h.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-bold
                  ${colors[h.id] || colors.none}
                  ${isSelected ? 'bg-gray-700 scale-105 ring-1 ring-white/30' : 'bg-gray-800/50 hover:bg-gray-700'}
                `}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {h.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Launch Button */}
      <button
        onClick={handleLaunch}
        className="px-10 py-4 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 rounded-full font-black text-xl transition-all shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:shadow-[0_0_50px_rgba(251,146,60,0.6)] hover:scale-105 flex items-center gap-3"
      >
        <Rocket className="w-6 h-6 fill-current" />
        LAUNCH MISSION
      </button>

      {/* Quick info */}
      <div className="mt-6 text-gray-500 text-xs font-mono">
        Level {level} · {MISSION_TYPES.find(m => m.id === selectedType)?.desc}
      </div>
    </div>
  );
}
