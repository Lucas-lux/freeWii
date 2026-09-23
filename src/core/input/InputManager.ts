import { Emitter } from '../events';
import { LocalWiimote } from './LocalWiimote';
import type { PhoneWiimote } from './PhoneWiimote';
import { RemoteHost, type HostState } from './RemoteHost';
import type { MotionSample, PointerState, SwingEvent, WiiButton } from './types';
import type { Wiimote } from './Wiimote';

export type InputEvents = {
  /** A remote joined or left, or player numbers changed. */
  remotes: { remotes: Wiimote[] };
  buttondown: { remote: Wiimote; button: WiiButton };
  buttonup: { remote: Wiimote; button: WiiButton };
  pointer: { remote: Wiimote; pointer: PointerState };
  swing: { remote: Wiimote; swing: SwingEvent };
  motion: { remote: Wiimote; sample: MotionSample };
  host: HostState;
};

export const MAX_PLAYERS = 4;

/**
 * Owns every remote (phones + the local mouse/keyboard one) and re-emits their events
 * with the remote attached, so a channel can do `ctx.input.on('buttondown', ({ remote, button }) => ...)`.
 */
export class InputManager extends Emitter<InputEvents> {
  readonly local = new LocalWiimote();
  readonly host = new RemoteHost();
  readonly phones: PhoneWiimote[] = [];
  private localAsPlayer = true;
  private started = false;

  /** Every remote, phones first (join order), local mouse/keyboard last. */
  get remotes(): Wiimote[] {
    return [...this.phones, this.local];
  }

  /**
   * Remotes that count as players for channels. Phones come first, so `players[0]` becomes the
   * phone as soon as one connects. The local mouse/keyboard remote is appended when enabled
   * in the settings, and used as a fallback when no phone is connected.
   */
  get players(): Wiimote[] {
    if (this.localAsPlayer || this.phones.length === 0) return [...this.phones, this.local].slice(0, MAX_PLAYERS);
    return [...this.phones].slice(0, MAX_PLAYERS);
  }

  get hostState(): HostState {
    return this.host.state;
  }

  start(stage: HTMLElement, onGesture?: () => void): void {
    if (this.started) {
      this.local.attach(stage, onGesture);
      return;
    }
    this.started = true;
    this.local.attach(stage, onGesture);
    this.wire(this.local);
    this.host.on('connection', ({ remote }) => this.addPhone(remote));
    this.host.on('status', (s) => this.emit('host', s));
    this.host.start();
    this.renumber();
  }

  setLocalAsPlayer(enabled: boolean): void {
    this.localAsPlayer = enabled;
    this.renumber();
    this.emit('remotes', { remotes: this.remotes });
  }

  get isLocalAsPlayer(): boolean {
    return this.localAsPlayer;
  }

  setSensitivity(value: number): void {
    for (const r of this.remotes) r.sensitivity = value;
  }

  rumbleAll(ms = 120): void {
    for (const r of this.remotes) r.rumble(ms);
  }

  /** Remote whose pointer moved most recently and is on screen, if any. */
  get activeRemote(): Wiimote | null {
    let best: Wiimote | null = null;
    for (const r of this.remotes) {
      if (!r.pointer.onScreen) continue;
      if (!best || r.lastActivity > best.lastActivity) best = r;
    }
    return best;
  }

  /**
   * Drop a remote. A phone is told goodbye and disconnected (it can reconnect with the code);
   * the local mouse/keyboard remote cannot be dropped, it stops counting as a player instead.
   */
  remove(remote: Wiimote): void {
    if (remote === this.local) {
      this.setLocalAsPlayer(false);
      return;
    }
    remote.destroy();
  }

  private addPhone(remote: PhoneWiimote): void {
    if (this.phones.length >= MAX_PLAYERS) {
      remote.destroy();
      return;
    }
    this.phones.push(remote);
    this.wire(remote);
    remote.on('disconnect', () => {
      const i = this.phones.indexOf(remote);
      if (i >= 0) this.phones.splice(i, 1);
      this.renumber();
      this.emit('remotes', { remotes: this.remotes });
    });
    this.renumber();
    this.emit('remotes', { remotes: this.remotes });
    remote.rumble(200);
  }

  private renumber(): void {
    this.phones.forEach((p, i) => p.setPlayer(i + 1));
    this.local.setPlayer(this.phones.length + 1);
  }

  private wire(remote: Wiimote): void {
    remote.on('buttondown', ({ button }) => this.emit('buttondown', { remote, button }));
    remote.on('buttonup', ({ button }) => this.emit('buttonup', { remote, button }));
    remote.on('pointer', (pointer) => this.emit('pointer', { remote, pointer }));
    remote.on('swing', (swing) => this.emit('swing', { remote, swing }));
    remote.on('motion', (sample) => this.emit('motion', { remote, sample }));
    remote.on('change', () => this.emit('remotes', { remotes: this.remotes }));
  }
}

export const input = new InputManager();
