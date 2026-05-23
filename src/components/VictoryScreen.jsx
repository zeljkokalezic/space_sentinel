import React, { useState, useEffect } from 'react';
import { Shield, RotateCcw, Trophy, Star, Zap } from 'lucide-react';
import {
  calculateSectorRank,
  applySectorRewards,
  getBuffChoices,
  applyBuff,
} from '../engine/sectorRank';

const RANK_COLORS = {
  S: '#fbbf24',
  A: '#22d3ee',
  B: '#22c55e',
  C: '#a3a3a3',
  D: '#ef4444',
};

const RANK_LABELS = {
  S: 'SPECTACULAR',
  A: 'EXCELLENT',
  B: 'GOOD',
  C: 'FAIR',
  D: 'POOR',
};

export default function VictoryScreen({ gameRef, startGame, nextSector }) {
  const g = gameRef?.current;

  const [rankData, setRankData] = useState(null);
  const [buffChoices, setBuffChoices] = useState([]);
  const [selectedBuff, setSelectedBuff] = useState(null);
  const [buffConfirmed, setBuffConfirmed] = useState(false);
  const [showVeteranUnlock, setShowVeteranUnlock] = useState(false);

  useEffect(() => {
    if (!g) return;
    const data = calculateSectorRank(g);
    setRankData(data);

    // Check if veteran mode is being unlocked now (was false, S-rank just earned)
    const wasVeteran = g.sector?.veteranMode ?? false;
    applySectorRewards(g, data.rank);

    if (data.rank === 'S' && !wasVeteran) {
      setShowVeteranUnlock(true);
    }

    // Show buff choices for A or S rank
    if (data.rank === 'A' || data.rank === 'S') {
      setBuffChoices(getBuffChoices());
    }
  }, [g]);

  const handleBuffSelect = (buffId) => {
    if (!g) return;
    setSelectedBuff(buffId);
    applyBuff(g, buffId);
  };

  const handleContinue = () => {
    if (nextSector) {
      nextSector();
    } else {
      startGame();
    }
  };

  const rank = rankData?.rank || '?';
  const rankColor = RANK_COLORS[rank] || '#ffffff';
  const rankLabel = RANK_LABELS[rank] || '';

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-cyan-950/90 text-white z-50 backdrop-blur-md overflow-y-auto">
      <div className="py-8 px-4 w-full max-w-lg">

        {/* Shield icon */}
        <Shield className="w-20 h-20 text-cyan-400 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]" />
        <h1 className="text-4xl md:text-6xl font-black mb-1 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-500 text-center">SECTOR SECURED</h1>
        <p className="text-cyan-200 text-lg mb-6 tracking-widest font-mono text-center">CORE DEFENDED SUCCESSFULLY</p>

        {/* Rank Display */}
        <div className="bg-black/50 p-6 rounded-2xl border border-cyan-900/50 mb-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span className="text-gray-300 text-sm font-mono tracking-wider">SECTOR RANK</span>
          </div>

          {/* Large rank letter */}
          <div
            className="text-8xl md:text-9xl font-black mb-2"
            style={{
              color: rankColor,
              textShadow: `0 0 40px ${rankColor}80, 0 0 80px ${rankColor}40`,
            }}
          >
            {rank}
          </div>
          <div className="text-xl font-bold mb-4" style={{ color: rankColor }}>{rankLabel}</div>

          {/* Score breakdown */}
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <div className="flex justify-between bg-black/30 px-3 py-2 rounded">
              <span className="text-gray-400">HP Score</span>
              <span className="text-green-400">{rankData?.hpScore ?? 0}/40</span>
            </div>
            <div className="flex justify-between bg-black/30 px-3 py-2 rounded">
              <span className="text-gray-400">Efficiency</span>
              <span className="text-blue-400">{rankData?.efficiencyScore ?? 0}/30</span>
            </div>
            <div className="flex justify-between bg-black/30 px-3 py-2 rounded">
              <span className="text-gray-400">Scrap</span>
              <span className="text-yellow-400">{rankData?.scrapScore ?? 0}/20</span>
            </div>
            <div className="flex justify-between bg-black/30 px-3 py-2 rounded">
              <span className="text-gray-400">Speed</span>
              <span className="text-purple-400">{rankData?.timeScore ?? 0}/10</span>
            </div>
          </div>
          <div className="flex justify-between bg-black/40 px-4 py-2 rounded mt-2 font-bold">
            <span className="text-gray-300">TOTAL</span>
            <span className="text-white">{rankData?.score ?? 0}/100</span>
          </div>
        </div>

        {/* Time & Scrap */}
        <div className="bg-black/50 p-5 rounded-2xl border border-cyan-900/50 mb-4">
          <div className="flex justify-between items-center mb-3 text-xl">
            <span className="text-gray-400">TIME TAKEN:</span>
            <span className="font-mono font-bold">{Math.floor(g?.totalTime || 0)}s</span>
          </div>
          <div className="flex justify-between items-center text-xl">
            <span className="text-gray-400">TOTAL SCRAP:</span>
            <span className="font-mono font-bold text-yellow-400 flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> {g?.totalScrapEarned || 0}
            </span>
          </div>
        </div>

        {/* Consecutive A+ Streak */}
        {g?.sector?.consecutiveARank > 0 && (
          <div className="bg-black/40 p-3 rounded-xl border border-yellow-900/30 mb-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-mono text-sm">
                A+ STREAK: {g.sector.consecutiveARank}
              </span>
            </div>
          </div>
        )}

        {/* Veteran Mode Unlock */}
        {showVeteranUnlock && (
          <div className="bg-gradient-to-r from-yellow-950/80 to-amber-950/80 p-4 rounded-xl border border-yellow-500/40 mb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-300 font-bold text-lg">VETERAN MODE UNLOCKED!</span>
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-yellow-200/70 text-sm">Enemies get +20% stats, rewards +50% scrap</p>
          </div>
        )}

        {/* Veteran Mode Active Indicator */}
        {g?.sector?.veteranMode && !showVeteranUnlock && (
          <div className="bg-gradient-to-r from-red-950/60 to-orange-950/60 p-3 rounded-xl border border-red-500/30 mb-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4 text-red-400" />
              <span className="text-red-300 font-mono text-sm font-bold">VETERAN MODE ACTIVE</span>
            </div>
          </div>
        )}

        {/* Buff Selection for A+ Rank */}
        {buffChoices.length > 0 && !buffConfirmed && (
          <div className="bg-black/50 p-5 rounded-2xl border border-purple-900/50 mb-4">
            <h3 className="text-lg font-bold text-purple-300 mb-3 text-center">
              {rank === 'S' ? 'S-RANK BONUS — Choose a Buff' : 'A-RANK BONUS — Choose a Buff'}
            </h3>
            <div className="space-y-2">
              {buffChoices.map((buff) => (
                <button
                  key={buff.id}
                  onClick={() => handleBuffSelect(buff.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all
                    ${selectedBuff === buff.id
                      ? 'border-purple-400 bg-purple-900/40 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'border-gray-700 bg-gray-800/40 hover:border-purple-600 hover:bg-purple-900/20'
                    }`}
                >
                  <div className="font-bold text-white text-sm">{buff.name}</div>
                  <div className="text-gray-400 text-xs mt-1">{buff.description}</div>
                </button>
              ))}
            </div>
            {selectedBuff && (
              <button
                onClick={() => setBuffConfirmed(true)}
                className="w-full mt-3 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-lg transition-all shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)]"
              >
                CONFIRM & CONTINUE
              </button>
            )}
          </div>
        )}

        {/* Buff Applied Confirmation */}
        {buffConfirmed && (
          <div className="bg-green-950/60 p-3 rounded-xl border border-green-500/30 mb-4 text-center">
            <span className="text-green-300 font-mono text-sm">
              ✓ BUFF APPLIED
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-6">
          <button
            className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-full font-black text-xl transition-all shadow-[0_0_30px_rgba(8,145,178,0.4)] hover:shadow-[0_0_50px_rgba(8,145,178,0.6)] hover:scale-105 flex items-center justify-center gap-3"
            onClick={handleContinue}
          >
            <RotateCcw className="w-7 h-7" /> NEXT SECTOR<span className="hidden md:inline">&nbsp;(SPACE)</span>
          </button>
          <button
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-full font-bold text-base transition-all flex items-center justify-center gap-2 text-gray-300"
            onClick={startGame}
          >
            <RotateCcw className="w-5 h-5" /> START NEW GAME
          </button>
        </div>
      </div>
    </div>
  );
}
