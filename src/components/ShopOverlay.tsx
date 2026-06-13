import { Map as MapIcon, Gift } from 'lucide-react';
import type { ComponentType } from 'react';
import { UPGRADE_DATA } from '../constants/upgrades';
import { SHIP_SKINS } from '../constants/skins';
import { GAME_CONFIG } from '../constants/gameConfig';
import { RELIC_DATA, CATEGORY_COLORS } from '../constants/relics';
import type { GameStateName } from './types';
import type { EmergencyBeaconState } from '../engine/state';

interface ShopOverlayProps {
  uiScrap: number;
  uiLevels: Record<string, number>;
  buyUpgrade: (key: string, cost: number) => void;
  setGameState: (state: GameStateName) => void;
  uiShipSkin: number;
  uiUnlockedSkins: boolean[];
  buySkin: (index: number) => void;
  uiEmergencyBeacon?: EmergencyBeaconState;
  buyBeacon: (cost: number) => void;
  activeBuff?: string | null;
  buyRelic: (id: string, cost: number) => void;
  uiRelics?: string[];
  uiRelicSlotLimit?: number;
}

export default function ShopOverlay({ uiScrap, uiLevels, buyUpgrade, setGameState, uiShipSkin, uiUnlockedSkins, buySkin, uiEmergencyBeacon, buyBeacon, activeBuff, buyRelic, uiRelics, uiRelicSlotLimit }: ShopOverlayProps) {
  const hasFreeWeapon = activeBuff === 'free_weapon';
  const ownedRelicIds = uiRelics || [];
  const slotLimit = uiRelicSlotLimit || 5;
  const upgradeData = UPGRADE_DATA as Record<string, {
    isConsumable?: boolean;
    baseCost: number;
    costMult: number;
    maxLevel: number;
    name: string;
    desc: string;
    icon: ComponentType<{ className?: string }>;
  }>;
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

        {/* Free weapon buff banner */}
        {hasFreeWeapon && (
          <div className="mb-6 p-4 rounded-xl border border-yellow-500/40 bg-yellow-950/40 flex items-center gap-3">
            <Gift className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div>
              <span className="text-yellow-300 font-bold">FREE WEAPON BONUS ACTIVE</span>
              <span className="text-yellow-200/70 text-sm ml-2">— Your next weapon upgrade is free!</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(upgradeData).map(([key, data]) => {
            // ── Consumable items (e.g. emergencyBeacon) ──
            if (data.isConsumable) {
              const eb = uiEmergencyBeacon || { purchased: false, activated: false, nodeId: null };
              const isPurchased = eb.purchased;
              const isActivated = eb.activated;
              const canAfford = uiScrap >= data.baseCost;

              return (
                <div key={key}
                  onClick={() => {
                    if (!isPurchased && canAfford) buyBeacon(data.baseCost);
                  }}
                  className={`relative p-5 rounded-xl border flex flex-col h-full transition-all duration-200
                    ${isActivated ? 'border-yellow-500/30 bg-yellow-900/10' :
                      isPurchased ? 'border-green-500/30 bg-green-900/10' :
                      canAfford ? 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/40 hover:scale-[1.02] cursor-pointer' :
                      'border-gray-700 bg-gray-800/40 opacity-75'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <data.icon className={`w-10 h-10 ${isActivated ? 'text-yellow-400' : isPurchased ? 'text-green-400' : 'text-blue-400'}`} />
                    <div className="text-xs font-mono bg-black/60 px-2 py-1 rounded text-gray-300 border border-gray-700">
                      {isActivated ? 'ACTIVE' : isPurchased ? 'READY' : 'NEW'}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-1 text-white">{data.name}</h3>
                  <p className="text-sm text-gray-400 mb-6 flex-grow">{data.desc}</p>
                  <div className="mt-auto pt-4 border-t border-gray-700/50">
                    {isActivated ? (
                      <div className="text-yellow-400 font-bold text-center tracking-widest">BEACON ACTIVE</div>
                    ) : isPurchased ? (
                      <div className="text-green-400 font-bold text-center tracking-widest">READY — [B] TO ACTIVATE</div>
                    ) : (
                      <div className={`font-bold text-xl text-center flex items-center justify-center gap-2 ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                        <div className="w-3 h-3 bg-current rounded-sm"></div> {data.baseCost}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

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

        {/* ─── Synergies Section ──────────────────────────────────────────── */}
        <div className="mt-10 border-t border-gray-700 pt-8">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 mb-2">WEAPON SYNERGIES</h2>
          <p className="text-gray-400 mb-6">Combine weapon levels to unlock powerful synergies.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(GAME_CONFIG.weaponSynergies).map(([id, synergy]) => {
              const reqs = (synergy as { requirements: Record<string, number>; name: string; description: string }).requirements;
              const levels = uiLevels || {};
              const isActive = Object.entries(reqs).every(([w, lvl]) => (levels[w] || 0) >= lvl);
              const reqText = Object.entries(reqs).map(([w, lvl]) => {
                const current = levels[w] || 0;
                const name = upgradeData[w]?.name || w;
                return `${name} ${current}/${lvl}`;
              }).join(', ');

              return (
                <div
                  key={id}
                  className={`relative p-5 rounded-xl border flex flex-col h-full transition-all duration-200
                    ${isActive
                      ? 'border-green-500/60 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                      : 'border-gray-700 bg-gray-800/40 opacity-70'
                    }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
                      ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700/50 text-gray-500'}`}>
                      ⚔
                    </div>
                    <div className={`text-xs font-mono px-2 py-1 rounded border
                      ${isActive
                        ? 'bg-green-900/50 text-green-300 border-green-700/50'
                        : 'bg-gray-800/50 text-gray-500 border-gray-700/50'
                      }`}>
                      {isActive ? 'ACTIVE' : 'LOCKED'}
                    </div>
                  </div>
                  <h3 className={`font-bold text-lg mb-1 ${isActive ? 'text-green-300' : 'text-gray-400'}`}>
                    {(synergy as { name: string }).name}
                  </h3>
                  <p className="text-sm text-gray-400 mb-4 flex-grow">{(synergy as { description: string }).description}</p>
                  <div className="mt-auto pt-3 border-t border-gray-700/50">
                    <div className={`text-xs font-mono ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
                      Requires: {reqText}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Relics Section ─────────────────────────────────────────── */}
        <div className="mt-10 border-t border-gray-700 pt-8">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-300 mb-2">RELICS</h2>
          <p className="text-gray-400 mb-6">Passive modifiers that persist across missions. Limited slots available.</p>

          {/* Relic slot indicator */}
          <div className="mb-4 text-sm text-gray-400">
            Slots: {ownedRelicIds.length}/{slotLimit} used
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {RELIC_DATA.filter(relic => !ownedRelicIds.includes(relic.id) && ownedRelicIds.length < slotLimit).map(relic => {
              const canAfford = uiScrap >= (relic.cost ?? 0);
              const color = CATEGORY_COLORS[relic.category as keyof typeof CATEGORY_COLORS] || '#888';

              return (
                <div
                  key={relic.id}
                  onClick={() => {
                    if (canAfford && ownedRelicIds.length < slotLimit) buyRelic(relic.id, relic.cost ?? 0);
                  }}
                  className={`relative p-5 rounded-xl border flex flex-col h-full transition-all duration-200
                    ${canAfford && ownedRelicIds.length < slotLimit
                      ? 'border-blue-500/50 bg-blue-900/20 hover:bg-blue-800/40 hover:scale-[1.02] cursor-pointer'
                      : 'border-gray-700 bg-gray-800/40 opacity-50'
                    }`}
                  style={{ borderColor: canAfford ? color : undefined }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-3xl">{relic.icon}</div>
                    <div className={`text-xs font-mono px-2 py-1 rounded border`}
                      style={{ backgroundColor: `${color}20`, color, borderColor: `${color}50` }}>
                      {relic.rarity.toUpperCase()}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-1 text-white">{relic.name}</h3>
                  <p className="text-sm text-gray-400 mb-4 flex-grow">{relic.description}</p>
                  <div className="mt-auto pt-3 border-t border-gray-700/50">
                    {ownedRelicIds.length >= slotLimit ? (
                      <div className="text-gray-500 font-bold text-center text-sm">NO SLOTS AVAILABLE</div>
                    ) : canAfford ? (
                      <div className="font-bold text-xl text-center flex items-center justify-center gap-2 text-yellow-400">
                        <div className="w-3 h-3 bg-current rounded-sm"></div> {relic.cost}
                      </div>
                    ) : (
                      <div className="font-bold text-xl text-center flex items-center justify-center gap-2 text-red-400">
                        <div className="w-3 h-3 bg-current rounded-sm"></div> {relic.cost}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {ownedRelicIds.length >= slotLimit && RELIC_DATA.every(r => ownedRelicIds.includes(r.id)) && (
              <div className="col-span-full text-center text-gray-500 py-8">All relics collected!</div>
            )}
          </div>
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
