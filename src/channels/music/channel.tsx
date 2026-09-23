import { defineChannel, reactMount } from '../../core';
import { MusicBanner } from './Banner';
import { MusicApp } from './MusicApp';
import './music.css';

/**
 * freeMusic: a two-octave keyboard and drum pads played with the pointer, several instruments,
 * a backing beat and follow-the-lights songs. Optional assets live in public/assets/music/.
 */
export default defineChannel({
  id: 'music',
  title: 'freeMusic',
  description: 'Play piano, synth and drums with the pointer. Everyone jams at once.',
  author: 'freeWii',
  version: '1.0.0',
  order: 50,
  banner: MusicBanner,
  bannerImage: '/assets/music/banner.png',
  bannerVideo: '/assets/music/banner.webm',
  bannerMusic: '/assets/music/banner-music.mp3',
  mount: reactMount(MusicApp),
  players: { min: 1, max: 4 },
});
