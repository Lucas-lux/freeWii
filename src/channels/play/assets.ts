import { assetMap, type MusicRequest } from '../../core';

/**
 * Optional files for the play channel. Drop them in public/assets/play/ with these exact
 * names; anything missing falls back to the built-in synthesized sounds and procedural drawings.
 * See public/assets/README.md for the full list and specs.
 */
export const PLAY_SFX = assetMap('/assets/play/sfx', {
  shot: 'shot.mp3',
  pop: 'pop.mp3',
  clay: 'clay.mp3',
  can: 'can.mp3',
  quack: 'quack.mp3',
  ufo: 'ufo.mp3',
  ufohit: 'ufo-hit.mp3',
  miss: 'miss.mp3',
  countdown: 'countdown.mp3',
  go: 'go.mp3',
  stage: 'stage.mp3',
  roundFirst: 'round-first.mp3',
  roundNext: 'round-next.mp3',
  roundFinal: 'round-final.mp3',
  bonus: 'bonus.mp3',
  timeup: 'time-up.mp3',
});

/** Channel menu (the original Wii Play main menu loop). */
export const PLAY_MENU_MUSIC: MusicRequest = { url: '/assets/play/music/menu.mp3', synth: 'play', fade: 0.8 };
/** In-game: the original shooting range has no background loop, only round jingles. A file here adds one. */
export const PLAY_RANGE_MUSIC: MusicRequest = { url: '/assets/play/music/range.mp3', synth: null, fade: 0.6 };
export const PLAY_RESULTS_MUSIC: MusicRequest = { url: '/assets/play/music/results.mp3', synth: 'results', fade: 0.5 };

/** Optional fish sprites (facing right, transparent PNG). Missing ones are drawn procedurally. */
export const FISH_IMAGES = assetMap('/assets/play/fishing', {
  fry: 'fish-fry.png',
  minnow: 'fish-minnow.png',
  sunfish: 'fish-sunfish.png',
  puffer: 'fish-puffer.png',
  gar: 'fish-gar.png',
  king: 'fish-king.png',
  pond: 'pond.png',
});

export const RANGE_IMAGES = assetMap('/assets/play/range', {
  background: 'background.png',
  shelf: 'shelf.png',
  balloon1: 'balloon-1.png',
  balloon2: 'balloon-2.png',
  balloon3: 'balloon-3.png',
  clay: 'clay.png',
  can: 'can.png',
  canDented: 'can-dented.png',
  duck1: 'duck-1.png',
  duck2: 'duck-2.png',
  duck3: 'duck-3.png',
  ufo: 'ufo.png',
  crosshair: 'crosshair.png',
  grass: 'grass.png',
});
