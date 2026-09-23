import { defineChannel, reactMount } from '../../core';
import { VoteBanner } from './Banner';
import { VoteApp } from './VoteApp';
import './vote.css';

/**
 * freeVote: silly questions, everyone votes with their remote, then predicts what the crowd
 * picked. Optional assets live in public/assets/vote/.
 */
export default defineChannel({
  id: 'vote',
  title: 'freeVote',
  description: 'Everybody votes: answer silly questions, then guess what the crowd said.',
  author: 'freeWii',
  version: '1.0.0',
  order: 60,
  banner: VoteBanner,
  bannerImage: '/assets/vote/banner.png',
  bannerVideo: '/assets/vote/banner.webm',
  bannerMusic: '/assets/vote/banner-music.mp3',
  mount: reactMount(VoteApp),
  players: { min: 1, max: 4 },
});
