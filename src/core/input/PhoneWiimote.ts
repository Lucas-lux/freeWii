import type { DataConnection } from 'peerjs';
import { PROTOCOL_VERSION, type ConsoleToRemote, type RemoteToConsole, type Triple } from './messages';
import { BUTTON_BIT, WII_BUTTONS, ZERO3, type Vec3 } from './types';
import { Wiimote } from './Wiimote';

function vec(t: Triple | null): Vec3 {
  return t ? { x: t[0] || 0, y: t[1] || 0, z: t[2] || 0 } : { ...ZERO3 };
}

/** A phone connected through WebRTC, driving a Wiimote. */
export class PhoneWiimote extends Wiimote {
  readonly conn: DataConnection;
  latencyMs = 0;
  private pingTimer: number | undefined;

  constructor(conn: DataConnection) {
    super(`phone:${conn.peer}`, 'phone', 'Wii Remote');
    this.conn = conn;
    conn.on('data', (data) => this.handle(data as RemoteToConsole));
    conn.on('close', () => this.destroy());
    conn.on('error', (err) => {
      console.warn('[freeWii] remote connection error', err);
      this.destroy();
    });
    this.pingTimer = window.setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 5000);
  }

  private handle(msg: RemoteToConsole): void {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'hello':
        if (msg.name) this.setName(msg.name.slice(0, 24));
        this.send({ t: 'welcome', v: PROTOCOL_VERSION, player: this.player, console: 'freeWii' });
        this.emit('hello', {});
        break;
      case 's': {
        if (msg.o) this.feedOrientation({ alpha: msg.o[0], beta: msg.o[1], gamma: msg.o[2] });
        this.feedMotion({
          accel: vec(msg.a),
          accelG: vec(msg.g),
          rate: vec(msg.r),
          orientation: this.orientation,
          ts: msg.ts,
        });
        // Buttons are also sent as discrete events; the mask heals any lost event.
        for (const b of WII_BUTTONS) {
          const down = (msg.b & BUTTON_BIT[b]) !== 0;
          if (down !== this.buttons[b]) this.setButton(b, down);
        }
        break;
      }
      case 'btn':
        this.setButton(msg.k, msg.d === 1);
        break;
      case 'center':
        this.recenter();
        break;
      case 'pong':
        this.latencyMs = Math.round(performance.now() - msg.ts);
        break;
    }
  }

  send(msg: ConsoleToRemote): void {
    if (this.conn.open) {
      try {
        this.conn.send(msg);
      } catch (err) {
        console.warn('[freeWii] send failed', err);
      }
    }
  }

  override rumble(ms = 120): void {
    this.send({ t: 'rumble', ms });
  }

  override setPlayer(player: number): void {
    super.setPlayer(player);
    this.send({ t: 'player', player });
  }

  override destroy(): void {
    if (!this.connected) return;
    window.clearInterval(this.pingTimer);
    this.send({ t: 'bye' });
    try {
      this.conn.close();
    } catch {
      /* ignore */
    }
    super.destroy();
  }
}
