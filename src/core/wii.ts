import { getChannel } from '../channels';
import { MENU_MUSIC, audio } from './audio/AudioEngine';
import { SFX } from './audio/sfx';
import { hot } from './hot';
import { input } from './input/InputManager';
import { messageBoardApi, plantLetterBomb } from './messageBoard';
import { relock as relockAll, unlock, unlocks } from './unlocks';
import { settings, updateSettings, type Settings } from './settings';
import { createStore } from './store';

export type Screen = 'boot' | 'menu' | 'preview' | 'channel';
export type Panel = 'none' | 'options' | 'mail';

/** Rectangle expressed as fractions of the stage (0..1). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ConsoleState {
  screen: Screen;
  channelId: string | null;
  page: number;
  panel: Panel;
  homeMenu: boolean;
  zoomFrom: Rect | null;
  cursorVisible: boolean;
  toast: { id: number; text: string } | null;
}

/** Dev convenience: open the console with ?skipboot=1 to land directly on the Wii Menu. */
const SKIP_BOOT = new URLSearchParams(window.location.search).get('skipboot') === '1';

export const consoleStore = createStore<ConsoleState>({
  screen: SKIP_BOOT ? 'menu' : 'boot',
  channelId: null,
  page: 0,
  panel: 'none',
  homeMenu: false,
  zoomFrom: null,
  cursorVisible: true,
  toast: null,
});

let wired = false;
let toastTimer: number | undefined;
let toastSeq = 0;
const knownPhones = new Set<string>();

/** Optional sample overrides for the console sounds: public/assets/system/sfx/<name>.mp3 */
const SYSTEM_SFX = Object.fromEntries(Object.keys(SFX).map((name) => [name, `/assets/system/sfx/${name}.mp3`]));

function applySettings(s: Settings): void {
  audio.setVolume(s.volume);
  audio.setMusicEnabled(s.musicEnabled);
  audio.setSfxEnabled(s.sfxEnabled);
  input.setSensitivity(s.sensitivity);
  input.setLocalAsPlayer(s.localAsPlayer);
}

/** Starts input, audio wiring and the pointer router on the stage element. Returns a cleanup. */
export function bootConsole(stage: HTMLElement): () => void {
  input.start(stage, () => audio.unlock());
  // Debug handle for the browser console and end-to-end tests.
  (window as unknown as { freewii: unknown }).freewii = wii;
  hot.attach(stage, () => input.remotes);
  if (!wired) {
    wired = true;
    input.on('pointer', ({ remote }) => hot.update(remote));
    input.on('buttondown', ({ remote, button }) => hot.press(remote, button));
    input.on('remotes', ({ remotes }) => {
      const ids = new Set(remotes.filter((r) => r.kind === 'phone').map((r) => r.id));
      for (const id of ids) {
        if (!knownPhones.has(id)) {
          knownPhones.add(id);
          const r = remotes.find((x) => x.id === id);
          audio.play('connect');
          wii.showToast(`${r?.name ?? 'Wii Remote'} connected as Player ${r?.player ?? '?'}`);
        }
      }
      for (const id of Array.from(knownPhones)) {
        if (!ids.has(id)) {
          knownPhones.delete(id);
          audio.play('disconnect');
          wii.showToast('A Wii Remote disconnected');
        }
      }
      for (const r of remotes) hot.update(r);
    });
    applySettings(settings.get());
    settings.subscribe(() => applySettings(settings.get()));
    plantLetterBomb();
    void audio.registerSamples('system', SYSTEM_SFX);
    if (consoleStore.get().screen === 'menu') audio.playMusic(MENU_MUSIC);
  }
  const sweep = window.setInterval(() => hot.sweep(), 120);
  return () => {
    window.clearInterval(sweep);
    input.local.detach();
  };
}

export const wii = {
  input,
  audio,
  settings,
  updateSettings,
  messageBoard: messageBoardApi,
  store: consoleStore,
  unlocks,

  /** Reveals a channel declared with `secret: true`. Returns true the first time. */
  unlockChannel(channelId: string): boolean {
    const def = getChannel(channelId);
    if (!def || !unlock(channelId)) return false;
    audio.play('cheer');
    wii.showToast(`Secret channel unlocked: ${def.title}!`, 6000);
    return true;
  },

  /** Hides the secret channels again and re-plants the LetterBomb letter. */
  relock(): void {
    relockAll();
    plantLetterBomb();
  },

  showToast(text: string, ms = 4000): void {
    window.clearTimeout(toastTimer);
    const id = ++toastSeq;
    consoleStore.set({ toast: { id, text } });
    toastTimer = window.setTimeout(() => {
      if (consoleStore.get().toast?.id === id) consoleStore.set({ toast: null });
    }, ms);
  },

  /** Leave the boot screen. */
  finishBoot(): void {
    if (consoleStore.get().screen !== 'boot') return;
    audio.play('boot');
    consoleStore.set({ screen: 'menu', panel: 'none' });
    audio.playMusic(MENU_MUSIC);
  },

  goMenu(): void {
    consoleStore.set({ screen: 'menu', channelId: null, homeMenu: false, panel: 'none', zoomFrom: null, cursorVisible: true });
    audio.playMusic(MENU_MUSIC);
  },

  openPreview(channelId: string, from: Rect | null): void {
    audio.play('open');
    consoleStore.set({ screen: 'preview', channelId, zoomFrom: from, panel: 'none' });
    // Channel jingle while the banner is open (like the Wii): the menu theme keeps playing if the file is missing.
    const def = getChannel(channelId);
    if (def?.bannerMusic) audio.playMusic({ url: def.bannerMusic, synth: null, keepIfMissing: true, fade: 0.7 });
  },

  closePreview(): void {
    consoleStore.set({ screen: 'menu', channelId: null, zoomFrom: null });
    audio.playMusic(MENU_MUSIC);
  },

  startChannel(): void {
    const { channelId } = consoleStore.get();
    if (!channelId) return;
    audio.play('start');
    audio.stopMusic(0.4);
    consoleStore.set({ screen: 'channel', homeMenu: false, zoomFrom: null, cursorVisible: true });
  },

  exitChannel(): void {
    audio.play('back');
    wii.goMenu();
  },

  toggleHomeMenu(open?: boolean): void {
    const s = consoleStore.get();
    if (s.screen !== 'channel') return;
    const next = open ?? !s.homeMenu;
    if (next === s.homeMenu) return;
    audio.play(next ? 'home' : 'back');
    consoleStore.set({ homeMenu: next });
  },

  openPanel(panel: Panel): void {
    const s = consoleStore.get();
    if (s.screen !== 'menu') return;
    if (panel !== 'none') audio.play('open');
    else audio.play('back');
    consoleStore.set({ panel });
  },

  setPage(page: number, total: number): void {
    const clamped = Math.max(0, Math.min(total - 1, page));
    if (clamped === consoleStore.get().page) return;
    audio.play('page');
    consoleStore.set({ page: clamped });
  },

  setCursorVisible(visible: boolean): void {
    consoleStore.set({ cursorVisible: visible });
  },
};

export type Wii = typeof wii;
