import { useEffect, useState } from 'react';
import { Pill, useButton, usePlayers, type ChannelContext } from '../../core';
import { PLAY_MENU_MUSIC, PLAY_SFX } from './assets';
import { Billiards } from './Billiards';
import { Charge } from './Charge';
import { Fishing } from './Fishing';
import { LaserHockey } from './LaserHockey';
import { PoseMii } from './PoseMii';
import { ShootingRange } from './ShootingRange';
import { TableTennis } from './TableTennis';
import { Tanks } from './Tanks';

type GameProps = { ctx: ChannelContext; onQuit(): void };

/** The mini-games. Add one: write a component, push it here. */
const GAMES: { id: string; name: string; icon: string; Component: (p: GameProps) => JSX.Element }[] = [
  { id: 'range', name: 'Shooting Range', icon: '🎯', Component: ShootingRange },
  { id: 'tabletennis', name: 'Table Tennis', icon: '🏓', Component: TableTennis },
  { id: 'posemii', name: 'Pose Mii', icon: '🫧', Component: PoseMii },
  { id: 'hockey', name: 'Laser Hockey', icon: '🏒', Component: LaserHockey },
  { id: 'billiards', name: 'Billiards', icon: '🎱', Component: Billiards },
  { id: 'fishing', name: 'Fishing', icon: '🎣', Component: Fishing },
  { id: 'charge', name: 'Charge!', icon: '🐄', Component: Charge },
  { id: 'tanks', name: 'Tanks!', icon: '🪖', Component: Tanks },
];

/** Mini-game selection screen. */
export function PlayApp({ ctx }: { ctx: ChannelContext }) {
  const [game, setGame] = useState<string | null>(null);
  const players = usePlayers();

  useEffect(() => {
    void ctx.audio.registerSamples('play', PLAY_SFX);
    ctx.audio.playMusic(PLAY_MENU_MUSIC);
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
          ctx.audio.playMusic(PLAY_MENU_MUSIC);
          setGame(null);
        }}
      />
    );
  }

  return (
    <div className="play-menu">
      <h1>
        free<b>Play</b>
      </h1>
      <div className="play-grid play-grid--3">
        {GAMES.map((g) => (
          <Pill key={g.id} clickSound="start" onClick={() => setGame(g.id)}>
            {g.icon} {g.name}
          </Pill>
        ))}
      </div>
      <div className="play-foot">
        <Pill onClick={() => ctx.exit()} clickSound="back">
          Wii Menu
        </Pill>
        <span>
          {players.length} player{players.length > 1 ? 's' : ''} ready · everyone gets a pointer
        </span>
      </div>
    </div>
  );
}
