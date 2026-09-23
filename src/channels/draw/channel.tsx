import { defineChannel, reactMount } from '../../core';
import { DrawBanner } from './Banner';
import { DrawApp } from './DrawApp';
import './draw.css';

/**
 * freeDraw: a shared whiteboard. Every remote is a crayon: hold A to draw, hold B to erase,
 * pick colours and sizes on the left. Optional assets live in public/assets/draw/.
 */
export default defineChannel({
  id: 'draw',
  title: 'freeDraw',
  description: 'Draw on the TV with the pointer. Everyone connected gets a crayon.',
  author: 'freeWii',
  version: '1.0.0',
  order: 30,
  banner: DrawBanner,
  bannerImage: '/assets/draw/banner.png',
  bannerVideo: '/assets/draw/banner.webm',
  bannerMusic: '/assets/draw/banner-music.mp3',
  mount: reactMount(DrawApp),
  players: { min: 1, max: 4 },
});
