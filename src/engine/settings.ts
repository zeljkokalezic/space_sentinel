/**
 * settings.ts — Persistent player settings helpers.
 */

const SETTINGS_KEY = 'space_sentinel_settings';

export type DifficultySetting = 'easy' | 'normal' | 'hard' | 'veteran';
export type ParticleQuality = 'low' | 'medium' | 'high';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface GameSettings {
  volume: number;
  sfxVolume: number;
  musicVolume: number;
  difficulty: DifficultySetting;
  showFPS: boolean;
  particlesQuality: ParticleQuality;
  screenShake: boolean;
  colorblindMode: ColorblindMode;
  reducedMotion: boolean;
  highContrast: boolean;
  showRadarLegend: boolean;
}

type SettingsInput = Partial<GameSettings> | null | undefined;

const DIFFICULTIES = new Set<DifficultySetting>(['easy', 'normal', 'hard', 'veteran']);
const PARTICLE_QUALITIES = new Set<ParticleQuality>(['low', 'medium', 'high']);
const COLORBLIND_MODES = new Set<ColorblindMode>([
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
]);

const clamp01 = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

export function getDefaultSettings(): GameSettings {
  return {
    volume: 0.5,
    sfxVolume: 0.7,
    musicVolume: 0.5,
    difficulty: 'normal',
    showFPS: false,
    particlesQuality: 'high',
    screenShake: true,
    colorblindMode: 'none',
    reducedMotion: false,
    highContrast: false,
    showRadarLegend: true,
  };
}

export function normalizeSettings(settings: SettingsInput | unknown): GameSettings {
  if (!settings || typeof settings !== 'object') return getDefaultSettings();
  const defaults = getDefaultSettings();
  if (!isRecord(settings)) return defaults;

  const difficulty = settings.difficulty;
  const particlesQuality = settings.particlesQuality;
  const colorblindMode = settings.colorblindMode;

  return {
    volume: clamp01(settings.volume, defaults.volume),
    sfxVolume: clamp01(settings.sfxVolume, defaults.sfxVolume),
    musicVolume: clamp01(settings.musicVolume, defaults.musicVolume),
    difficulty: typeof difficulty === 'string' && DIFFICULTIES.has(difficulty as DifficultySetting)
      ? difficulty as DifficultySetting
      : defaults.difficulty,
    showFPS: typeof settings.showFPS === 'boolean' ? settings.showFPS : defaults.showFPS,
    particlesQuality: typeof particlesQuality === 'string'
      && PARTICLE_QUALITIES.has(particlesQuality as ParticleQuality)
      ? particlesQuality as ParticleQuality
      : defaults.particlesQuality,
    screenShake: typeof settings.screenShake === 'boolean'
      ? settings.screenShake
      : defaults.screenShake,
    colorblindMode: typeof colorblindMode === 'string'
      && COLORBLIND_MODES.has(colorblindMode as ColorblindMode)
      ? colorblindMode as ColorblindMode
      : defaults.colorblindMode,
    reducedMotion: typeof settings.reducedMotion === 'boolean'
      ? settings.reducedMotion
      : defaults.reducedMotion,
    highContrast: typeof settings.highContrast === 'boolean'
      ? settings.highContrast
      : defaults.highContrast,
    showRadarLegend: typeof settings.showRadarLegend === 'boolean'
      ? settings.showRadarLegend
      : defaults.showRadarLegend,
  };
}

export function loadSettings(): GameSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') return normalizeSettings(parsed);
    }
  } catch {
    // localStorage unavailable or corrupted data
  }
  return getDefaultSettings();
}

export function saveSettings(settings: SettingsInput | unknown): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // localStorage unavailable
  }
}
