import { createStore } from './store';

/** Channels declared with `secret: true` stay out of the Wii Menu until they are unlocked here. */
interface UnlockState {
  unlocked: string[];
}

const KEY = 'freewii.unlocks';

function load(): UnlockState {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<UnlockState>) : null;
    return { unlocked: Array.isArray(parsed?.unlocked) ? parsed.unlocked.filter((x): x is string => typeof x === 'string') : [] };
  } catch {
    return { unlocked: [] };
  }
}

function persist(state: UnlockState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: the unlock lives for this session only */
  }
}

export const unlocks = createStore<UnlockState>(load());

export function isUnlocked(id: string): boolean {
  return unlocks.get().unlocked.includes(id);
}

/** Returns true the first time a channel is unlocked. */
export function unlock(id: string): boolean {
  if (isUnlocked(id)) return false;
  const next = { unlocked: [...unlocks.get().unlocked, id] };
  unlocks.set(next);
  persist(next);
  return true;
}

/** Forget every unlock (hides the secret channels again). */
export function relock(): void {
  unlocks.set({ unlocked: [] });
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
