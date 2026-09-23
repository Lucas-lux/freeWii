import { defineChannel, reactMount } from '../../core';
import { PartyBanner } from './Banner';
import { PartyApp } from './PartyApp';
import './party.css';

/**
 * freeParty: quick party games for 1–4 remotes (shake races, whack-a-mole, reflex duels,
 * balloon push-your-luck, Simon). Optional assets live in public/assets/party/.
 */
export default defineChannel({
  id: 'party',
  title: 'freeParty',
  description: 'Five quick party games: shake, whack, react, inflate and memorise. Best with friends.',
  author: 'freeWii',
  version: '1.0.0',
  order: 40,
  banner: PartyBanner,
  bannerImage: '/assets/party/banner.png',
  bannerVideo: '/assets/party/banner.webm',
  bannerMusic: '/assets/party/banner-music.mp3',
  mount: reactMount(PartyApp),
  players: { min: 1, max: 4 },
});
