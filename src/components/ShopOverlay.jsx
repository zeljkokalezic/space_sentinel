import React from 'react';
import { Map as MapIcon } from 'lucide-react';
import { UPGRADE_DATA } from '../constants/upgrades';
import { SHIP_SKINS } from '../constants/skins';

export default function ShopOverlay({ uiScrap, uiLevels, buyUpgrade, setGameState, uiShipSkin, uiUnlockedSkins, buySkin }) {
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

        {/* ─── Ship Skins Section ─────────────────────────────────────────── */}
        <div className="mt-10 border-t border-gray-700 pt-8">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300 mb-2">SHIP SKINS</h2>
          <p className="text-gray-400 mb-6">Customize the look of your battleship. Visual only — no stat changes.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {SHIP_SKINS.map((skin, index) => {
              const isUnlocked = uiUnlockedSkins?.[index] ?? false;
              const isEquipped = uiShipSkin === index;
              const canAfford = uiScrap >= skin.cost;

              return (
                <div
                  key={skin.id}
                  onClick={() => {
                    if (isUnlocked) {
                      buySkin(index); // equip
                    } else if (canAfford) {
                      buySkin(index); // buy + equip
                    }
                  }}
                  className={`relative p-4 rounded-xl border flex flex-col items-center transition-all duration-200
                    ${isEquipped
                      ? 'border-purple-400 bg-purple-900/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : isUnlocked
                        ? 'border-gray-500/50 bg-gray-800/40 hover:bg-gray-700/50 hover:scale-[1.02] cursor-pointer'
                        : canAfford
                          ? 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/40 hover:scale-[1.02] cursor-pointer'
                          : 'border-gray-700 bg-gray-800/40 opacity-60'}`}
                >
                  {/* Color preview box */}
                  <div className="w-full aspect-square rounded-lg mb-3 flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, #111 0%, #1a1a2e 100%)` }}>
                    {/* Hull preview */}
                    <div className="w-8 h-12 rounded-sm" style={{ backgroundColor: '#' + skin.hullColor.toString(16).padStart(6, '0') }} />
                    {/* Accent glow */}
                    <div className="absolute inset-0 rounded-lg" style={{ boxShadow: `inset 0 0 20px ${'#' + skin.accentColor.toString(16).padStart(6, '0')}40` }} />
                    {/* Engine glow indicator */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full" style={{ backgroundColor: '#' + skin.engineGlow.toString(16).padStart(6, '0'), boxShadow: `0 0 8px ${'#' + skin.engineGlow.toString(16).padStart(6, '0')}` }} />
                  </div>

                  <h3 className="font-bold text-sm text-white text-center">{skin.name}</h3>

                  {/* Status badge */}
                  {isEquipped && (
                    <div className="mt-2 px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">EQUIPPED</div>
                  )}
                  {!isEquipped && isUnlocked && (
                    <div className="mt-2 px-3 py-1 bg-green-700 text-green-200 text-xs font-bold rounded-full">OWNED</div>
                  )}
                  {!isUnlocked && (
                    <div className={`mt-2 font-bold text-sm flex items-center gap-1 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                      <div className="w-2.5 h-2.5 bg-current rounded-sm"></div> {skin.cost}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
