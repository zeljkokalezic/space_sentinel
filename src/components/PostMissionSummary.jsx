/**
 * PostMissionSummary.jsx — Post-mission statistics overlay.
 *
 * Displays mission performance stats after completion, before transitioning
 * to the map screen. Shows enemies destroyed, scrap earned, time survived,
 * and a performance rating.
 *
 * Props:
 *   - game: Mutable game state ref
 *   - visible: Whether to show the overlay
 */
import React from 'react';

/**
 * Calculate performance rating based on mission stats.
 * @param {object} stats - Mission statistics
 * @returns {string} Rating letter (S, A, B, C, D)
 */
function calculateRating(stats) {
  const { enemiesDestroyed, totalTime, playerHpPercent, scrapEarned, missionType } = stats;
  
  let score = 0;
  
  // HP bonus (more HP remaining = better)
  score += playerHpPercent * 2;
  
  // Time bonus (faster completion = better for kill/collect missions)
  if (missionType === 'kill' || missionType === 'collect') {
    if (totalTime < 30) score += 30;
    else if (totalTime < 60) score += 20;
    else if (totalTime < 90) score += 10;
    else score += 5;
  }
  
  // Enemy destroy bonus
  score += Math.min(enemiesDestroyed * 2, 20);
  
  // Scrap bonus
  score += Math.min(scrapEarned / 10, 15);
  
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  if (score >= 40) return 'B';
  if (score >= 20) return 'C';
  return 'D';
}

/**
 * Format seconds to MM:SS display.
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PostMissionSummary({ game, visible }) {
  if (!visible || !game?.current) return null;
  const g = game.current;
  const stats = g.lastMissionSummary;
  if (!stats) return null;
  
  const rating = calculateRating(stats);
  
  // Rating color
  const ratingColors = {
    S: '#ffdd00',
    A: '#39ff14',
    B: '#00bfff',
    C: '#ffa500',
    D: '#ff4444',
  };
  
  // Mission type display name
  const missionNames = {
    kill: 'Kill Mission',
    collect: 'Scrap Collection',
    survive: 'Survival',
    escort: 'Escort',
    defend: 'Defense',
    sabotage: 'Sabotage',
    kill_boss: 'Boss Battle',
    kill_elite: 'Elite Hunt',
    kill_miniboss: 'Mini-Boss Battle',
  };
  
  const missionName = missionNames[stats.missionType] || 'Mission';
  
  return (
    <div className="post-mission-summary">
      <div className="post-mission-card">
        <h2 className="post-mission-title">MISSION COMPLETE</h2>
        <p className="post-mission-type">{missionName}</p>
        
        <div className="post-mission-rating">
          <span className="post-mission-rating-label">RATING</span>
          <span className="post-mission-rating-value" style={{ color: ratingColors[rating] }}>
            {rating}
          </span>
        </div>
        
        <div className="post-mission-stats">
          <div className="post-mission-stat">
            <span className="post-mission-stat-label">ENEMIES DESTROYED</span>
            <span className="post-mission-stat-value">{stats.enemiesDestroyed}</span>
          </div>
          <div className="post-mission-stat">
            <span className="post-mission-stat-label">TIME</span>
            <span className="post-mission-stat-value">{formatTime(stats.totalTime)}</span>
          </div>
          <div className="post-mission-stat">
            <span className="post-mission-stat-label">HP REMAINING</span>
            <span className="post-mission-stat-value">{Math.round(stats.playerHpPercent)}%</span>
          </div>
          <div className="post-mission-stat">
            <span className="post-mission-stat-label">SCRAP EARNED</span>
            <span className="post-mission-stat-value">+{stats.scrapEarned}</span>
          </div>
          <div className="post-mission-stat">
            <span className="post-mission-stat-label">LEVEL</span>
            <span className="post-mission-stat-value">{stats.level}</span>
          </div>
        </div>
        
        <div className="post-mission-transition">
          TRANSITIONING TO SECTOR MAP...
        </div>
      </div>
      
      <style>{`
        .post-mission-summary {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          animation: postMissionFadeIn 0.5s ease-in;
        }
        
        @keyframes postMissionFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .post-mission-card {
          background: rgba(0, 10, 0, 0.95);
          border: 2px solid #39ff14;
          border-radius: 8px;
          padding: 30px 40px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 0 30px rgba(57, 255, 20, 0.3);
          animation: postMissionSlideIn 0.5s ease-out;
        }
        
        @keyframes postMissionSlideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .post-mission-title {
          font-family: 'Share Tech Mono', monospace;
          font-size: 28px;
          color: #39ff14;
          text-align: center;
          margin: 0 0 10px 0;
          text-shadow: 0 0 10px rgba(57, 255, 20, 0.5);
        }
        
        .post-mission-type {
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          color: #00ff00;
          text-align: center;
          margin: 0 0 20px 0;
          opacity: 0.8;
        }
        
        .post-mission-rating {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 0;
          border-top: 1px solid rgba(57, 255, 20, 0.3);
          border-bottom: 1px solid rgba(57, 255, 20, 0.3);
          margin-bottom: 15px;
        }
        
        .post-mission-rating-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          color: #39ff14;
          opacity: 0.7;
        }
        
        .post-mission-rating-value {
          font-family: 'Share Tech Mono', monospace;
          font-size: 48px;
          font-weight: bold;
          text-shadow: 0 0 15px currentColor;
        }
        
        .post-mission-stats {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .post-mission-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .post-mission-stat-label {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #39ff14;
          opacity: 0.6;
        }
        
        .post-mission-stat-value {
          font-family: 'Share Tech Mono', monospace;
          font-size: 16px;
          color: #00ff00;
          font-weight: bold;
        }
        
        .post-mission-transition {
          font-family: 'Share Tech Mono', monospace;
          font-size: 12px;
          color: #39ff14;
          text-align: center;
          opacity: 0.5;
          animation: postMissionPulse 1.5s ease-in-out infinite;
        }
        
        @keyframes postMissionPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
