import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EVENTS_DATA } from '../constants/events';

export default function EventScreen({ gameRef, setGameState, setUiScrap, setUiLevels }) {
  const [eventData, setEventData] = useState(null);

  useEffect(() => {
    // Select a random event on mount
    const randomEvent = EVENTS_DATA[Math.floor(Math.random() * EVENTS_DATA.length)];
    setEventData(randomEvent);
  }, []);

  if (!eventData) return null;

  const handleChoice = (choice) => {
    // Execute the consequence
    if (choice.resolve) {
      choice.resolve(gameRef, setUiScrap, setUiLevels);
    }
    
    // Always sync React UI state
    setUiScrap(gameRef.current.scrap);
    setUiLevels({ ...gameRef.current.levels });

    // Check for death via event 
    if (gameRef.current.player.hp <= 0) {
      setGameState('gameover');
    } else {
      // Return to map normally
      setGameState('map');
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-50 backdrop-blur-lg">
      <div className="relative mb-6">
        <AlertTriangle className="w-20 h-20 text-purple-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)] animate-pulse" />
        <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-pink-300 drop-shadow-lg text-center">
          {eventData.title.toUpperCase()}
        </h1>
      </div>
      
      <div className="bg-gray-900/60 border border-purple-500/30 p-8 rounded-xl max-w-2xl mb-12 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
        <p className="text-xl text-gray-200 leading-relaxed text-center font-serif italic">
          "{eventData.text}"
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-2xl">
        {eventData.choices.map((choice, idx) => {
          const isAvailable = choice.condition ? choice.condition(gameRef) : true;
          
          return (
            <button
              key={idx}
              onClick={() => { if (isAvailable) handleChoice(choice); }}
              className={`w-full px-6 py-4 rounded-lg font-bold text-lg text-left transition-all border flex items-center gap-4
                ${isAvailable 
                  ? 'border-purple-600/50 bg-purple-900/20 hover:bg-purple-800/40 hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:-translate-y-1' 
                  : 'border-gray-800 bg-gray-900/50 text-gray-600 opacity-50 cursor-not-allowed'}`}
            >
              <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-purple-400 animate-pulse' : 'bg-gray-700'}`}></div>
              {choice.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
