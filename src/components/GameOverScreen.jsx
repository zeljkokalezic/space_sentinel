import React from 'react';
import { Heart, RotateCcw, Anchor } from 'lucide-react';

export default function GameOverScreen({ gameRef, startGame }) {
  const deathReason = gameRef.current?.deathReason;
  const isEscortLoss = deathReason === 'escort';

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center text-white z-50 backdrop-blur-md ${isEscortLoss ? 'bg-cyan-950/90' : 'bg-red-950/90'}`}>
      {isEscortLoss ? (
        <Anchor className="w-24 h-24 text-cyan-400 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]" />
      ) : (
        <Heart className="w-24 h-24 text-red-500 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
      )}
      <h1 className={`text-5xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text ${isEscortLoss ? 'bg-gradient-to-b from-cyan-300 to-cyan-600' : 'bg-gradient-to-b from-red-400 to-red-600'}`}>
        {isEscortLoss ? 'ESCORT LOST' : 'HULL BREACHED'}
      </h1>
      <p className={`text-xl mb-10 tracking-widest font-mono ${isEscortLoss ? 'text-cyan-300' : 'text-red-300'}`}>
        {isEscortLoss ? 'ALLIED SHIP DESTROYED' : 'SYSTEMS OFFLINE'}
      </p>

      <div className={`bg-black/50 p-8 rounded-2xl border mb-10 min-w-[350px] ${isEscortLoss ? 'border-cyan-900/50' : 'border-red-900/50'}`}>
        <div className="flex justify-between items-center mb-4 text-2xl">
          <span className="text-gray-400">SECTORS CLEARED:</span>
          <span className="font-mono font-bold">{gameRef.current?.level - 1 || 0}</span>
        </div>
        <div className="flex justify-between items-center text-2xl">
          <span className="text-gray-400">TOTAL SCRAP:</span>
          <span className="font-mono font-bold text-yellow-400 flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> {gameRef.current?.totalScrapEarned || 0}
          </span>
        </div>
      </div>

      <button
        className={`px-10 py-5 rounded-full font-black text-2xl transition-all hover:scale-105 flex items-center gap-3 ${isEscortLoss ? 'bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_50px_rgba(34,211,238,0.6)]' : 'bg-red-600 hover:bg-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)]'}`}
        onClick={startGame}
      >
        <RotateCcw className="w-8 h-8" /> REDEPLOY<span className="hidden md:inline">&nbsp;(SPACE)</span>
      </button>
    </div>
  );
}
