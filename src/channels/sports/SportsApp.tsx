import { useEffect, useState } from 'react';
import { Pill, useButton, usePlayers, type ChannelContext } from '../../core';
import { SPORTS_MENU_MUSIC, SPORTS_SFX } from './assets';
import { Baseball } from './Baseball';
import { Bowling } from './Bowling';
import { Boxing } from './Boxing';
import { Golf } from './Golf';
import { Tennis } from './Tennis';

type GameProps = { ctx: ChannelContext; onQuit(): void };

/** The five sports. Add one: write a component, push it here. */
const SPORTS: { id: string; name: string; icon: string; Component: (p: GameProps) => JSX.Element }[] = [
  { id: 'tennis', name: 'Tennis', icon: '🎾', Component: Tennis },
  { id: 'baseball', name: 'Baseball', icon: '⚾', Component: Baseball },
  { id: 'bowling', name: 'Bowling', icon: '🎳', Component: Bowling },
  { id: 'golf', name: 'Golf', icon: '⛳', Component: Golf },
  { id: 'boxing', name: 'Boxing', icon: '🥊', Component: Boxing },
];

/** Sport selection screen. */
export function SportsApp({ ctx }: { ctx: ChannelContext }) {
  const [sport, setSport] = useState<string | null>(null);
  const players = usePlayers();

  useEffect(() => {
    void ctx.audio.registerSamples('sports', SPORTS_SFX);
    ctx.audio.playMusic(SPORTS_MENU_MUSIC);
  }, [ctx]);

  useButton('b', () => {
    if (!sport) ctx.exit();
  });

  const current = SPORTS.find((s) => s.id === sport);
  if (current) {
    const Component = current.Component;
    return (
      <Component
        ctx={ctx}
        onQuit={() => {
          ctx.audio.playMusic(SPORTS_MENU_MUSIC);
          setSport(null);
        }}
      />
    );
  }

  return (
    <div className="sports-menu">
      <h1>
        free<b>Sports</b>
      </h1>
      <div className="sports-grid">
        {SPORTS.map((s) => (
          <Pill key={s.id} wide clickSound="start" onClick={() => setSport(s.id)}>
            {s.icon} {s.name}
          </Pill>
        ))}
      </div>
      <div className="sports-foot">
        <Pill onClick={() => ctx.exit()} clickSound="back">
          Wii Menu
        </Pill>
        <span>
          {players.length} player{players.length > 1 ? 's' : ''} ready · connect more phones from the Wii Menu
        </span>
      </div>
    </div>
  );
}
