import { useEffect, useState } from 'react';
import { Pill, useButton, usePlayers, type ChannelContext, type MusicRequest } from '../../core';
import { Balloon } from './Balloon';
import { Mole } from './Mole';
import { Reflex } from './Reflex';
import { Shake } from './Shake';
import { Simon } from './Simon';

export const PARTY_MENU_MUSIC: MusicRequest = { url: '/assets/party/music/menu.mp3', synth: 'play', fade: 0.8 };
export const PARTY_GAME_MUSIC: MusicRequest = { url: '/assets/party/music/game.mp3', synth: 'sports', fade: 0.6 };
export const PARTY_RESULTS_MUSIC: MusicRequest = { url: '/assets/party/music/results.mp3', synth: 'results', fade: 0.5 };

type GameProps = { ctx: ChannelContext; onQuit(): void };

/** The party games. Add one: write a component, push it here. */
const GAMES: { id: string; name: string; icon: string; blurb: string; Component: (p: GameProps) => JSX.Element }[] = [
  { id: 'shake', name: 'Shake It!', icon: '🫨', blurb: 'shake the remote like crazy', Component: Shake },
  { id: 'mole', name: 'Whack-a-Mole', icon: '🔨', blurb: 'point and bonk', Component: Mole },
  { id: 'reflex', name: 'Reflex', icon: '⚡', blurb: 'first to press A on green', Component: Reflex },
  { id: 'balloon', name: 'Balloon', icon: '🎈', blurb: 'inflate, but not too much', Component: Balloon },
  { id: 'simon', name: 'Simon', icon: '🎨', blurb: 'repeat the colours', Component: Simon },
];

/** Party game selection screen. */
export function PartyApp({ ctx }: { ctx: ChannelContext }) {
  const [game, setGame] = useState<string | null>(null);
  const players = usePlayers();

  useEffect(() => {
    ctx.audio.playMusic(PARTY_MENU_MUSIC);
  }, [ctx]);

  useButton('b', () => {
    if (!game) ctx.exit();
  });

  const current = GAMES.find((g) => g.id === game);
  if (current) {
    const Component = current.Component;
    return (
      <Component
        ctx={ctx}
        onQuit={() => {
          ctx.audio.playMusic(PARTY_MENU_MUSIC);
          setGame(null);
        }}
      />
    );
  }

  return (
    <div className="party-menu">
      <h1>
        free<b>Party</b>
      </h1>
      <div className="party-grid">
        {GAMES.map((g) => (
          <Pill key={g.id} clickSound="start" onClick={() => setGame(g.id)}>
            <span className="party-icon">{g.icon}</span>
            <span className="party-name">
              {g.name}
              <small>{g.blurb}</small>
            </span>
          </Pill>
        ))}
      </div>
      <div className="party-foot">
        <Pill onClick={() => ctx.exit()} clickSound="back">
          Wii Menu
        </Pill>
        <span>
          {players.length} player{players.length > 1 ? 's' : ''} ready · every remote plays at once
        </span>
      </div>
    </div>
  );
}
