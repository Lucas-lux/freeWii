import { defineChannel, reactMount } from '../../core';
import { SportsBanner } from './Banner';
import { SportsApp } from './SportsApp';
import './sports.css';

/**
 * freeSports: motion-controlled sports. Bowling is playable (hold B, swing, release);
 * the other courts are stubs waiting for your code. See src/channels/README.md.
 * Optional assets live in public/assets/sports/ (see public/assets/README.md).
 */
export default defineChannel({
  id: 'sports',
  title: 'freeSports',
  description: 'Swing your phone: bowling is ready, four more sports are waiting for a developer.',
  author: 'freeWii',
  version: '0.2.0',
  order: 10,
  banner: SportsBanner,
  bannerImage: '/assets/sports/banner.png',
  bannerVideo: '/assets/sports/banner.webm',
  bannerMusic: '/assets/sports/banner-music.mp3',
  mount: reactMount(SportsApp),
  players: { min: 1, max: 4 },
});
