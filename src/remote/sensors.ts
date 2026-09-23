import type { Triple } from '../core/input/messages';

export type SensorPermission = 'granted' | 'denied' | 'unsupported';

type PermissionCtor = { requestPermission?: () => Promise<'granted' | 'denied'> } | undefined;

/** iOS 13+ needs an explicit permission from a user gesture; other browsers just work on HTTPS. */
export async function requestSensorPermission(): Promise<SensorPermission> {
  if (!('DeviceOrientationEvent' in window) && !('DeviceMotionEvent' in window)) return 'unsupported';
  const DOE = (window as unknown as { DeviceOrientationEvent?: PermissionCtor }).DeviceOrientationEvent;
  const DME = (window as unknown as { DeviceMotionEvent?: PermissionCtor }).DeviceMotionEvent;
  let result: SensorPermission = 'granted';
  try {
    if (DOE?.requestPermission) {
      if ((await DOE.requestPermission()) !== 'granted') result = 'denied';
    }
    if (DME?.requestPermission) {
      if ((await DME.requestPermission()) !== 'granted') result = 'denied';
    }
  } catch {
    result = 'denied';
  }
  return result;
}

/** Keeps the latest orientation / motion readings; the remote streams them at a fixed rate. */
export class Sensors {
  orientation: Triple | null = null;
  accel: Triple | null = null;
  accelG: Triple | null = null;
  rate: Triple | null = null;
  orientationCount = 0;
  motionCount = 0;
  private gravity: Triple | null = null;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    window.addEventListener('deviceorientation', this.onOrientation, true);
    window.addEventListener('devicemotion', this.onMotion, true);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.removeEventListener('deviceorientation', this.onOrientation, true);
    window.removeEventListener('devicemotion', this.onMotion, true);
  }

  private onOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha == null && e.beta == null && e.gamma == null) return;
    this.orientation = [e.alpha ?? 0, e.beta ?? 0, e.gamma ?? 0];
    this.orientationCount += 1;
  };

  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.acceleration;
    const g = e.accelerationIncludingGravity;
    const r = e.rotationRate;
    if (g && g.x != null) {
      this.accelG = [g.x ?? 0, g.y ?? 0, g.z ?? 0];
    }
    if (a && a.x != null) {
      this.accel = [a.x ?? 0, a.y ?? 0, a.z ?? 0];
    } else if (this.accelG) {
      // No linear acceleration on this device: subtract a low-passed gravity estimate.
      const k = 0.08;
      const gv: Triple = this.gravity ?? [this.accelG[0], this.accelG[1], this.accelG[2]];
      gv[0] += (this.accelG[0] - gv[0]) * k;
      gv[1] += (this.accelG[1] - gv[1]) * k;
      gv[2] += (this.accelG[2] - gv[2]) * k;
      this.gravity = gv;
      this.accel = [this.accelG[0] - gv[0], this.accelG[1] - gv[1], this.accelG[2] - gv[2]];
    }
    if (r && r.alpha != null) {
      this.rate = [r.alpha ?? 0, r.beta ?? 0, r.gamma ?? 0];
    }
    this.motionCount += 1;
  };
}
