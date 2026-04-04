import React from 'react';
import { Map as MapIcon } from 'lucide-react';
import { UPGRADE_DATA } from '../constants/upgrades';

export default function ShopOverlay({ uiScrap, uiLevels, buyUpgrade, setGameState }) {
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-40 backdrop-blur-sm">
      <div className="bg-gray-900/95 border border-blue-500/50 rounded-xl p-6 w-full max-w-5xl shadow-2xl shadow-blue-900/30 overflow-y-auto max-h-screen">
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-gray-700 pb-4">
          <div>
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">SYSTEM UPGRADES</h2>
            <p className="text-gray-400 mt-1">Upgrade your battleship systems to survive.</p>
          </div>
          <div className="text-3xl font-mono text-yellow-400 flex items-center gap-3 bg-black/50 px-6 py-3 rounded-lg border border-yellow-500/30">
            <div className="w-4 h-4 bg-yellow-400 rounded-sm shadow-[0_0_10px_#facc15]"></div> {uiScrap}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(UPGRADE_DATA).map(([key, data]) => {
            const currentLevel = uiLevels?.[key] || 0;
            const cost = Math.floor(data.baseCost * Math.pow(data.costMult, currentLevel));
            const isMax = currentLevel >= data.maxLevel;
            const canAfford = uiScrap >= cost;

            return (
              <div key={key}
                onClick={() => { if (!isMax && canAfford) buyUpgrade(key, cost); }}
                className={`relative p-5 rounded-xl border flex flex-col h-full transition-all duration-200 
                                    ${isMax ? 'border-green-500/30 bg-green-900/10' :
                    canAfford ? 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/40 hover:scale-[1.02] cursor-pointer' :
                      'border-gray-700 bg-gray-800/40 opacity-75'}`}>
                <div className="flex justify-between items-start mb-3">
                  <data.icon className={`w-10 h-10 ${isMax ? 'text-green-400' : 'text-blue-400'}`} />
                  <div className="text-xs font-mono bg-black/60 px-2 py-1 rounded text-gray-300 border border-gray-700">
                    LVL {currentLevel}/{data.maxLevel}
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-1 text-white">{data.name}</h3>
                <p className="text-sm text-gray-400 mb-6 flex-grow">{data.desc}</p>
                <div className="mt-auto pt-4 border-t border-gray-700/50">
                  {isMax ? (
                    <div className="text-green-400 font-bold text-center tracking-widest">MAXED OUT</div>
                  ) : (
                    <div className={`font-bold text-xl text-center flex items-center justify-center gap-2 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                      <div className="w-3 h-3 bg-current rounded-sm"></div> {cost}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-8 flex justify-center">
          <button className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] transition-transform hover:scale-105 flex items-center gap-3" onClick={() => setGameState('map')}>
            <MapIcon className="w-6 h-6 stroke-current" /> RETURN TO MAP<span className="hidden md:inline">&nbsp;(SPACE)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
