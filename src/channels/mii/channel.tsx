import { defineChannel, reactMount } from '../../core';
import { MiiBanner } from './Banner';
import { MiiApp } from './MiiApp';
import './mii.css';

/**
 * freeMii: build cartoon faces with the pointer and keep them in your Plaza.
 * Optional assets live in public/assets/mii/.
 */
export default defineChannel({
  id: 'mii',
  title: 'freeMii',
  description: 'Make a face: hair, eyes, glasses, moustache… and keep it in your Plaza.',
  author: 'freeWii',
  version: '1.0.0',
  order: 35,
  banner: MiiBanner,
  bannerImage: '/assets/mii/banner.png',
  bannerVideo: '/assets/mii/banner.webm',
  bannerMusic: '/assets/mii/banner-music.mp3',
  mount: reactMount(MiiApp),
  players: { min: 1, max: 4 },
});
