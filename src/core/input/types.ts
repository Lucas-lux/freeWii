export const WII_BUTTONS = ['a', 'b', 'home', 'plus', 'minus', 'one', 'two', 'up', 'down', 'left', 'right'] as const;
export type WiiButton = (typeof WII_BUTTONS)[number];

export const BUTTON_BIT: Record<WiiButton, number> = WII_BUTTONS.reduce(
  (acc, b, i) => ({ ...acc, [b]: 1 << i }),
  {} as Record<WiiButton, number>,
);

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Raw DeviceOrientation Euler angles, in degrees. */
export interface Orientation {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface PointerState {
  /** Horizontal position, 0 = left edge of the screen, 1 = right edge. May slightly overshoot. */
  x: number;
  /** Vertical position, 0 = top, 1 = bottom. */
  y: number;
  /** False when the remote points away from the screen (cursor hidden, like the Wii). */
  onScreen: boolean;
  /** Tilt of the remote around its pointing axis, in radians. Used to rotate the hand cursor. */
  roll: number;
}

export interface MotionSample {
  /** Linear acceleration without gravity (m/s²), in device coordinates. */
  accel: Vec3;
  /** Acceleration including gravity (m/s²). */
  accelG: Vec3;
  /** Rotation rate (deg/s) around alpha/beta/gamma. */
  rate: Vec3;
  orientation: Orientation | null;
  ts: number;
}

export interface SwingEvent {
  /** 0..1, how hard the remote was swung. */
  strength: number;
  /** Peak acceleration magnitude in m/s². */
  peak: number;
  /** Unit vector of the swing in device coordinates (x = right, y = top edge, z = out of the screen). */
  direction: Vec3;
  /** Roll of the remote at swing time (radians). Handy for curve balls. */
  roll: number;
}

export type WiimoteKind = 'phone' | 'local';

export type WiimoteEvents = {
  buttondown: { button: WiiButton };
  buttonup: { button: WiiButton };
  pointer: PointerState;
  motion: MotionSample;
  swing: SwingEvent;
  recenter: Record<string, never>;
  /** Phone only: the remote introduced itself (name known). */
  hello: Record<string, never>;
  disconnect: Record<string, never>;
  change: Record<string, never>;
};

export const ZERO3: Vec3 = { x: 0, y: 0, z: 0 };
