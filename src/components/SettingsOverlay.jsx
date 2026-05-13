/**
 * SettingsOverlay.jsx — In-game settings panel.
 *
 * Provides controls for audio, display, and gameplay options.
 * Settings persist in localStorage.
 */
import { useEffect, useState } from 'react';
import { SoundManager } from '../engine/audio';

/**
 * Load settings from localStorage.
 * @returns {object} Settings object
 */
function loadSettings() {
  try {
    const data = localStorage.getItem('space_sentinel_settings');
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return getDefaultSettings();
}

/**
 * Save settings to localStorage.
 * @param {object} settings
 */
function saveSettings(settings) {
  try {
    localStorage.setItem('space_sentinel_settings', JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Default settings.
 * @returns {object}
 */
function getDefaultSettings() {
  return {
    volume: 0.5,
    sfxVolume: 0.7,
    musicVolume: 0.5,
    difficulty: 'normal', // 'easy', 'normal', 'hard'
    showFPS: false,
    particlesQuality: 'high', // 'low', 'medium', 'high'
    screenShake: true,
    colorblindMode: 'none', // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
    reducedMotion: false,
    highContrast: false,
  };
}

/**
 * SettingsOverlay component.
 * @param {object} props
 * @param {object} props.gameRef - Ref to game state
 * @param {function} props.onClose - Called when settings is dismissed
 */
export default function SettingsOverlay({ gameRef, onClose }) {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    // Apply settings on mount
    SoundManager.setVolume(settings.volume);
    SoundManager.setMuted(settings.volume === 0);
    SoundManager.setSfxVolume(settings.sfxVolume ?? 0.7);
    SoundManager.setMusicVolume(settings.musicVolume ?? 0.5);
    if (gameRef?.current?.audio) {
      gameRef.current.audio.volume = settings.volume;
      gameRef.current.audio.muted = settings.volume === 0;
    }
  }, [gameRef, settings.musicVolume, settings.sfxVolume, settings.volume]);

  // Sync settings to game state when changed
  useEffect(() => {
    if (gameRef?.current) {
      gameRef.current.settings = { ...settings };
      if (gameRef.current.audio) {
        gameRef.current.audio.volume = settings.volume;
        gameRef.current.audio.muted = settings.volume === 0;
      }
    }
  }, [settings, gameRef]);

  const handleVolumeChange = (val) => {
    const next = { ...settings, volume: val };
    setSettings(next);
    saveSettings(next);
    SoundManager.setVolume(val);
    SoundManager.setMuted(val === 0);
  };

  const handleSfxVolumeChange = (val) => {
    const next = { ...settings, sfxVolume: val };
    setSettings(next);
    saveSettings(next);
    SoundManager.setSfxVolume(val);
  };

  const handleMusicVolumeChange = (val) => {
    const next = { ...settings, musicVolume: val };
    setSettings(next);
    saveSettings(next);
    SoundManager.setMusicVolume(val);
  };

  const handleDifficultyChange = (val) => {
    const next = { ...settings, difficulty: val };
    setSettings(next);
    saveSettings(next);
  };

  const handleToggle = (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings(next);
  };

  const handleColorblindMode = (val) => {
    const next = { ...settings, colorblindMode: val };
    setSettings(next);
    saveSettings(next);
  };

  const handleParticlesQuality = (val) => {
    const next = { ...settings, particlesQuality: val };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
    }}>
      <div style={{
        background: 'rgba(10, 10, 20, 0.98)',
        border: '1px solid rgba(57, 255, 20, 0.3)',
        borderRadius: '12px',
        padding: '24px 32px',
        minWidth: '380px',
        maxWidth: '450px',
        boxShadow: '0 0 40px rgba(57, 255, 20, 0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(57, 255, 20, 0.2)',
        }}>
          <h2 style={{
            color: '#39ff14',
            fontSize: '20px',
            fontWeight: 'bold',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              fontSize: '18px',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Audio Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Audio
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              Master Volume: {Math.round(settings.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              SFX Volume: {Math.round(settings.sfxVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.sfxVolume}
              onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
              Music Volume: {Math.round(settings.musicVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.musicVolume}
              onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Gameplay Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Gameplay
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
              Difficulty
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['easy', 'normal', 'hard'].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDifficultyChange(d)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    background: settings.difficulty === d ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${settings.difficulty === d ? '#39ff14' : 'rgba(255, 255, 255, 0.2)'}`,
                    color: settings.difficulty === d ? '#39ff14' : '#ffffff',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Display Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Display
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
              Particle Quality
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['low', 'medium', 'high'].map((q) => (
                <button
                  key={q}
                  onClick={() => handleParticlesQuality(q)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    background: settings.particlesQuality === q ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${settings.particlesQuality === q ? '#39ff14' : 'rgba(255, 255, 255, 0.2)'}`,
                    color: settings.particlesQuality === q ? '#39ff14' : '#ffffff',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.showFPS}
                onChange={() => handleToggle('showFPS')}
                style={{ marginRight: '8px' }}
              />
              Show FPS Counter
            </label>
          </div>

          <div>
            <label style={{ color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.screenShake}
                onChange={() => handleToggle('screenShake')}
                style={{ marginRight: '8px' }}
              />
              Screen Shake
            </label>
          </div>
        </div>

        {/* Accessibility Section */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Accessibility
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: '#fff', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
              Colorblind Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['none', 'protanopia', 'deuteranopia', 'tritanopia'].map((m) => (
                <button
                  key={m}
                  onClick={() => handleColorblindMode(m)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    background: settings.colorblindMode === m ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${settings.colorblindMode === m ? '#39ff14' : 'rgba(255, 255, 255, 0.2)'}`,
                    color: settings.colorblindMode === m ? '#39ff14' : '#ffffff',
                    fontSize: '10px',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <label style={{ color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={() => handleToggle('reducedMotion')}
                style={{ marginRight: '8px' }}
              />
              Reduced Motion
            </label>
          </div>

          <div>
            <label style={{ color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={() => handleToggle('highContrast')}
                style={{ marginRight: '8px' }}
              />
              High Contrast
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          paddingTop: '16px',
          borderTop: '1px solid rgba(57, 255, 20, 0.1)',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(57, 255, 20, 0.15)',
              border: '1px solid rgba(57, 255, 20, 0.4)',
              color: '#39ff14',
              padding: '10px 32px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
