import { Emitter } from '../events';
import { aimFromEuler, clamp, normalize3, wrapAngle, type Aim } from './pointerMath';
import {
  WII_BUTTONS,
  ZERO3,
  type MotionSample,
  type Orientation,
  type PointerState,
  type Vec3,
  type WiiButton,
  type WiimoteEvents,
  type WiimoteKind,
} from './types';

const D2R = Math.PI / 180;
/** Horizontal angle (degrees) that spans the full screen width at sensitivity 1. */
const BASE_FOV_X = 42;
const BASE_FOV_Y = 26;
const SMOOTHING = 0.45;
const SWING_START = 9; // m/s²
const SWING_WINDOW_MS = 170;
const SWING_COOLDOWN_MS = 380;

/**
 * A Wii Remote as seen by the console and by the channels. Subclasses feed it with
 * sensor data (phone) or with mouse / keyboard input (local fallback).
 */
export class Wiimote extends Emitter<WiimoteEvents> {
  readonly id: string;
  readonly kind: WiimoteKind;
  name: string;
  player = 0;
  connected = true;
  /** Pointer sensitivity multiplier, 0.5 (slow) .. 2 (fast). */
  sensitivity = 1;
  lastActivity = 0;

  readonly buttons = WII_BUTTONS.reduce((acc, b) => ({ ...acc, [b]: false }), {} as Record<WiiButton, boolean>);
  pointer: PointerState = { x: 0.5, y: 0.5, onScreen: false, roll: 0 };
  orientation: Orientation | null = null;
  accel: Vec3 = { ...ZERO3 };
  accelG: Vec3 = { ...ZERO3 };
  rate: Vec3 = { ...ZERO3 };
  /** True once the pointer has been calibrated at least once (phones only). */
  hasAim = false;

  private calibration: Aim | null = null;
  private smoothX = 0.5;
  private smoothY = 0.5;
  private swing = { active: false, peak: 0, dir: { ...ZERO3 }, start: 0, last: 0 };

  constructor(id: string, kind: WiimoteKind, name = 'Wii Remote') {
    super();
    this.id = id;
    this.kind = kind;
    this.name = name;
  }

  isDown(button: WiiButton): boolean {
    return this.buttons[button];
  }

  /** Buttons currently held, in declaration order. */
  get heldButtons(): WiiButton[] {
    return WII_BUTTONS.filter((b) => this.buttons[b]);
  }

  setButton(button: WiiButton, down: boolean): void {
    if (this.buttons[button] === down) return;
    this.buttons[button] = down;
    this.lastActivity = performance.now();
    this.emit(down ? 'buttondown' : 'buttonup', { button });
  }

  /** Vibrate the remote (phones only). */
  rumble(_ms = 120): void {
    /* no-op by default */
  }

  /** Make the current direction the centre of the screen. */
  recenter(): void {
    this.calibration = null;
    this.emit('recenter', {});
  }

  setPlayer(player: number): void {
    if (this.player === player) return;
    this.player = player;
    this.emit('change', {});
  }

  setName(name: string): void {
    this.name = name;
    this.emit('change', {});
  }

  protected setPointer(x: number, y: number, onScreen: boolean, roll: number): void {
    this.pointer = { x, y, onScreen, roll };
    this.lastActivity = performance.now();
    this.emit('pointer', this.pointer);
  }

  /** Feed raw Euler angles from DeviceOrientation; computes the on-screen pointer. */
  protected feedOrientation(o: Orientation): void {
    this.orientation = o;
    const aim = aimFromEuler(o.alpha, o.beta, o.gamma);
    if (!this.calibration) {
      this.calibration = aim;
      this.smoothX = 0.5;
      this.smoothY = 0.5;
      this.hasAim = true;
    }
    const fovX = (BASE_FOV_X * D2R) / this.sensitivity;
    const fovY = (BASE_FOV_Y * D2R) / this.sensitivity;
    const dx = wrapAngle(aim.heading - this.calibration.heading);
    const dy = aim.pitch - this.calibration.pitch;
    const tx = 0.5 + dx / fovX;
    const ty = 0.5 - dy / fovY;
    this.smoothX += (tx - this.smoothX) * SMOOTHING;
    this.smoothY += (ty - this.smoothY) * SMOOTHING;
    const onScreen = tx > -0.2 && tx < 1.2 && ty > -0.2 && ty < 1.2;
    this.setPointer(clamp(this.smoothX, -0.05, 1.05), clamp(this.smoothY, -0.05, 1.05), onScreen, aim.roll);
  }

  protected feedMotion(sample: MotionSample): void {
    this.accel = sample.accel;
    this.accelG = sample.accelG;
    this.rate = sample.rate;
    this.emit('motion', sample);
    this.detectSwing(sample.accel);
  }

  private detectSwing(a: Vec3): void {
    const mag = Math.hypot(a.x, a.y, a.z);
    const now = performance.now();
    const s = this.swing;
    if (!s.active) {
      if (mag > SWING_START && now - s.last > SWING_COOLDOWN_MS) {
        s.active = true;
        s.peak = mag;
        s.dir = { ...a };
        s.start = now;
      }
      return;
    }
    if (mag > s.peak) {
      s.peak = mag;
      s.dir = { ...a };
    }
    if (now - s.start > SWING_WINDOW_MS) {
      s.active = false;
      s.last = now;
      this.emitSwing(s.peak, s.dir);
    }
  }

  protected emitSwing(peak: number, dir: Vec3): void {
    this.emit('swing', {
      strength: clamp((peak - 6) / 22, 0.08, 1),
      peak,
      direction: normalize3(dir),
      roll: this.pointer.roll,
    });
  }

  destroy(): void {
    if (!this.connected) return;
    this.connected = false;
    this.emit('disconnect', {});
    this.removeAllListeners();
  }
}
