import { useRef } from 'react';
import { useInputEvent, type Wiimote } from '../../core';

/**
 * Shot power shared by golf, billiards and friends.
 * - Hold B and raise the remote (or drag the mouse down): the gauge fills with the backswing; swing
 *   forward or let go of B to shoot at that power.
 * - Press A: an oscillating meter starts; press A again to stop it where you want.
 * - A plain swing without B shoots with the swing strength.
 * The game reads `gauge.power` / `gauge.active` and calls `gauge.update(dt)` each frame.
 */
export interface Gauge {
  power: number;
  holding: boolean;
  meter: boolean;
  remote: Wiimote | null;
  t: number;
  meterSpeed: number;
  readonly active: boolean;
  update(dt: number): void;
}

export function createGauge(meterSpeed = 0.8): Gauge {
  return {
    power: 0,
    holding: false,
    meter: false,
    remote: null,
    t: 0,
    meterSpeed,
    get active() {
      return this.holding || this.meter;
    },
    update(dt: number) {
      if (this.meter) {
        this.t += dt * this.meterSpeed;
        this.power = (1 - Math.cos(this.t * Math.PI * 2)) / 2;
      }
    },
  };
}

interface Options {
  gauge: Gauge;
  /** Can a shot start right now? */
  enabled: () => boolean;
  /** Which remote may shoot (turn-based games). Default: anyone. */
  accept?: (remote: Wiimote) => boolean;
  onRelease: (power: number, remote: Wiimote) => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function usePowerGauge({ gauge, enabled, accept, onRelease }: Options): void {
  const hold = useRef<{ remote: Wiimote; beta0: number | null; y0: number } | null>(null);
  const fire = (power: number, remote: Wiimote) => {
    gauge.holding = false;
    gauge.meter = false;
    gauge.power = 0;
    hold.current = null;
    onRelease(clamp(power, 0.05, 1), remote);
  };
  const cancel = () => {
    gauge.holding = false;
    gauge.meter = false;
    gauge.power = 0;
    hold.current = null;
  };

  useInputEvent('buttondown', ({ remote, button }) => {
    if (accept && !accept(remote)) return;
    if (button === 'b') {
      if (!enabled() || gauge.active) return;
      hold.current = { remote, beta0: remote.orientation?.beta ?? null, y0: remote.pointer.y };
      gauge.holding = true;
      gauge.remote = remote;
      gauge.power = 0;
    } else if (button === 'a') {
      if (gauge.meter) fire(gauge.power, remote);
      else if (enabled() && !gauge.holding) {
        gauge.meter = true;
        gauge.remote = remote;
        gauge.power = 0;
        gauge.t = 0;
      }
    }
  });

  useInputEvent('buttonup', ({ remote, button }) => {
    if (button !== 'b' || !gauge.holding || hold.current?.remote !== remote) return;
    if (gauge.power > 0.08) fire(gauge.power, remote);
    else cancel();
  });

  // phone: the backswing is the pitch of the remote above its position when B was pressed
  useInputEvent('motion', ({ remote, sample }) => {
    const h = hold.current;
    if (!h || h.remote !== remote || !sample.orientation) return;
    if (h.beta0 === null) {
      h.beta0 = sample.orientation.beta;
      return;
    }
    gauge.power = clamp((sample.orientation.beta - h.beta0) / 55, 0, 1);
  });

  // mouse: drag down while holding the right button
  useInputEvent('pointer', ({ remote, pointer }) => {
    const h = hold.current;
    if (!h || h.remote !== remote || remote.kind !== 'local') return;
    gauge.power = clamp((pointer.y - h.y0) / 0.3, 0, 1);
  });

  useInputEvent('swing', ({ remote, swing }) => {
    if (accept && !accept(remote)) return;
    if (gauge.holding && hold.current?.remote === remote) fire(Math.max(gauge.power, swing.strength * 0.7), remote);
    else if (!gauge.meter && enabled()) fire(swing.strength, remote);
  });
}

/** Vertical power bar drawn on the canvas (x, y = top-left, in pixels). */
export function drawGauge(g: CanvasRenderingContext2D, gauge: Gauge, x: number, y: number, w: number, h: number, label = 'POWER'): void {
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.roundRect(x - w * 0.3, y - h * 0.08, w * 1.6, h * 1.16, w * 0.4);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.roundRect(x, y, w, h, w / 2);
  g.fill();
  const grad = g.createLinearGradient(0, y + h, 0, y);
  grad.addColorStop(0, '#69f0ae');
  grad.addColorStop(0.55, '#ffd740');
  grad.addColorStop(1, '#ff5252');
  g.fillStyle = grad;
  const ph = h * gauge.power;
  g.beginPath();
  g.roundRect(x, y + h - ph, w, ph, w / 2);
  g.fill();
  g.strokeStyle = '#fff';
  g.lineWidth = Math.max(1, w * 0.12);
  g.beginPath();
  g.roundRect(x, y, w, h, w / 2);
  g.stroke();
  g.fillStyle = '#fff';
  g.font = `800 ${w * 0.9}px Nunito, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(label, x + w / 2, y + h + w * 0.35);
  g.fillText(`${Math.round(gauge.power * 100)}%`, x + w / 2, y - w * 1.3);
  g.restore();
}
