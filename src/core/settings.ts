import { createStore } from './store';

export interface Settings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  /** 0..1 */
  volume: number;
  /** Pointer sensitivity multiplier, 0.5..2 */
  sensitivity: number;
  /** Count the mouse/keyboard as a player alongside phones. */
  localAsPlayer: boolean;
  /** Show the "connect your phone" tip on first boot. */
  showHints: boolean;
  /** Player name shown on the phones' welcome. */
  consoleName: string;
}

const KEY = 'freewii.settings';

export const DEFAULT_SETTINGS: Settings = {
  musicEnabled: true,
  sfxEnabled: true,
  volume: 0.8,
  sensitivity: 1,
  localAsPlayer: true,
  showHints: true,
  consoleName: 'freeWii',
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings = createStore<Settings>(load());

export function updateSettings(patch: Partial<Settings>): void {
  settings.set(patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.get()));
  } catch {
    /* storage unavailable (private mode): keep in memory */
  }
}
