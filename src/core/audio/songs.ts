/**
 * Original synthesized songs used when no music file is present in public/assets.
 * Notes are MIDI numbers, positions are sixteenth-note steps.
 */
export interface Note {
  step: number;
  midi: number;
  len: number;
  vel?: number;
}

export interface Chord {
  step: number;
  notes: number[];
  len: number;
}

export interface Song {
  bpm: number;
  loopSteps: number;
  melody: Note[];
  chords: Chord[];
  bass: Note[];
  /** High notes sprinkled at random on off-beats. */
  sparkles?: number[];
  pluck: { type: OscillatorType; gain: number; decay: number; cutoff: number };
  pad: { gain: number; cutoff: number };
  bass_: { gain: number; type: OscillatorType };
  delaySteps: number;
  delayFeedback: number;
  reverbWet: number;
}

export type SongName = 'menu' | 'sports' | 'play' | 'results';

function bar(step: number, notes: [number, number, number][]): Note[] {
  return notes.map(([offset, midi, len]) => ({ step: step + offset, midi, len }));
}

const MENU: Song = {
  bpm: 92,
  loopSteps: 128,
  melody: [
    ...bar(0, [[0, 76, 3], [3, 79, 3], [6, 84, 4], [10, 81, 2], [12, 79, 4]]),
    ...bar(16, [[0, 81, 3], [3, 84, 3], [6, 88, 4], [10, 86, 2], [12, 84, 4]]),
    ...bar(32, [[0, 81, 3], [3, 84, 3], [6, 86, 4], [10, 84, 2], [12, 81, 4]]),
    ...bar(48, [[0, 79, 3], [3, 83, 3], [6, 86, 6], [12, 79, 4]]),
    ...bar(64, [[0, 76, 3], [3, 79, 3], [6, 84, 4], [10, 88, 2], [12, 86, 4]]),
    ...bar(80, [[0, 84, 3], [3, 81, 3], [6, 79, 4], [10, 76, 2], [12, 79, 4]]),
    ...bar(96, [[0, 81, 3], [3, 84, 3], [6, 86, 4], [10, 88, 2], [12, 86, 4]]),
    ...bar(112, [[0, 84, 4], [4, 79, 4], [8, 76, 8]]),
  ],
  chords: [
    { step: 0, notes: [60, 64, 67], len: 16 },
    { step: 16, notes: [57, 60, 64], len: 16 },
    { step: 32, notes: [53, 57, 60], len: 16 },
    { step: 48, notes: [55, 59, 62], len: 16 },
    { step: 64, notes: [60, 64, 67], len: 16 },
    { step: 80, notes: [57, 60, 64], len: 16 },
    { step: 96, notes: [53, 57, 60], len: 16 },
    { step: 112, notes: [55, 59, 62], len: 16 },
  ],
  bass: [48, 45, 41, 43, 48, 45, 41, 43].map((midi, i) => ({ step: i * 16, midi, len: 16 })),
  sparkles: [96, 98, 100, 103, 105],
  pluck: { type: 'triangle', gain: 0.16, decay: 1.6, cutoff: 3200 },
  pad: { gain: 0.028, cutoff: 760 },
  bass_: { gain: 0.09, type: 'sine' },
  delaySteps: 6,
  delayFeedback: 0.34,
  reverbWet: 0.42,
};

/** Bright, laid-back bowling-alley tune (G major). */
const SPORTS: Song = {
  bpm: 112,
  loopSteps: 128,
  melody: [
    ...bar(0, [[0, 71, 2], [2, 74, 2], [4, 79, 4], [8, 76, 2], [10, 74, 2], [12, 71, 4]]),
    ...bar(16, [[0, 76, 2], [2, 79, 2], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 76, 4]]),
    ...bar(32, [[0, 76, 2], [2, 79, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 74, 4]]),
    ...bar(48, [[0, 69, 2], [2, 71, 2], [4, 74, 4], [8, 76, 2], [10, 74, 2], [12, 71, 4]]),
    ...bar(64, [[0, 79, 2], [2, 81, 2], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 76, 4]]),
    ...bar(80, [[0, 74, 2], [2, 76, 2], [4, 79, 4], [8, 76, 2], [10, 74, 2], [12, 71, 4]]),
    ...bar(96, [[0, 69, 2], [2, 71, 2], [4, 74, 4], [8, 76, 2], [10, 79, 2], [12, 81, 4]]),
    ...bar(112, [[0, 83, 4], [4, 81, 2], [6, 79, 2], [8, 74, 8]]),
  ],
  chords: [
    [55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57],
    [55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57],
  ].map((notes, i) => ({ step: i * 16, notes, len: 16 })),
  bass: [
    [43, 47, 50, 47], [40, 43, 47, 43], [36, 40, 43, 40], [38, 42, 45, 42],
    [43, 47, 50, 47], [40, 43, 47, 43], [36, 40, 43, 40], [38, 42, 45, 42],
  ].flatMap((walk, b) => walk.map((midi, q) => ({ step: b * 16 + q * 4, midi, len: 4 }))),
  pluck: { type: 'square', gain: 0.07, decay: 0.5, cutoff: 1800 },
  pad: { gain: 0.02, cutoff: 900 },
  bass_: { gain: 0.11, type: 'triangle' },
  delaySteps: 4,
  delayFeedback: 0.22,
  reverbWet: 0.25,
};

/** Bouncy fairground tune for the mini-games (F major). */
const PLAY: Song = {
  bpm: 128,
  loopSteps: 128,
  melody: [
    ...bar(0, [[0, 77, 1], [2, 77, 1], [4, 81, 2], [8, 84, 2], [12, 81, 2], [14, 79, 1]]),
    ...bar(16, [[0, 77, 1], [2, 74, 1], [4, 77, 2], [8, 79, 2], [12, 81, 2], [14, 79, 1]]),
    ...bar(32, [[0, 79, 1], [2, 79, 1], [4, 76, 2], [8, 72, 2], [12, 74, 2], [14, 76, 1]]),
    ...bar(48, [[0, 77, 2], [4, 81, 2], [8, 84, 4], [12, 81, 2], [14, 79, 1]]),
    ...bar(64, [[0, 84, 1], [2, 84, 1], [4, 81, 2], [8, 77, 2], [12, 79, 2], [14, 81, 1]]),
    ...bar(80, [[0, 82, 1], [2, 82, 1], [4, 79, 2], [8, 74, 2], [12, 77, 2], [14, 79, 1]]),
    ...bar(96, [[0, 76, 1], [2, 76, 1], [4, 79, 2], [8, 84, 2], [12, 79, 2], [14, 76, 1]]),
    ...bar(112, [[0, 77, 2], [4, 84, 2], [8, 77, 6]]),
  ],
  chords: [
    [53, 57, 60], [58, 62, 65], [60, 64, 67], [53, 57, 60],
    [53, 57, 60], [58, 62, 65], [60, 64, 67], [53, 57, 60],
  ].map((notes, i) => ({ step: i * 16, notes, len: 16 })),
  bass: [41, 46, 48, 41, 41, 46, 48, 41].flatMap((root, b) =>
    Array.from({ length: 8 }, (_, e) => ({ step: b * 16 + e * 2, midi: e % 2 === 0 ? root : root + 12, len: 2 })),
  ),
  pluck: { type: 'square', gain: 0.06, decay: 0.3, cutoff: 2600 },
  pad: { gain: 0.016, cutoff: 1100 },
  bass_: { gain: 0.1, type: 'triangle' },
  delaySteps: 3,
  delayFeedback: 0.18,
  reverbWet: 0.2,
};

/** Short cheerful fanfare loop for result screens (C major). */
const RESULTS: Song = {
  bpm: 104,
  loopSteps: 64,
  melody: [
    ...bar(0, [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 84, 6], [12, 83, 2], [14, 81, 2]]),
    ...bar(16, [[0, 79, 2], [2, 81, 2], [4, 83, 2], [6, 84, 8]]),
    ...bar(32, [[0, 81, 2], [2, 79, 2], [4, 77, 2], [6, 76, 6], [12, 74, 2], [14, 72, 2]]),
    ...bar(48, [[0, 74, 2], [2, 76, 2], [4, 79, 2], [6, 84, 10]]),
  ],
  chords: [
    { step: 0, notes: [60, 64, 67], len: 16 },
    { step: 16, notes: [53, 57, 60], len: 16 },
    { step: 32, notes: [55, 59, 62], len: 16 },
    { step: 48, notes: [60, 64, 67], len: 16 },
  ],
  bass: [48, 41, 43, 48].map((midi, i) => ({ step: i * 16, midi, len: 16 })),
  pluck: { type: 'triangle', gain: 0.14, decay: 0.9, cutoff: 3000 },
  pad: { gain: 0.03, cutoff: 900 },
  bass_: { gain: 0.09, type: 'sine' },
  delaySteps: 4,
  delayFeedback: 0.25,
  reverbWet: 0.35,
};

export const SONGS: Record<SongName, Song> = { menu: MENU, sports: SPORTS, play: PLAY, results: RESULTS };
