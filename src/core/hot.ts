import { audio, type SfxName } from './audio/AudioEngine';
import type { WiiButton } from './input/types';
import type { Wiimote } from './input/Wiimote';

/** Handlers attached to a "hot" element: something the Wii hand cursor can hover and click. */
export interface HotHandlers {
  onClick?: (remote: Wiimote, button: WiiButton) => void;
  onEnter?: (remote: Wiimote) => void;
  onLeave?: (remote: Wiimote) => void;
  /** Buttons that trigger onClick. Default: ['a']. */
  buttons?: WiiButton[];
  /** Sound played when the cursor enters. Default 'hover', null to mute. */
  hoverSound?: SfxName | null;
  /** Sound played on click. Default 'select', null to mute. */
  clickSound?: SfxName | null;
  disabled?: boolean;
}

interface Entry {
  el: HTMLElement;
  get: () => HotHandlers;
  setHovered: (hovered: boolean) => void;
  hovering: Set<string>;
}

/**
 * Routes the virtual pointers (phones, mouse) to DOM elements: hover state, hover sounds
 * and A-button clicks. Elements register through `useHot()`.
 */
class HotRegistry {
  private entries = new Map<string, Entry>();
  private byRemote = new Map<string, string | null>();
  private seq = 0;
  private stage: HTMLElement | null = null;
  private getRemotes: () => Wiimote[] = () => [];

  attach(stage: HTMLElement, getRemotes: () => Wiimote[]): void {
    this.stage = stage;
    this.getRemotes = getRemotes;
  }

  register(el: HTMLElement, get: () => HotHandlers, setHovered: (v: boolean) => void): () => void {
    const id = `h${++this.seq}`;
    el.dataset.hot = id;
    this.entries.set(id, { el, get, setHovered, hovering: new Set() });
    return () => {
      const e = this.entries.get(id);
      this.entries.delete(id);
      delete el.dataset.hot;
      if (e) for (const rid of e.hovering) this.byRemote.set(rid, null);
    };
  }

  private hitTest(remote: Wiimote): string | null {
    const p = remote.pointer;
    if (!p.onScreen || !this.stage) return null;
    const r = this.stage.getBoundingClientRect();
    const x = r.left + p.x * r.width;
    const y = r.top + p.y * r.height;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
    const el = document.elementFromPoint(x, y);
    const hotEl = el?.closest<HTMLElement>('[data-hot]');
    const id = hotEl?.dataset.hot ?? null;
    if (!id) return null;
    const entry = this.entries.get(id);
    if (!entry || entry.get().disabled) return null;
    return id;
  }

  /** Re-evaluate what a remote is pointing at. Called on every pointer move and periodically. */
  update(remote: Wiimote): void {
    const id = this.hitTest(remote);
    const prev = this.byRemote.get(remote.id) ?? null;
    if (prev === id) return;
    this.byRemote.set(remote.id, id);
    if (prev) {
      const e = this.entries.get(prev);
      if (e) {
        e.hovering.delete(remote.id);
        if (e.hovering.size === 0) e.setHovered(false);
        e.get().onLeave?.(remote);
      }
    }
    if (id) {
      const e = this.entries.get(id);
      if (e) {
        const first = e.hovering.size === 0;
        e.hovering.add(remote.id);
        const h = e.get();
        if (first) {
          e.setHovered(true);
          audio.play(h.hoverSound === undefined ? 'hover' : h.hoverSound);
        }
        h.onEnter?.(remote);
      }
    }
  }

  /** Dispatch a button press to whatever the remote hovers. Returns true when consumed. */
  press(remote: Wiimote, button: WiiButton): boolean {
    this.update(remote);
    const id = this.byRemote.get(remote.id);
    if (!id) return false;
    const e = this.entries.get(id);
    if (!e) return false;
    const h = e.get();
    const buttons = h.buttons ?? ['a'];
    if (h.disabled || !buttons.includes(button)) return false;
    audio.play(h.clickSound === undefined ? 'select' : h.clickSound);
    remote.rumble(60);
    h.onClick?.(remote, button);
    return true;
  }

  /** Re-check every remote; handles elements that move or appear under a still cursor. */
  sweep(): void {
    for (const r of this.getRemotes()) this.update(r);
  }

  forget(remote: Wiimote): void {
    const id = this.byRemote.get(remote.id);
    if (id) {
      const e = this.entries.get(id);
      if (e) {
        e.hovering.delete(remote.id);
        if (e.hovering.size === 0) e.setHovered(false);
      }
    }
    this.byRemote.delete(remote.id);
  }
}

export const hot = new HotRegistry();
