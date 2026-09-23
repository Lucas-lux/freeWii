import { defineChannel, reactMount } from '../../core';
import { HomebrewBanner } from './Banner';
import { HomebrewApp } from './HomebrewApp';
import './homebrew.css';

/**
 * The secret channel. It stays out of the Wii Menu until the LetterBomb letter on the Message Board
 * goes off (`window.freewii.unlockChannel('homebrew')`). Ships one homebrew game: Brick Breaker.
 */
export default defineChannel({
  id: 'homebrew',
  title: 'Homebrew Channel',
  description: 'A channel that was never meant to ship. Brick Breaker inside.',
  author: 'freeWii',
  version: '1.0.0',
  order: 99,
  secret: true,
  banner: HomebrewBanner,
  bannerImage: '/assets/homebrew/banner.png',
  bannerVideo: '/assets/homebrew/banner.webm',
  bannerMusic: '/assets/homebrew/banner-music.mp3',
  mount: reactMount(HomebrewApp),
  players: { min: 1, max: 4 },
});
