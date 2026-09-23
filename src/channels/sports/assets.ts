import { assetMap, type MusicRequest } from '../../core';

/**
 * Optional files for the sports channel. Drop them in public/assets/sports/ with these exact
 * names; anything missing falls back to the built-in synthesized sounds and procedural drawings.
 * See public/assets/README.md for the full list and specs.
 */
export const SPORTS_SFX = assetMap('/assets/sports/sfx', {
  intro: 'intro.mp3',
  turn: 'turn.mp3',
  throw: 'throw.mp3',
  roll: 'roll.mp3',
  crash1: 'crash-1.mp3',
  crash2: 'crash-2.mp3',
  crash3: 'crash-3.mp3',
  gutter: 'gutter.mp3',
  strike: 'strike.mp3',
  spare: 'spare.mp3',
  cheer: 'crowd-cheer.mp3',
  aww: 'crowd-aww.mp3',
  sweep: 'pinsetter.mp3',
});

/** Sport selection screen (the original Wii Sports menu loop). */
export const SPORTS_MENU_MUSIC: MusicRequest = { url: '/assets/sports/music/menu.mp3', synth: 'sports', fade: 0.8 };
/** Bowling alley loop. */
export const SPORTS_MUSIC: MusicRequest = { url: '/assets/sports/music/alley.mp3', synth: 'sports', fade: 0.8 };
export const RESULTS_MUSIC: MusicRequest = { url: '/assets/sports/music/results.mp3', synth: 'results', fade: 0.5 };

export const BOWLING_IMAGES = assetMap('/assets/sports/bowling', {
  background: 'background.png',
  ball: 'ball.png',
  pin: 'pin.png',
  pinFallen: 'pin-fallen.png',
  bowlerIdle: 'bowler-idle.png',
  bowlerHold: 'bowler-hold.png',
  bowlerBack: 'bowler-back.png',
  bowlerSwing: 'bowler-swing.png',
  bowlerRelease: 'bowler-release.png',
  bowlerCheer: 'bowler-cheer.png',
  bowlerSad: 'bowler-sad.png',
});
