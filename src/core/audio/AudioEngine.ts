import { Emitter } from '../events';
import { SFX, type SfxName } from './sfx';
import { SONGS, type SongName } from './songs';
import { ThemePlayer } from './theme';

export type { SfxName } from './sfx';
export type { SongName } from './songs';

export interface ToneOptions {
  freq: number;
  /** Frequency to glide to over the duration. */
  sweepTo?: number;
  type?: OscillatorType;
  duration?: number;
  gain?: number;
  attack?: number;
  /** Seconds after now. */
  delay?: number;
  /** Optional low-pass cutoff. */
  lowpass?: number;
}

export interface NoiseOptions {
  duration?: number;
  gain?: number;
  attack?: number;
  /** Band-pass centre frequency; omit for white noise. */
  filter?: number;
  /** Band-pass centre to glide to. */
  sweepTo?: number;
  q?: number;
  delay?: number;
}

export interface SfxOptions {
  gain?: number;
  /** Playback rate (1 = normal). */
  rate?: number;
  delay?: number;
}

/** What to play as music: a file (first URL that exists wins) and/or a synthesized song as fallback. */
export interface MusicRequest {
  url?: string | string[] | null;
  synth?: SongName | null;
  /** Cross-fade time in seconds. */
  fade?: number;
  /** When no file exists and no synth is given, keep whatever is playing instead of stopping. */
  keepIfMissing?: boolean;
  gain?: number;
}

export type LoopSynth = 'roll' | 'hum' | 'crowd';

export interface LoopOptions {
  /** Synthesized fallback when no sample is registered under the key. */
  synth?: LoopSynth;
  gain?: number;
  fadeIn?: number;
  rate?: number;
}

export interface LoopHandle {
  stop(fade?: number): void;
  setGain(gain: number, ramp?: number): void;
  setRate(rate: number): void;
}

interface Track {
  stop(fade: number): void;
}

interface Sample {
  buffer: AudioBuffer;
  /** First audible second (ripped samples often carry a silent lead-in). */
  start: number;
  /** Last audible second, used as loop end. */
  end: number;
}

/** Find the audible span of a buffer (threshold on the first channel). */
function audibleSpan(buffer: AudioBuffer, threshold = 0.012): { start: number; end: number } {
  const data = buffer.getChannelData(0);
  let first = 0;
  while (first < data.length && Math.abs(data[first]) < threshold) first++;
  let last = data.length - 1;
  while (last > first && Math.abs(data[last]) < threshold) last--;
  if (first >= data.length) return { start: 0, end: buffer.duration };
  const start = Math.max(0, first / buffer.sampleRate - 0.005);
  const end = Math.min(buffer.duration, last / buffer.sampleRate + 0.05);
  return { start, end };
}

/** Menu theme: `public/assets/system/music/menu-theme.mp3` if present, synthesized otherwise. */
export const MENU_MUSIC: MusicRequest = {
  url: ['/assets/system/music/menu-theme.mp3', '/assets/system/music/menu-theme.ogg', '/audio/menu-theme.mp3'],
  synth: 'menu',
  fade: 0.8,
};

type AudioEvents = {
  change: { unlocked: boolean; musicPlaying: boolean; themeSource: 'file' | 'synth' | null };
};

/**
 * Web Audio engine. Sound effects are synthesized unless a sample is registered for them,
 * music comes from files in public/assets with synthesized songs as fallback.
 */
export class AudioEngine extends Emitter<AudioEvents> {
  ctx: AudioContext | null = null;
  unlocked = false;
  themeSource: 'file' | 'synth' | null = null;
  musicKey: string | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private volume = 0.8;
  private musicEnabled = true;
  private sfxEnabled = true;
  private samples = new Map<string, Sample>();
  private bufferCache = new Map<string, Promise<AudioBuffer | null>>();
  private noiseBuffer: AudioBuffer | null = null;
  private track: Track | null = null;
  private pendingMusic: MusicRequest | null = null;
  private musicSeq = 0;

  get musicPlaying(): boolean {
    return !!this.track && this.musicEnabled;
  }

  /** Creates the context (suspended until a user gesture). Safe to call anytime. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor({ latencyHint: 'interactive' });
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxEnabled ? 1 : 0;
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicEnabled ? 1 : 0;
    this.musicGain.connect(this.masterGain);
    return this.ctx;
  }

  /** Must be called from a user gesture (click / key press). Safe to call repeatedly. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    if (!this.unlocked && ctx.state !== 'closed') {
      this.unlocked = true;
      this.notify();
      if (this.pendingMusic) void this.startMusic(this.pendingMusic);
    }
  }

  private notify(): void {
    this.emit('change', { unlocked: this.unlocked, musicPlaying: this.musicPlaying, themeSource: this.themeSource });
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    this.notify();
  }

  getVolume(): number {
    return this.volume;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(enabled ? 1 : 0, this.ctx.currentTime, 0.05);
    if (enabled && this.pendingMusic && !this.track && this.unlocked) void this.startMusic(this.pendingMusic);
    this.notify();
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(enabled ? 1 : 0, this.ctx.currentTime, 0.02);
    this.notify();
  }

  get isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  get isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  // ------------------------------------------------------------------ samples

  private fetchBuffer(url: string): Promise<AudioBuffer | null> {
    let p = this.bufferCache.get(url);
    if (p) return p;
    p = (async () => {
      const ctx = this.ensureContext();
      if (!ctx) return null;
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        const type = res.headers.get('content-type') || '';
        // Dev servers answer index.html for unknown files: make sure we got audio.
        if (!res.ok || type.includes('text/html')) return null;
        const data = await res.arrayBuffer();
        if (data.byteLength < 500) return null;
        return await ctx.decodeAudioData(data);
      } catch {
        return null;
      }
    })();
    this.bufferCache.set(url, p);
    return p;
  }

  /**
   * Load samples that override synthesized sounds. Keys become `${prefix}.${name}`.
   * Missing files are ignored silently (the synthesized version keeps playing).
   */
  async registerSamples(prefix: string, map: Record<string, string>): Promise<void> {
    await Promise.all(
      Object.entries(map).map(async ([name, url]) => {
        const buf = await this.fetchBuffer(url);
        if (buf) this.samples.set(`${prefix}.${name}`, { buffer: buf, ...audibleSpan(buf) });
      }),
    );
  }

  hasSample(key: string): boolean {
    return this.samples.has(key);
  }

  /** Play a registered sample, or the synthesized `fallback` when the sample is missing. */
  sfx(key: string, fallback?: SfxName, opts: SfxOptions = {}): void {
    if (!this.sfxEnabled) return;
    const sample = this.samples.get(key);
    if (sample) this.playBuffer(sample, opts);
    else if (fallback) SFX[fallback]?.(this);
  }

  /** Play a named sound effect: the `system.<name>` sample if registered, synthesized otherwise. */
  play(name: SfxName | null | undefined): void {
    if (!name || !this.sfxEnabled) return;
    const sample = this.samples.get(`system.${name}`);
    if (sample) this.playBuffer(sample, {});
    else SFX[name]?.(this);
  }

  private playBuffer(sample: Sample, opts: SfxOptions): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out || !this.unlocked) return;
    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    src.connect(g);
    g.connect(out);
    // skip the silent lead-in so the sound lands exactly on the click
    src.start(ctx.currentTime + (opts.delay ?? 0), sample.start);
  }

  // ------------------------------------------------------------------ synth voices

  /** Low-level synth voice, usable by channels for their own effects. */
  tone(opts: ToneOptions): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out || !this.unlocked) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const duration = opts.duration ?? 0.15;
    const attack = opts.attack ?? 0.004;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.2, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    let node: AudioNode = osc;
    if (opts.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpass;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate * 2;
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  /** Filtered noise burst (or swell when `attack` is given). */
  noise(opts: NoiseOptions = {}): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out || !this.unlocked) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const duration = opts.duration ?? 0.2;
    const attack = opts.attack ?? 0;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    src.loop = true;
    const g = ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.15, t0 + attack);
    } else {
      g.gain.setValueAtTime(opts.gain ?? 0.15, t0);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    let node: AudioNode = src;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = opts.q ?? 1;
      f.frequency.setValueAtTime(opts.filter, t0);
      if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + duration);
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  // ------------------------------------------------------------------ loops

  /** Looping sound (ball rolling, UFO hum...). Uses the sample under `key` or a synthesized `synth`. */
  startLoop(key: string, opts: LoopOptions = {}): LoopHandle {
    const ctx = this.ctx;
    const out = this.sfxGain;
    const noop: LoopHandle = { stop() {}, setGain() {}, setRate() {} };
    if (!ctx || !out || !this.unlocked || !this.sfxEnabled) return noop;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, opts.gain ?? 0.3), t0 + (opts.fadeIn ?? 0.15));
    gain.connect(out);
    const sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
    const sample = this.samples.get(key);
    if (sample) {
      const src = ctx.createBufferSource();
      src.buffer = sample.buffer;
      src.loop = true;
      src.loopStart = sample.start;
      src.loopEnd = sample.end;
      src.playbackRate.value = opts.rate ?? 1;
      src.connect(gain);
      src.start(t0, sample.start);
      sources.push(src);
    } else if (opts.synth === 'roll' || opts.synth === 'crowd') {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = opts.synth === 'roll' ? 'lowpass' : 'bandpass';
      f.frequency.value = opts.synth === 'roll' ? 380 : 900;
      f.Q.value = 0.7;
      src.connect(f);
      f.connect(gain);
      src.start(t0);
      sources.push(src);
    } else if (opts.synth === 'hum') {
      for (const [freq, detune] of [
        [55, -6],
        [110, 7],
      ]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = detune;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        o.connect(f);
        f.connect(gain);
        o.start(t0);
        sources.push(o);
      }
    } else {
      gain.disconnect();
      return noop;
    }
    return {
      stop: (fade = 0.2) => {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, fade));
        for (const s of sources) s.stop(t + fade + 0.05);
        window.setTimeout(() => gain.disconnect(), fade * 1000 + 100);
      },
      setGain: (g, ramp = 0.05) => gain.gain.setTargetAtTime(Math.max(0.0001, g), ctx.currentTime, ramp),
      setRate: (r) => {
        for (const s of sources) {
          if ('playbackRate' in s) s.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.05);
          else s.frequency.setTargetAtTime(s.frequency.value * r, ctx.currentTime, 0.05);
        }
      },
    };
  }

  // ------------------------------------------------------------------ music

  /** Play background music. Repeated calls with the same request are ignored. */
  playMusic(req: MusicRequest): void {
    this.pendingMusic = req;
    if (this.unlocked) void this.startMusic(req);
    this.notify();
  }

  stopMusic(fade = 0.5): void {
    this.pendingMusic = null;
    this.musicSeq += 1;
    this.track?.stop(fade);
    this.track = null;
    this.musicKey = null;
    this.themeSource = null;
    this.notify();
  }

  private async startMusic(req: MusicRequest): Promise<void> {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out) return;
    const urls = req.url ? (Array.isArray(req.url) ? req.url : [req.url]) : [];
    const key = `${urls.join('|')}#${req.synth ?? ''}`;
    if (this.track && this.musicKey === key) return;
    const seq = ++this.musicSeq;
    const fade = req.fade ?? 0.6;
    let buffer: AudioBuffer | null = null;
    for (const url of urls) {
      buffer = await this.fetchBuffer(url);
      if (buffer) break;
    }
    if (seq !== this.musicSeq || this.pendingMusic !== req) return;
    if (!buffer && !req.synth) {
      if (req.keepIfMissing && this.track) return;
      this.track?.stop(fade);
      this.track = null;
      this.musicKey = null;
      this.themeSource = null;
      this.notify();
      return;
    }
    this.track?.stop(fade);
    const gainValue = req.gain ?? 1;
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + fade);
      src.connect(g);
      g.connect(out);
      src.start();
      this.track = {
        stop: (f) => {
          const t = ctx.currentTime;
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, f));
          src.stop(t + f + 0.1);
          window.setTimeout(() => g.disconnect(), f * 1000 + 200);
        },
      };
      this.themeSource = 'file';
    } else {
      const player = new ThemePlayer(ctx, out, SONGS[req.synth as SongName]);
      player.start(fade + 0.6, gainValue);
      this.track = { stop: (f) => player.stop(f) };
      this.themeSource = 'synth';
    }
    this.musicKey = key;
    this.notify();
  }
}

export const audio = new AudioEngine();
