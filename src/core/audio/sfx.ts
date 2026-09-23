import type { AudioEngine } from './AudioEngine';

export type SfxName =
  | 'hover'
  | 'select'
  | 'back'
  | 'page'
  | 'open'
  | 'start'
  | 'home'
  | 'deny'
  | 'connect'
  | 'disconnect'
  | 'pop'
  | 'hit'
  | 'crash'
  | 'strike'
  | 'whoosh'
  | 'tick'
  | 'success'
  | 'fail'
  | 'boot'
  | 'shot'
  | 'quack'
  | 'clay'
  | 'ping'
  | 'cheer'
  | 'aww'
  | 'countdown'
  | 'go'
  | 'timeup'
  | 'stage'
  | 'ufo'
  | 'throw'
  | 'sweep';

/** Every effect is synthesized live: no samples, nothing copyrighted. */
export const SFX: Record<SfxName, (a: AudioEngine) => void> = {
  hover(a) {
    a.tone({ freq: 2093, type: 'sine', duration: 0.07, gain: 0.12 });
    a.tone({ freq: 1046, type: 'triangle', duration: 0.05, gain: 0.06 });
  },
  tick(a) {
    a.tone({ freq: 1600, type: 'sine', duration: 0.035, gain: 0.08 });
  },
  select(a) {
    a.tone({ freq: 880, sweepTo: 1318, type: 'sine', duration: 0.12, gain: 0.16 });
    a.tone({ freq: 1760, type: 'sine', duration: 0.14, gain: 0.1, delay: 0.06 });
  },
  back(a) {
    a.tone({ freq: 1318, sweepTo: 880, type: 'sine', duration: 0.12, gain: 0.14 });
    a.tone({ freq: 660, type: 'sine', duration: 0.14, gain: 0.08, delay: 0.06 });
  },
  page(a) {
    a.noise({ duration: 0.22, gain: 0.12, filter: 600, sweepTo: 2600, q: 1.2 });
    a.tone({ freq: 1200, type: 'sine', duration: 0.05, gain: 0.05, delay: 0.1 });
  },
  open(a) {
    a.tone({ freq: 440, sweepTo: 1760, type: 'sine', duration: 0.42, gain: 0.16 });
    a.tone({ freq: 660, sweepTo: 2640, type: 'triangle', duration: 0.4, gain: 0.05, delay: 0.02 });
    a.noise({ duration: 0.35, gain: 0.06, filter: 900, sweepTo: 4000, q: 0.8 });
  },
  start(a) {
    [523, 659, 784, 1046].forEach((f, i) => a.tone({ freq: f, type: 'sine', duration: 0.32, gain: 0.14, delay: i * 0.07 }));
  },
  home(a) {
    a.tone({ freq: 660, type: 'sine', duration: 0.16, gain: 0.14 });
    a.tone({ freq: 880, type: 'sine', duration: 0.2, gain: 0.12, delay: 0.11 });
  },
  deny(a) {
    a.tone({ freq: 180, type: 'square', duration: 0.14, gain: 0.05, lowpass: 900 });
    a.tone({ freq: 160, type: 'square', duration: 0.14, gain: 0.05, lowpass: 900, delay: 0.16 });
  },
  connect(a) {
    [523, 659, 784].forEach((f, i) => a.tone({ freq: f, type: 'sine', duration: 0.25, gain: 0.13, delay: i * 0.09 }));
  },
  disconnect(a) {
    [784, 659, 523].forEach((f, i) => a.tone({ freq: f, type: 'sine', duration: 0.25, gain: 0.11, delay: i * 0.09 }));
  },
  pop(a) {
    a.tone({ freq: 900, sweepTo: 250, type: 'sine', duration: 0.09, gain: 0.2 });
    a.noise({ duration: 0.06, gain: 0.1, filter: 3000, q: 0.6 });
  },
  hit(a) {
    a.noise({ duration: 0.09, gain: 0.18, filter: 1800, sweepTo: 400, q: 0.7 });
    a.tone({ freq: 220, sweepTo: 80, type: 'triangle', duration: 0.12, gain: 0.16 });
  },
  crash(a) {
    for (let i = 0; i < 6; i++) {
      a.noise({ duration: 0.18, gain: 0.12, filter: 2400 - i * 250, sweepTo: 500, q: 0.8, delay: i * 0.045 });
      a.tone({ freq: 700 - i * 60, sweepTo: 180, type: 'triangle', duration: 0.1, gain: 0.07, delay: i * 0.05 });
    }
  },
  strike(a) {
    [523, 659, 784, 1046, 1318].forEach((f, i) => a.tone({ freq: f, type: 'triangle', duration: 0.4, gain: 0.12, delay: i * 0.08 }));
    a.noise({ duration: 0.5, gain: 0.05, filter: 5000, q: 0.5, delay: 0.3 });
  },
  whoosh(a) {
    a.noise({ duration: 0.38, gain: 0.14, filter: 300, sweepTo: 3200, q: 1.5 });
  },
  success(a) {
    [659, 784, 1046].forEach((f, i) => a.tone({ freq: f, type: 'sine', duration: 0.3, gain: 0.14, delay: i * 0.1 }));
  },
  fail(a) {
    [392, 349, 311].forEach((f, i) => a.tone({ freq: f, type: 'triangle', duration: 0.3, gain: 0.1, delay: i * 0.14 }));
  },
  boot(a) {
    a.tone({ freq: 330, sweepTo: 660, type: 'sine', duration: 0.6, gain: 0.1 });
    a.tone({ freq: 990, type: 'sine', duration: 0.5, gain: 0.06, delay: 0.25 });
  },
  shot(a) {
    a.noise({ duration: 0.14, gain: 0.3, filter: 1600, sweepTo: 300, q: 0.5 });
    a.tone({ freq: 140, sweepTo: 45, type: 'triangle', duration: 0.18, gain: 0.25 });
  },
  quack(a) {
    a.tone({ freq: 720, sweepTo: 380, type: 'square', duration: 0.13, gain: 0.07, lowpass: 1600 });
    a.tone({ freq: 640, sweepTo: 340, type: 'square', duration: 0.12, gain: 0.05, lowpass: 1400, delay: 0.14 });
  },
  clay(a) {
    a.noise({ duration: 0.22, gain: 0.22, filter: 3200, sweepTo: 700, q: 0.7 });
    a.tone({ freq: 2400, sweepTo: 1200, type: 'triangle', duration: 0.08, gain: 0.08 });
  },
  ping(a) {
    a.tone({ freq: 1800, type: 'sine', duration: 0.35, gain: 0.14 });
    a.tone({ freq: 2760, type: 'sine', duration: 0.22, gain: 0.06 });
    a.noise({ duration: 0.05, gain: 0.1, filter: 4000, q: 0.5 });
  },
  cheer(a) {
    a.noise({ duration: 1.6, attack: 0.25, gain: 0.16, filter: 1100, sweepTo: 900, q: 0.5 });
    a.noise({ duration: 1.2, attack: 0.15, gain: 0.08, filter: 2600, q: 0.8, delay: 0.1 });
  },
  aww(a) {
    a.tone({ freq: 420, sweepTo: 240, type: 'triangle', duration: 0.7, gain: 0.07, lowpass: 900 });
    a.noise({ duration: 0.8, attack: 0.1, gain: 0.05, filter: 600, q: 0.6 });
  },
  countdown(a) {
    a.tone({ freq: 880, type: 'sine', duration: 0.12, gain: 0.16 });
  },
  go(a) {
    a.tone({ freq: 1320, type: 'sine', duration: 0.4, gain: 0.18 });
    a.tone({ freq: 1760, type: 'sine', duration: 0.3, gain: 0.08, delay: 0.05 });
  },
  timeup(a) {
    a.tone({ freq: 220, type: 'square', duration: 0.55, gain: 0.06, lowpass: 900 });
    a.tone({ freq: 165, type: 'square', duration: 0.55, gain: 0.05, lowpass: 900 });
  },
  stage(a) {
    [659, 784, 988, 1318].forEach((f, i) => a.tone({ freq: f, type: 'triangle', duration: 0.28, gain: 0.1, delay: i * 0.07 }));
  },
  ufo(a) {
    a.tone({ freq: 300, sweepTo: 900, type: 'sine', duration: 0.35, gain: 0.08 });
    a.tone({ freq: 900, sweepTo: 300, type: 'sine', duration: 0.35, gain: 0.06, delay: 0.3 });
  },
  throw(a) {
    a.noise({ duration: 0.3, gain: 0.12, filter: 250, sweepTo: 1800, q: 1.2 });
  },
  sweep(a) {
    a.noise({ duration: 0.6, attack: 0.05, gain: 0.06, filter: 400, sweepTo: 200, q: 0.8 });
    a.tone({ freq: 90, type: 'triangle', duration: 0.5, gain: 0.05, lowpass: 300 });
  },
};
