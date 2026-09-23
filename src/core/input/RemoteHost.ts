import { Peer } from 'peerjs';
import { Emitter } from '../events';
import { PEER_PREFIX, generateCode } from './messages';
import { peerOptions } from './peerConfig';
import { PhoneWiimote } from './PhoneWiimote';

export type HostStatus = 'idle' | 'starting' | 'ready' | 'offline' | 'error';

export interface HostState {
  status: HostStatus;
  code: string;
  error?: string;
}

type HostEvents = {
  status: HostState;
  connection: { remote: PhoneWiimote };
};

const STORAGE_KEY = 'freewii.code';

/** Console side of the phone link: owns the PeerJS peer and spawns a PhoneWiimote per phone. */
export class RemoteHost extends Emitter<HostEvents> {
  code = '';
  status: HostStatus = 'idle';
  error?: string;
  private peer: Peer | null = null;
  private idRetries = 0;
  private reconnectTimer: number | undefined;

  get state(): HostState {
    return { status: this.status, code: this.code, error: this.error };
  }

  /** Public URL the phone must open. */
  get remoteUrl(): string {
    return `${window.location.origin}/remote?c=${this.code}`;
  }

  start(): void {
    if (this.peer) return;
    this.code = sessionStorage.getItem(STORAGE_KEY) || generateCode();
    this.open();
  }

  stop(): void {
    window.clearTimeout(this.reconnectTimer);
    this.peer?.destroy();
    this.peer = null;
    this.setStatus('idle');
  }

  private setStatus(status: HostStatus, error?: string): void {
    this.status = status;
    this.error = error;
    this.emit('status', this.state);
  }

  private open(): void {
    this.setStatus('starting');
    const peer = new Peer(PEER_PREFIX + this.code, peerOptions());
    this.peer = peer;

    peer.on('open', () => {
      sessionStorage.setItem(STORAGE_KEY, this.code);
      this.idRetries = 0;
      this.setStatus('ready');
    });

    peer.on('connection', (conn) => {
      const spawn = () => {
        const remote = new PhoneWiimote(conn);
        // Wait for the phone's hello (carries its name) before announcing it, with a safety timeout.
        let announced = false;
        const announce = () => {
          if (announced || !remote.connected) return;
          announced = true;
          this.emit('connection', { remote });
        };
        remote.once('hello', announce);
        window.setTimeout(announce, 1500);
      };
      if (conn.open) spawn();
      else conn.on('open', spawn);
    });

    peer.on('error', (err: Error & { type?: string }) => {
      const type = err.type ?? 'unknown';
      if (type === 'unavailable-id' && this.idRetries < 6) {
        // Someone else holds that code (or a stale session): pick a new one.
        this.idRetries += 1;
        sessionStorage.removeItem(STORAGE_KEY);
        peer.destroy();
        this.peer = null;
        this.code = generateCode();
        this.open();
        return;
      }
      if (type === 'peer-unavailable') return; // not our problem on the host side
      console.warn('[freeWii] peer error', type, err.message);
      this.setStatus('error', `${type}: ${err.message}`);
      if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
        this.scheduleReconnect();
      }
    });

    peer.on('disconnected', () => {
      this.setStatus('offline');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      const peer = this.peer;
      if (!peer) return;
      if (peer.destroyed) {
        this.peer = null;
        this.open();
      } else if (peer.disconnected) {
        this.setStatus('starting');
        try {
          peer.reconnect();
        } catch {
          this.peer = null;
          this.open();
        }
      }
    }, 2500);
  }
}
