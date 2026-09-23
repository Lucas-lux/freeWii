import type { AudioEngine } from '../../core';

export type InstrumentId = 'piano' | 'organ' | 'synth' | 'xylo' | 'bell';
export const INSTRUMENTS: { id: InstrumentId; name: string; icon: string }[] = [
  { id: 'piano', name: 'Piano', icon: '🎹' },
  { id: 'organ', name: 'Organ', icon: '⛪' },
  { id: 'synth', name: 'Synth', icon: '🎛️' },
  { id: 'xylo', name: 'Xylophone', icon: '🪘' },
  { id: 'bell', name: 'Bells', icon: '🔔' },
];

export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Every instrument is a couple of synthesized partials with its own envelope. */
export function playNote(audio: AudioEngine, inst: InstrumentId, midi: number): void {
  const f = midiToFreq(midi);
  switch (inst) {
    case 'piano':
      audio.tone({ freq: f, type: 'triangle', duration: 0.9, gain: 0.22, attack: 0.004, lowpass: 3200 });
      audio.tone({ freq: f * 2, type: 'sine', duration: 0.5, gain: 0.06, attack: 0.004 });
      break;
    case 'organ':
      audio.tone({ freq: f, type: 'sine', duration: 0.7, gain: 0.16, attack: 0.03 });
      audio.tone({ freq: f * 2, type: 'sine', duration: 0.7, gain: 0.08, attack: 0.03 });
      audio.tone({ freq: f * 3, type: 'sine', duration: 0.7, gain: 0.04, attack: 0.03 });
      break;
    case 'synth':
      audio.tone({ freq: f, type: 'sawtooth', duration: 0.55, gain: 0.1, attack: 0.01, lowpass: 1600 });
      audio.tone({ freq: f * 1.006, type: 'sawtooth', duration: 0.55, gain: 0.08, attack: 0.01, lowpass: 1600 });
      break;
    case 'xylo':
      audio.tone({ freq: f, type: 'sine', duration: 0.35, gain: 0.26, attack: 0.002 });
      audio.tone({ freq: f * 2.76, type: 'sine', duration: 0.12, gain: 0.08, attack: 0.002 });
      break;
    case 'bell':
      audio.tone({ freq: f, type: 'sine', duration: 1.6, gain: 0.18, attack: 0.002 });
      audio.tone({ freq: f * 2.4, type: 'sine', duration: 1.0, gain: 0.07, attack: 0.002 });
      audio.tone({ freq: f * 5.1, type: 'sine', duration: 0.4, gain: 0.03, attack: 0.002 });
      break;
  }
}

export type DrumId = 'kick' | 'snare' | 'hihat' | 'clap' | 'tom' | 'cymbal';
export const DRUMS: { id: DrumId; name: string; icon: string; color: string }[] = [
  { id: 'kick', name: 'Kick', icon: '🥁', color: '#e53935' },
  { id: 'snare', name: 'Snare', icon: '🪘', color: '#ff8f00' },
  { id: 'hihat', name: 'Hi-hat', icon: '🎩', color: '#fdd835' },
  { id: 'clap', name: 'Clap', icon: '👏', color: '#43a047' },
  { id: 'tom', name: 'Tom', icon: '🛢️', color: '#1e88e5' },
  { id: 'cymbal', name: 'Cymbal', icon: '🥇', color: '#8e24aa' },
];

export function playDrum(audio: AudioEngine, id: DrumId): void {
  switch (id) {
    case 'kick':
      audio.tone({ freq: 150, sweepTo: 45, type: 'sine', duration: 0.35, gain: 0.5, attack: 0.001 });
      break;
    case 'snare':
      audio.noise({ duration: 0.18, gain: 0.35, filter: 1800, q: 0.7 });
      audio.tone({ freq: 200, sweepTo: 120, type: 'triangle', duration: 0.12, gain: 0.2, attack: 0.001 });
      break;
    case 'hihat':
      audio.noise({ duration: 0.06, gain: 0.18, filter: 8000, q: 1 });
      break;
    case 'clap':
      audio.noise({ duration: 0.12, gain: 0.3, filter: 1200, q: 1.2 });
      audio.noise({ duration: 0.1, gain: 0.2, filter: 1500, q: 1.2, delay: 0.02 });
      break;
    case 'tom':
      audio.tone({ freq: 220, sweepTo: 110, type: 'sine', duration: 0.3, gain: 0.4, attack: 0.001 });
      break;
    case 'cymbal':
      audio.noise({ duration: 0.8, gain: 0.15, filter: 6000, q: 0.5 });
      break;
  }
}

/** 16-step backing beat (one bar of 4/4). */
export const BEAT: Record<DrumId, number[]> = {
  kick: [0, 4, 8, 10, 12],
  snare: [4, 12],
  hihat: [0, 2, 4, 6, 8, 10, 12, 14],
  clap: [],
  tom: [],
  cymbal: [],
};

/** Follow-the-lights songs (MIDI numbers, all within C4–B5). */
export const SONGS: { id: string; name: string; notes: number[] }[] = [
  {
    id: 'twinkle',
    name: 'Twinkle Twinkle',
    notes: [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 67, 67, 65, 65, 64, 64, 62, 67, 67, 65, 65, 64, 64, 62, 60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60],
  },
  { id: 'ode', name: 'Ode to Joy', notes: [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62, 64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 62, 60, 60] },
  { id: 'birthday', name: 'Happy Birthday', notes: [67, 67, 69, 67, 72, 71, 67, 67, 69, 67, 74, 72, 67, 67, 79, 76, 72, 71, 69, 77, 77, 76, 72, 74, 72] },
];
