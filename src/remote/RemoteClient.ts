import { Peer, type DataConnection } from 'peerjs';
import { Emitter } from '../core/events';
import { PEER_PREFIX, PROTOCOL_VERSION, type ConsoleToRemote, type RemoteToConsole } from '../core/input/messages';
import { peerOptions } from '../core/input/peerConfig';
import type { WiiButton } from '../core/input/types';
import type { Sensors } from './sensors';

export type ClientStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export interface ClientState {
  status: ClientStatus;
  message?: string;
}

type ClientEvents = {
  status: ClientState;
  player: { player: number };
  rumble: { ms: number };
};

/** Phone side of the link: dials the console peer and streams sensors + buttons. */
export class RemoteClient extends Emitter<ClientEvents> {
  status: ClientStatus = 'idle';
  player = 0;
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private timeout: number | undefined;

  connect(code: string, name: string): void {
    this.disconnect();
    this.setStatus('connecting');
    const peer = new Peer(peerOptions());
    this.peer = peer;
    peer.on('open', () => this.dial(code, name));
    peer.on('error', (err: Error & { type?: string }) => {
      const type = err.type ?? 'unknown';
      if (type === 'peer-unavailable') {
        this.setStatus('error', 'Console not found. Check the code and make sure the console page is open.');
      } else if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
        this.setStatus('error', 'Cannot reach the signaling server. Check your internet connection.');
      } else if (type === 'browser-incompatible') {
        this.setStatus('error', 'This browser does not support WebRTC.');
      } else {
        this.setStatus('error', `${type}: ${err.message}`);
      }
    });
  }

  private dial(code: string, name: string): void {
    const peer = this.peer;
    if (!peer) return;
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json', metadata: { name } });
    this.conn = conn;
    this.timeout = window.setTimeout(() => {
      if (this.status === 'connecting') this.setStatus('error', 'No answer from the console. Are both devices online?');
    }, 15000);
    conn.on('open', () => {
      window.clearTimeout(this.timeout);
      this.setStatus('connected');
      this.send({ t: 'hello', v: PROTOCOL_VERSION, name, ua: navigator.userAgent.slice(0, 80) });
    });
    conn.on('data', (data) => this.handle(data as ConsoleToRemote));
    conn.on('close', () => {
      if (this.status === 'connected') this.setStatus('closed', 'Disconnected from the console.');
    });
    conn.on('error', (err) => this.setStatus('error', String(err)));
  }

  private handle(msg: ConsoleToRemote): void {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'welcome':
      case 'player':
        this.player = msg.player;
        this.emit('player', { player: msg.player });
        break;
      case 'rumble':
        this.emit('rumble', { ms: msg.ms });
        break;
      case 'ping':
        this.send({ t: 'pong', ts: msg.ts });
        break;
      case 'bye':
        this.setStatus('closed', 'The console removed this remote. Tap Connect to join again.');
        break;
    }
  }

  private setStatus(status: ClientStatus, message?: string): void {
    this.status = status;
    this.emit('status', { status, message });
  }

  send(msg: RemoteToConsole): void {
    const conn = this.conn;
    if (!conn || !conn.open) return;
    try {
      conn.send(msg);
    } catch {
      /* dropped */
    }
  }

  sendState(mask: number, sensors: Sensors): void {
    this.send({ t: 's', b: mask, o: sensors.orientation, a: sensors.accel, g: sensors.accelG, r: sensors.rate, ts: performance.now() });
  }

  sendButton(k: WiiButton, down: boolean): void {
    this.send({ t: 'btn', k, d: down ? 1 : 0 });
  }

  recenter(): void {
    this.send({ t: 'center' });
  }

  disconnect(): void {
    window.clearTimeout(this.timeout);
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
    if (this.status !== 'idle') this.setStatus('idle');
  }
}
