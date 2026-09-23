import { clamp } from '../../core';

/** Lane geometry in metres (real bowling dimensions, so the pin action feels right). */
export const LANE_HALF = 0.525;
export const LANE_LENGTH = 18.3; // foul line to head pin
export const LANE_END = 19.4;
export const BALL_R = 0.108;
export const PIN_R = 0.06;
export const PIN_H = 0.38;
/** Camera position at rest (metres from the foul line, on the approach behind the bowler). */
export const CAM_REST = -10;
/** Where the camera parks to watch the pin action. */
export const CAM_MAX = LANE_LENGTH - 6;
const PIN_ROW_Z = 0.264;
const PIN_COL_X = 0.1525;
const RESULT_SECONDS = 2.1;
const INTRO_SECONDS = 1.7;
const SWEEP_SECONDS = 1.5;
const THROW_SECONDS = 0.34;

export interface Pin {
  x: number;
  z: number;
  vx: number;
  vz: number;
  up: boolean;
  /** 0 standing .. 1 lying down (animation). */
  tilt: number;
  tiltDir: number;
  gone: boolean;
}

export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Lateral acceleration (m/s²) produced by the spin. */
  hook: number;
  gutter: boolean;
  active: boolean;
}

/** Screen-space confetti (0..1 coordinates). */
export interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
}

export type Phase = 'intro' | 'aim' | 'hold' | 'throw' | 'rolling' | 'settle' | 'result' | 'sweep' | 'over';
export type BowlerPose = 'idle' | 'hold' | 'back' | 'swing' | 'release' | 'cheer' | 'sad';

export interface PlayerScore {
  name: string;
  frames: number[][];
}

export type BowlingEvent =
  | 'intro'
  | 'throw'
  | 'roll'
  | 'crash'
  | 'gutter'
  | 'strike'
  | 'spare'
  | 'cheer'
  | 'aww'
  | 'sweep'
  | 'over';

const CONFETTI_COLORS = ['#ff5252', '#ffd740', '#40c4ff', '#69f0ae', '#ea80fc', '#ff9100', '#ffffff'];

/**
 * Rules, physics and presentation state of a ten-pin game (arm swing, camera, pinsetter,
 * confetti). Rendering lives in bowlingRender.ts.
 */
export class BowlingGame {
  phase: Phase = 'intro';
  players: PlayerScore[];
  current = 0;
  frame = 0;
  pins: Pin[] = [];
  ball: Ball = { x: 0, z: 0, vx: 0, vz: 0, hook: 0, gutter: false, active: false };
  aimX = 0;
  aimAngle = 0;
  message = '';
  /** Arm position: -1 fully back, 0 hanging, 1 fully forward. */
  arm = 0;
  /** Camera position along the lane (metres from the foul line). */
  camZ = CAM_REST;
  /** 0..1 progress of the pinsetter sweep animation. */
  sweepT = 0;
  confetti: Confetti[] = [];
  /** Sound cues produced since the last drain. */
  events: BowlingEvent[] = [];
  /** Set when the scoreboard should re-render. */
  hudDirty = true;
  private armInput = 0;
  private timer = 0;
  private pinsUpAtStart = 10;
  private crashed = false;
  private pendingBall: Ball | null = null;
  private pendingDone = false;
  private pendingReset = false;
  private pendingSweep = false;
  private sweepApplied = false;
  private mood: BowlerPose | null = null;

  constructor(names: string[]) {
    this.players = names.map((name) => ({ name, frames: [] }));
    this.resetPins();
    this.events.push('intro');
  }

  get player(): PlayerScore {
    return this.players[this.current];
  }

  get standing(): number {
    return this.pins.filter((p) => p.up && !p.gone).length;
  }

  /** Which sprite / procedural pose to draw for the bowler. */
  get pose(): BowlerPose {
    switch (this.phase) {
      case 'hold':
        return this.arm < -0.45 ? 'back' : this.arm > 0.25 ? 'swing' : 'hold';
      case 'throw':
        return this.arm > 0.6 ? 'release' : 'swing';
      case 'rolling':
      case 'settle':
        return 'release';
      case 'result':
      case 'sweep':
        return this.mood ?? 'idle';
      default:
        return 'idle';
    }
  }

  get isGameOver(): boolean {
    return this.phase === 'over';
  }

  resetPins(): void {
    this.pins = [];
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        this.pins.push({
          x: (i - row / 2) * 2 * PIN_COL_X,
          z: LANE_LENGTH + row * PIN_ROW_Z,
          vx: 0,
          vz: 0,
          up: true,
          tilt: 0,
          tiltDir: 1,
          gone: false,
        });
      }
    }
  }

  private sweepFallen(): void {
    for (const p of this.pins) if (!p.up) p.gone = true;
  }

  moveAim(dx: number): void {
    if (this.phase === 'aim' || this.phase === 'hold') this.aimX = clamp(this.aimX + dx, -0.4, 0.4);
  }

  rotateAim(deg: number): void {
    if (this.phase === 'aim' || this.phase === 'hold') this.aimAngle = clamp(this.aimAngle + deg, -8, 8);
  }

  /** B pressed: the bowler lifts the ball and waits for the swing. */
  startHold(): void {
    if (this.phase !== 'aim') return;
    this.phase = 'hold';
    this.armInput = 0;
    this.message = '';
    this.hudDirty = true;
  }

  /** Arm position requested by the input device while holding, -1 (back) .. 1 (forward). */
  setArm(value: number): void {
    if (this.phase === 'hold') this.armInput = clamp(value, -1, 1);
  }

  /** B released without a swing: back to aiming. */
  cancelHold(): void {
    if (this.phase !== 'hold') return;
    this.phase = 'aim';
    this.armInput = 0;
    this.hudDirty = true;
  }

  /** The swing was detected: the arm whips forward and the ball leaves the hand. */
  release(strength: number, roll: number, lateral = 0): void {
    if (this.phase !== 'hold') return;
    const backswing = Math.max(0, -this.arm);
    const speed = 3.2 + clamp(strength, 0, 1) * 4.2 + backswing * 1.8;
    const ang = (this.aimAngle * Math.PI) / 180;
    this.pendingBall = {
      x: this.aimX,
      z: 0,
      vx: Math.sin(ang) * speed,
      vz: Math.cos(ang) * speed,
      hook: clamp(-roll * 2.4 + lateral * 0.6, -3, 3),
      gutter: false,
      active: false,
    };
    this.phase = 'throw';
    this.timer = 0;
    this.events.push('throw');
    this.hudDirty = true;
  }

  private launch(): void {
    if (!this.pendingBall) return;
    this.ball = { ...this.pendingBall, active: true };
    this.pendingBall = null;
    this.pinsUpAtStart = this.standing;
    this.crashed = false;
    this.phase = 'rolling';
    this.events.push('roll');
    this.hudDirty = true;
  }

  restart(): void {
    for (const p of this.players) p.frames = [];
    this.current = 0;
    this.frame = 0;
    this.resetPins();
    this.ball.active = false;
    this.confetti = [];
    this.mood = null;
    this.message = '';
    this.phase = 'intro';
    this.timer = 0;
    this.events.push('intro');
    this.hudDirty = true;
  }

  update(dt: number): void {
    const k = (rate: number) => Math.min(1, dt * rate);
    switch (this.phase) {
      case 'hold':
        this.arm += (this.armInput - this.arm) * k(14);
        break;
      case 'throw':
        this.arm += (1.15 - this.arm) * k(13);
        this.timer += dt;
        if (this.arm > 0.55 || this.timer > THROW_SECONDS) this.launch();
        break;
      case 'rolling':
        this.arm += (0.85 - this.arm) * k(4);
        break;
      default:
        this.arm += (0 - this.arm) * k(5);
    }

    if (this.phase === 'intro') {
      this.timer += dt;
      if (this.timer > INTRO_SECONDS) {
        this.phase = 'aim';
        this.hudDirty = true;
      }
    }
    if (this.phase === 'rolling' || this.phase === 'settle') {
      const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / sub;
      for (let i = 0; i < sub; i++) this.step(h);
    }
    if (this.phase === 'rolling' && !this.ball.active) {
      this.phase = 'settle';
      this.timer = 0;
    }
    if (this.phase === 'settle') {
      this.timer += dt;
      const moving = this.pins.some((p) => !p.gone && (Math.abs(p.vx) > 0.02 || Math.abs(p.vz) > 0.02));
      if (!moving || this.timer > 3.5) this.finishRoll();
    } else if (this.phase === 'result') {
      this.timer += dt;
      if (this.timer > RESULT_SECONDS) {
        if (this.pendingSweep) {
          this.phase = 'sweep';
          this.timer = 0;
          this.sweepT = 0;
          this.sweepApplied = false;
          this.events.push('sweep');
        } else this.nextRoll();
      }
    } else if (this.phase === 'sweep') {
      this.timer += dt;
      this.sweepT = Math.min(1, this.timer / SWEEP_SECONDS);
      if (!this.sweepApplied && this.sweepT >= 0.5) {
        this.sweepApplied = true;
        if (this.pendingDone || this.pendingReset) this.resetPins();
        else this.sweepFallen();
      }
      if (this.sweepT >= 1) this.nextRoll();
    }

    // camera: follows the ball, then parks near the pins for the action
    const watching = this.phase === 'rolling' || this.phase === 'settle' || this.phase === 'result' || this.phase === 'sweep';
    const target = watching ? clamp(this.ball.z - 6.5, CAM_REST, CAM_MAX) : CAM_REST;
    this.camZ += (target - this.camZ) * k(target > this.camZ ? 3.5 : 2.2);
    if (Math.abs(target - this.camZ) < 0.005) this.camZ = target;

    for (const c of this.confetti) {
      c.vy += 0.45 * dt;
      c.vx *= 1 - 0.8 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < 1.15);
    for (const p of this.pins) if (!p.up && p.tilt < 1) p.tilt = Math.min(1, p.tilt + dt * 3.5);
  }

  private step(dt: number): void {
    const b = this.ball;
    if (b.active) {
      b.z += b.vz * dt;
      b.x += b.vx * dt;
      if (!b.gutter) {
        // the ball hooks late, like a real spin
        b.vx += b.hook * dt * (b.z > 5 ? 1 : 0.3);
        b.vz -= 0.22 * dt;
        if (Math.abs(b.x) > LANE_HALF - BALL_R * 0.55) {
          b.gutter = true;
          b.x = Math.sign(b.x) * (LANE_HALF + 0.07);
          b.vx = 0;
          b.hook = 0;
          this.events.push('gutter');
        }
      }
      if (b.z > LANE_END + 0.5 || b.vz < 0.4) b.active = false;
      if (!b.gutter) for (const p of this.pins) if (!p.gone) this.collideBall(b, p);
    }
    for (let i = 0; i < this.pins.length; i++) {
      const p = this.pins[i];
      if (p.gone) continue;
      if (p.vx !== 0 || p.vz !== 0) {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const damp = Math.max(0, 1 - 2.8 * dt);
        p.vx *= damp;
        p.vz *= damp;
        if (Math.hypot(p.vx, p.vz) < 0.04) {
          p.vx = 0;
          p.vz = 0;
        }
        if (Math.abs(p.x) > LANE_HALF + 0.12 || p.z > LANE_END) p.gone = true;
      }
      for (let j = i + 1; j < this.pins.length; j++) {
        const q = this.pins[j];
        if (!q.gone) this.collidePins(p, q);
      }
    }
  }

  private collideBall(b: Ball, p: Pin): void {
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const d = Math.hypot(dx, dz);
    const minD = BALL_R + PIN_R;
    if (d >= minD || d === 0) return;
    const nx = dx / d;
    const nz = dz / d;
    const overlap = minD - d;
    p.x += nx * overlap;
    p.z += nz * overlap;
    const rel = (b.vx - p.vx) * nx + (b.vz - p.vz) * nz;
    if (rel <= 0) return;
    const mb = 7;
    const mp = 1.5;
    const j = ((1 + 0.5) * rel) / (1 / mb + 1 / mp);
    b.vx -= (j / mb) * nx;
    b.vz -= (j / mb) * nz;
    p.vx += (j / mp) * nx;
    p.vz += (j / mp) * nz;
    this.knock(p);
    if (!this.crashed) {
      this.crashed = true;
      this.events.push('crash');
    }
  }

  private collidePins(p: Pin, q: Pin): void {
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const d = Math.hypot(dx, dz);
    const minD = PIN_R * 2;
    if (d >= minD || d === 0) return;
    const nx = dx / d;
    const nz = dz / d;
    const overlap = minD - d;
    p.x -= (nx * overlap) / 2;
    p.z -= (nz * overlap) / 2;
    q.x += (nx * overlap) / 2;
    q.z += (nz * overlap) / 2;
    const rel = (p.vx - q.vx) * nx + (p.vz - q.vz) * nz;
    if (rel <= 0) return;
    const j = ((1 + 0.45) * rel) / 2;
    p.vx -= j * nx;
    p.vz -= j * nz;
    q.vx += j * nx;
    q.vz += j * nz;
    this.knock(p);
    this.knock(q);
  }

  private knock(p: Pin): void {
    if (p.up && Math.hypot(p.vx, p.vz) > 0.25) {
      p.up = false;
      p.tilt = 0;
      p.tiltDir = p.vx >= 0 ? 1 : -1;
    }
  }

  private spawnConfetti(count: number): void {
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: 0.2 + Math.random() * 0.6,
        y: -0.05 - Math.random() * 0.25,
        vx: (Math.random() - 0.5) * 0.4,
        vy: 0.1 + Math.random() * 0.25,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        life: 2.5 + Math.random() * 1.5,
      });
    }
  }

  private finishRoll(): void {
    const knocked = Math.max(0, this.pinsUpAtStart - this.standing);
    const frames = this.player.frames;
    if (!frames[this.frame]) frames[this.frame] = [];
    const rolls = frames[this.frame];
    rolls.push(knocked);
    let done = false;
    let reset = false;
    let msg = '';
    if (this.frame < 9) {
      if (rolls.length === 1) {
        if (knocked === 10) {
          msg = 'STRIKE!';
          done = true;
        }
      } else {
        if (rolls[0] + rolls[1] === 10) msg = 'SPARE!';
        done = true;
      }
    } else if (rolls.length === 1) {
      if (knocked === 10) {
        msg = 'STRIKE!';
        reset = true;
      }
    } else if (rolls.length === 2) {
      if (rolls[0] === 10) {
        if (knocked === 10) {
          msg = 'STRIKE!';
          reset = true;
        }
      } else if (rolls[0] + rolls[1] === 10) {
        msg = 'SPARE!';
        reset = true;
      } else done = true;
    } else done = true;

    const gameEnds = done && this.frame === 9 && this.current === this.players.length - 1;
    if (msg === 'STRIKE!') {
      this.events.push('strike', 'cheer');
      this.mood = 'cheer';
      this.spawnConfetti(140);
    } else if (msg === 'SPARE!') {
      this.events.push('spare', 'cheer');
      this.mood = 'cheer';
      this.spawnConfetti(70);
    } else if (knocked === 0) {
      msg = this.ball.gutter ? 'GUTTER BALL' : 'MISS';
      this.events.push('aww');
      this.mood = 'sad';
    } else {
      msg = `${knocked} PIN${knocked > 1 ? 'S' : ''}`;
      this.mood = knocked >= 7 ? 'cheer' : null;
    }
    this.message = msg;
    this.pendingDone = done;
    this.pendingReset = reset;
    this.pendingSweep = !gameEnds;
    this.phase = 'result';
    this.timer = 0;
    this.hudDirty = true;
  }

  private nextRoll(): void {
    this.message = '';
    this.mood = null;
    this.ball.active = false;
    if (this.pendingDone) {
      const previous = this.current;
      this.current = (this.current + 1) % this.players.length;
      if (this.current === 0) this.frame += 1;
      if (this.frame > 9) {
        this.phase = 'over';
        this.events.push('over');
        this.hudDirty = true;
        return;
      }
      if (this.players.length > 1 && previous !== this.current) {
        this.phase = 'intro';
        this.timer = 0;
        this.events.push('intro');
      } else this.phase = 'aim';
    } else this.phase = 'aim';
    this.hudDirty = true;
  }
}

/** Standard ten-pin scoring. A frame's score is null until its bonus rolls are known. */
export function scoreFrames(frames: number[][]): { perFrame: (number | null)[]; total: number } {
  const rolls: number[] = [];
  for (const f of frames) rolls.push(...f);
  const perFrame: (number | null)[] = [];
  let total = 0;
  let i = 0;
  for (let f = 0; f < 10; f++) {
    if (i >= rolls.length) {
      perFrame.push(null);
      continue;
    }
    if (f < 9) {
      if (rolls[i] === 10) {
        if (i + 2 < rolls.length) {
          total += 10 + rolls[i + 1] + rolls[i + 2];
          perFrame.push(total);
        } else perFrame.push(null);
        i += 1;
      } else if (i + 1 < rolls.length) {
        if (rolls[i] + rolls[i + 1] === 10) {
          if (i + 2 < rolls.length) {
            total += 10 + rolls[i + 2];
            perFrame.push(total);
          } else perFrame.push(null);
        } else {
          total += rolls[i] + rolls[i + 1];
          perFrame.push(total);
        }
        i += 2;
      } else {
        perFrame.push(null);
        i += 1;
      }
    } else {
      const rest = rolls.slice(i);
      const bonus = rest[0] === 10 || (rest.length >= 2 && rest[0] + rest[1] === 10);
      const complete = bonus ? rest.length === 3 : rest.length === 2;
      if (complete) {
        total += rest.reduce((a, b) => a + b, 0);
        perFrame.push(total);
      } else perFrame.push(null);
    }
  }
  return { perFrame, total };
}
