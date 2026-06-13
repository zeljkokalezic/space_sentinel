import { useState } from 'react';
import { getStartingRelicOptions } from '../engine/relicSystem';
import { CATEGORY_COLORS } from '../constants/relics';

interface RelicChoiceProps {
  onSelect: (relicId: string) => void;
  onSkip: () => void;
}

export default function RelicChoice({ onSelect, onSkip }: RelicChoiceProps) {
  const [relics] = useState(() => getStartingRelicOptions());
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-50 backdrop-blur-lg">
      <div className="mb-12 text-center">
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-orange-400 drop-shadow-lg mb-4">
          CHOOSE YOUR RELIC
        </h1>
        <p className="text-gray-400 text-lg">Select one relic to carry into your run</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 max-w-4xl px-4">
        {relics.map((relic, idx) => {
          const color = CATEGORY_COLORS[relic.category as keyof typeof CATEGORY_COLORS] || '#888';
          return (
            <button
              key={relic.id}
              onClick={() => onSelect(relic.id)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="relative flex-1 p-6 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:-translate-y-2 text-left"
              style={{
                borderColor: color,
                backgroundColor: `${color}15`,
                boxShadow: hoveredIdx === idx ? `0 0 30px ${color}40` : 'none',
              }}
            >
              <div className="text-4xl mb-3">{relic.icon}</div>
              <div className="text-xl font-bold text-white mb-2">{relic.name}</div>
              <div className="text-sm mb-3" style={{ color }}>{relic.category.toUpperCase()}</div>
              <div className="text-gray-300 text-sm">{relic.description}</div>
              <div className="mt-4 text-xs text-gray-500 uppercase tracking-wider">
                {relic.rarity}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onSkip}
        className="mt-12 px-8 py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all"
      >
        Skip
      </button>
    </div>
  );
}
