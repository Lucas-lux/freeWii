import { defineChannel, reactMount } from '../../core';
import { PlayBanner } from './Banner';
import { PlayApp } from './PlayApp';
import './play.css';

/**
 * freePlay: pointer mini-games. Target Range is playable (point and press B),
 * the other games are stubs waiting for your code. See src/channels/README.md.
 * Optional assets live in public/assets/play/ (see public/assets/README.md).
 */
export default defineChannel({
  id: 'play',
  title: 'freePlay',
  description: 'Point your phone at the screen: the target range is open, more mini-games welcome.',
  author: 'freeWii',
  version: '0.2.0',
  order: 20,
  banner: PlayBanner,
  bannerImage: '/assets/play/banner.png',
  bannerVideo: '/assets/play/banner.webm',
  bannerMusic: '/assets/play/banner-music.mp3',
  mount: reactMount(PlayApp),
  players: { min: 1, max: 4 },
});
