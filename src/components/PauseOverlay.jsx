import React, { useState } from 'react';
import { SoundManager } from '../engine/audio';
import SettingsOverlay from './SettingsOverlay';

export default function PauseOverlay({ gameRef, startGame, setPaused }) {
  const [showSettings, setShowSettings] = useState(false);
  const handleResume = () => {
    if (gameRef.current) {
      gameRef.current.paused = false;
    }
    setPaused(false);
    SoundManager.resume();
  };

  const handleRestart = () => {
    if (gameRef.current) {
      gameRef.current.paused = false;
    }
    startGame();
  };

  const handleToggleMute = () => {
    if (gameRef.current?.audio) {
      const nextMuted = !gameRef.current.audio.muted;
      gameRef.current.audio.muted = nextMuted;
      SoundManager.setMuted(nextMuted);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-cyan-500/30 bg-[#0a0a14]/90">
        <h2 className="text-3xl font-bold text-cyan-400 tracking-widest">PAUSED</h2>
        <div className="flex flex-col gap-3 w-full min-w-[200px] mt-4">
          <button
            onClick={handleResume}
            className="px-6 py-3 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 transition-colors font-medium"
          >
            Resume
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="px-6 py-3 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-colors font-medium"
          >
            Settings
          </button>
          <button
            onClick={handleRestart}
            className="px-6 py-3 rounded-lg bg-yellow-600/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30 transition-colors font-medium"
          >
            Restart
          </button>
          <button
            onClick={handleToggleMute}
            className="px-6 py-3 rounded-lg bg-gray-600/20 border border-gray-500/40 text-gray-300 hover:bg-gray-500/30 transition-colors font-medium"
          >
            {gameRef.current?.audio?.muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>
      {showSettings && <SettingsOverlay gameRef={gameRef} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
