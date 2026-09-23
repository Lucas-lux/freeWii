import type { Song } from './songs';

/**
 * Generic step-sequencer synth: plays a `Song` forever using the Web Audio clock
 * (look-ahead scheduler) through a delay + generated-impulse reverb chain.
 */
export class ThemePlayer {
  private readonly ctx: AudioContext;
  private readonly song: Song;
  private readonly step: number;
  private readonly out: GainNode;
  private readonly bus: GainNode;
  private timer: number | undefined;
  private nextStep = 0;
  private nextTime = 0;
  private running = false;

  constructor(ctx: AudioContext, destination: AudioNode, song: Song) {
    this.ctx = ctx;
    this.song = song;
    this.step = 60 / song.bpm / 4;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(destination);

    this.bus = ctx.createGain();
    this.bus.connect(this.out);
    // echo
    const delay = ctx.createDelay(2);
    delay.delayTime.value = this.step * song.delaySteps;
    const fb = ctx.createGain();
    fb.gain.value = song.delayFeedback;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 2600;
    const wetDelay = ctx.createGain();
    wetDelay.gain.value = 0.35;
    this.bus.connect(delay);
    delay.connect(fbFilter);
    fbFilter.connect(fb);
    fb.connect(delay);
    delay.connect(wetDelay);
    wetDelay.connect(this.out);
    // reverb (generated impulse response)
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(2.4, 0.5);
    const wetReverb = ctx.createGain();
    wetReverb.gain.value = song.reverbWet;
    this.bus.connect(convolver);
    convolver.connect(wetReverb);
    wetReverb.connect(this.out);
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        data[i] = (Math.random() * 2 - 1) * Math.exp(-t / decay) * (1 - Math.exp(-t * 40));
      }
    }
    return buf;
  }

  start(fadeIn = 1.2, gain = 1): void {
    if (this.running) return;
    this.running = true;
    this.nextStep = 0;
    this.nextTime = this.ctx.currentTime + 0.15;
    this.out.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.out.gain.exponentialRampToValueAtTime(gain, this.ctx.currentTime + fadeIn);
    this.timer = window.setInterval(() => this.schedule(), 60);
    this.schedule();
  }

  stop(fadeOut = 0.8): void {
    if (!this.running) return;
    this.running = false;
    window.clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(Math.max(this.out.gain.value, 0.0001), t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, fadeOut));
    window.setTimeout(() => this.out.disconnect(), fadeOut * 1000 + 200);
  }

  private schedule(): void {
    const horizon = this.ctx.currentTime + 0.3;
    while (this.nextTime < horizon) {
      this.playStep(this.nextStep, this.nextTime);
      this.nextStep = (this.nextStep + 1) % this.song.loopSteps;
      this.nextTime += this.step;
    }
  }

  private playStep(step: number, t: number): void {
    const s = this.song;
    for (const n of s.melody) if (n.step === step) this.pluck(n.midi, t, n.len, n.vel ?? 1);
    for (const c of s.chords) if (c.step === step) for (const m of c.notes) this.pad(m, t, c.len);
    for (const b of s.bass) if (b.step === step) this.bass(b.midi, t, b.len);
    if (s.sparkles && (step % 8 === 5 || step % 16 === 14) && Math.random() < 0.3) {
      this.pluck(s.sparkles[Math.floor(Math.random() * s.sparkles.length)], t + this.step * 0.5, 2, 0.35);
    }
  }

  private pluck(midi: number, t: number, len: number, vel: number): void {
    const ctx = this.ctx;
    const cfg = this.song.pluck;
    const f = mtof(midi);
    const decay = Math.min(cfg.decay, Math.max(0.18, len * this.step * 1.6));
    const o1 = ctx.createOscillator();
    o1.type = cfg.type;
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cfg.cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, cfg.cutoff * 0.28), t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(cfg.gain * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o1.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(this.bus);
    o1.start(t);
    o2.start(t);
    o1.stop(t + decay + 0.05);
    o2.stop(t + decay + 0.05);
  }

  private pad(midi: number, t: number, len: number): void {
    const ctx = this.ctx;
    const cfg = this.song.pad;
    const f = mtof(midi);
    const dur = len * this.step;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(cfg.gain, t + Math.min(0.7, dur * 0.4));
    g.gain.setValueAtTime(cfg.gain, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cfg.cutoff;
    lp.connect(g);
    g.connect(this.bus);
    for (const detune of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.7);
    }
  }

  private bass(midi: number, t: number, len: number): void {
    const ctx = this.ctx;
    const cfg = this.song.bass_;
    const dur = len * this.step;
    const o = ctx.createOscillator();
    o.type = cfg.type;
    o.frequency.value = mtof(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(cfg.gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.out);
    o.start(t);
    o.stop(t + dur);
  }
}

function mtof(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
