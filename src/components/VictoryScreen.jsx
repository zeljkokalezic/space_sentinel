import React from 'react';
import { Shield, RotateCcw } from 'lucide-react';

export default function VictoryScreen({ gameRef, startGame }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-cyan-950/90 text-white z-50 backdrop-blur-md">
      <Shield className="w-24 h-24 text-cyan-400 mx-auto mb-6 drop-shadow-[0_0_30px_rgba(34,211,238,0.8)]" />
      <h1 className="text-5xl md:text-7xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-500">SECTOR SECURED</h1>
      <p className="text-cyan-200 text-xl mb-10 tracking-widest font-mono">CORE DEFENDED SUCCESSFULLY</p>

      <div className="bg-black/50 p-8 rounded-2xl border border-cyan-900/50 mb-10 min-w-[350px]">
        <div className="flex justify-between items-center mb-4 text-2xl">
          <span className="text-gray-400">TIME TAKEN:</span>
          <span className="font-mono font-bold">{Math.floor(gameRef.current?.totalTime || 0)}s</span>
        </div>
        <div className="flex justify-between items-center text-2xl">
          <span className="text-gray-400">TOTAL SCRAP:</span>
          <span className="font-mono font-bold text-yellow-400 flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div> {gameRef.current?.totalScrapEarned || 0}
          </span>
        </div>
      </div>

      <button 
        className="px-10 py-5 bg-cyan-600 hover:bg-cyan-500 rounded-full font-black text-2xl transition-all shadow-[0_0_30px_rgba(8,145,178,0.4)] hover:shadow-[0_0_50px_rgba(8,145,178,0.6)] hover:scale-105 flex items-center gap-3" 
        onClick={startGame}
      >
        <RotateCcw className="w-8 h-8" /> RE-ENGAGE NEW SECTOR<span className="hidden md:inline">&nbsp;(SPACE)</span>
      </button>
    </div>
  );
}
