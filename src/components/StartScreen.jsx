import React from 'react';
import { Rocket, Play, Crosshair } from 'lucide-react';

export default function StartScreen({ startGame }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-50 backdrop-blur-md">
      <div className="relative mb-8">
        <Rocket className="w-24 h-24 text-blue-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
        <h1 className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-cyan-200 drop-shadow-lg text-center">SPACE SENTINEL</h1>
      </div>
      <p className="text-xl text-gray-300 mb-12 max-w-lg text-center leading-relaxed">
        You are the core. Defend yourself against endless waves. Gather scrap from fallen enemies to dynamically upgrade your ship systems. Survive.
      </p>
      <button 
        className="px-10 py-5 bg-blue-600 hover:bg-blue-500 rounded-full font-black text-2xl transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_50px_rgba(37,99,235,0.6)] hover:scale-105 flex items-center gap-3" 
        onClick={startGame}
      >
        <Play className="w-8 h-8 fill-current" /> INITIALIZE SEQUENCE (SPACE)
      </button>
      <div className="mt-12 text-gray-400 flex flex-wrap justify-center gap-8 font-mono bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-white border border-gray-600 px-2 rounded">W A S D</span> / <span className="text-white border border-gray-600 px-2 rounded">Drag</span> to Move
        </div>
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-yellow-400" /> Auto-Fire
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white border border-gray-600 px-2 py-1 rounded">SPACE</span> to Upgrade
        </div>
      </div>
    </div>
  );
}
