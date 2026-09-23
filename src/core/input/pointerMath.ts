import type { Vec3 } from './types';

const D2R = Math.PI / 180;

/** Direction the top edge of the phone points to, derived from DeviceOrientation Euler angles. */
export interface Aim {
  /** Yaw in radians, positive = clockwise seen from above (turning right). */
  heading: number;
  /** Pitch in radians, positive = pointing up. */
  pitch: number;
  /** Roll in radians, positive = right edge tilted down. */
  roll: number;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Uses the W3C DeviceOrientation rotation matrix (Z-X'-Y'' intrinsic) to express the
 * device Y axis (top edge) and X axis (right edge) in the world frame, then reads yaw / pitch / roll from them.
 */
export function aimFromEuler(alpha: number, beta: number, gamma: number): Aim {
  const a = alpha * D2R;
  const b = beta * D2R;
  const g = gamma * D2R;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const sG = Math.sin(g);

  // Device Y axis (top edge) in world coordinates (x = east, y = north, z = up)
  const fx = -cB * sA;
  const fy = cA * cB;
  const fz = sB;
  // Device X axis (right edge) in world coordinates
  const rz = -cB * sG;

  return {
    heading: Math.atan2(fx, fy),
    pitch: Math.asin(clamp(fz, -1, 1)),
    roll: -Math.asin(clamp(rz, -1, 1)),
  };
}

export function length3(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize3(v: Vec3): Vec3 {
  const l = length3(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
