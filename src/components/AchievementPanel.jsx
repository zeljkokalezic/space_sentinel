import { useState } from 'react';
import { ACHIEVEMENTS, getAchievementProgress } from '../engine/achievements';
import { Trophy, Award, Lock, ChevronLeft } from 'lucide-react';

const FILTERS = [
  { key: 'all', label: 'All', icon: Trophy },
  { key: 'unlocked', label: 'Unlocked', icon: Award },
  { key: 'in_progress', label: 'In Progress', icon: Lock },
  { key: 'locked', label: 'Locked', icon: Lock },
];

/**
 * Build a stats object safe for getAchievementProgress.
 * Handles the case where g.stats hasn't been created yet.
 */
function buildStats(g) {
  const s = g?.stats || {};
  return {
    enemiesDestroyed: s.enemiesDestroyed || 0,
    totalScrap: s.totalScrap || 0,
    surviveMissions: s.surviveMissions || 0,
    escortMissions: s.escortMissions || 0,
    defendMissions: s.defendMissions || 0,
    sabotageMissions: s.sabotageMissions || 0,
    bossesDefeated: s.bossesDefeated || 0,
    minibossesDefeated: s.minibossesDefeated || 0,
    upgradesMaxed: s.upgradesMaxed || 0,
    level: g?.level || 1,
  };
}

/**
 * Single achievement card.
 */
function AchievementCard({ achievement, unlocked, progress }) {
  const isUnlocked = unlocked;
  const isInProgress = !unlocked && progress > 0;
  const pct = Math.round(progress * 100);

  return (
    <div
      className={`relative p-4 rounded-xl border flex flex-col h-full transition-all duration-200
        ${isUnlocked
          ? 'border-yellow-500/60 bg-yellow-900/15 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
          : isInProgress
            ? 'border-blue-500/40 bg-blue-900/15'
            : 'border-gray-700/50 bg-gray-800/30 opacity-60'
        }`}
    >
      {/* Icon */}
      <div className="flex items-start justify-between mb-3">
        <span className={`text-3xl ${isUnlocked ? '' : 'grayscale'}`}>
          {achievement.icon}
        </span>
        {isUnlocked && (
          <Award className="w-5 h-5 text-yellow-400" />
        )}
      </div>

      {/* Title & description */}
      <h3 className={`font-bold text-base mb-1 ${isUnlocked ? 'text-yellow-300' : 'text-gray-200'}`}>
        {achievement.title}
      </h3>
      <p className="text-sm text-gray-400 mb-4 flex-grow">
        {achievement.description}
      </p>

      {/* Progress bar */}
      <div className="mt-auto">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{isUnlocked ? 'Unlocked' : isInProgress ? 'In Progress' : 'Locked'}</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isUnlocked
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-300'
                : isInProgress
                  ? 'bg-gradient-to-r from-blue-600 to-blue-400'
                  : 'bg-gray-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * AchievementPanel component.
 * Browseable collection of all achievements with filters and progress.
 *
 * @param {object} props
 * @param {object} props.game - Game ref
 * @param {function} props.onClose - Callback to close the panel
 */
export default function AchievementPanel({ game, onClose }) {
  const [filter, setFilter] = useState('all');

  // Re-read data on each render so progress is fresh
  const unlocked = game?.current?.achievements?.unlocked || new Set();
  const stats = buildStats(game?.current);
  const progressList = getAchievementProgress(unlocked, stats);

  const unlockedCount = progressList.filter(p => p.unlocked).length;

  // Apply filter
  const filtered = progressList.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return p.unlocked;
    if (filter === 'in_progress') return !p.unlocked && p.progress > 0;
    if (filter === 'locked') return !p.unlocked && p.progress === 0;
    return true;
  });

  return (
    <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gray-900/95 border border-yellow-500/30 rounded-xl p-6 w-full max-w-4xl shadow-2xl shadow-yellow-900/20 overflow-y-auto max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-gray-700 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-300">
                ACHIEVEMENTS
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {unlockedCount} / {ACHIEVEMENTS.length} Unlocked
              </p>
            </div>
          </div>
          <div className="text-xl font-mono text-yellow-400 flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg border border-yellow-500/30">
            <Trophy className="w-5 h-5" />
            {Math.round((unlockedCount / ACHIEVEMENTS.length) * 100)}%
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {FILTERS.map(f => {
            const Icon = f.icon;
            const isActive = filter === f.key;
            const count = f.key === 'all'
              ? ACHIEVEMENTS.length
              : f.key === 'unlocked'
                ? unlockedCount
                : f.key === 'in_progress'
                  ? progressList.filter(p => !p.unlocked && p.progress > 0).length
                  : progressList.filter(p => !p.unlocked && p.progress === 0).length;

            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all
                  ${isActive
                    ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/50'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-700/50 hover:text-gray-300'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {f.label}
                <span className={`ml-1 text-xs ${isActive ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Achievement grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <AchievementCard
                key={p.id}
                achievement={ACHIEVEMENTS.find(a => a.id === p.id)}
                unlocked={p.unlocked}
                progress={p.progress}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No achievements in this category</p>
            <p className="text-sm mt-1">
              {filter === 'locked'
                ? 'Keep playing to discover more!'
                : filter === 'unlocked'
                  ? 'Complete missions to unlock achievements'
                  : 'Complete missions to start making progress'
              }
            </p>
          </div>
        )}

        {/* Close button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg rounded-full transition-transform hover:scale-105"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
