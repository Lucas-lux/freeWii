import { useEffect, useState } from 'react';
import { Pill, useButton, useHot, usePlayers, type ChannelContext, type MusicRequest } from '../../core';
import { Bubbles } from './Banner';
import { Bricks } from './Bricks';

const MUSIC: MusicRequest = { url: '/assets/homebrew/music/loop.mp3', synth: 'play', fade: 0.8 };
const GAME_MUSIC: MusicRequest = { url: '/assets/homebrew/music/bricks.mp3', synth: 'sports', fade: 0.6 };

type AppProps = { ctx: ChannelContext; onQuit(): void };

/** The "homebrew apps". Add one: write a component, push it here. */
const APPS: { id: string; name: string; version: string; author: string; icon: string; blurb: string; Component: (p: AppProps) => JSX.Element }[] = [
  { id: 'bricks', name: 'Brick Breaker', version: '1.0', author: 'freeWii', icon: '🧱', blurb: 'Point to move the paddle, press A to launch. Power-ups fall, every remote gets a paddle. Three levels.', Component: Bricks },
];

function Entry({ app, onLoad }: { app: (typeof APPS)[number]; onLoad(): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onLoad, clickSound: 'start' });
  return (
    <div ref={ref} className={`hb-entry ${hovered ? 'hb-entry--hover' : ''}`}>
      <div className="hb-icon">{app.icon}</div>
      <div className="hb-meta">
        <h3>{app.name}</h3>
        <small>
          v{app.version} · {app.author}
        </small>
        <p>{app.blurb}</p>
      </div>
      <Pill small onClick={onLoad} clickSound="start">
        Load
      </Pill>
    </div>
  );
}

/** Looks like the old launcher: a dark tank of bubbles and a list of apps to load. */
export function HomebrewApp({ ctx }: { ctx: ChannelContext }) {
  const [app, setApp] = useState<string | null>(null);
  const players = usePlayers();

  useEffect(() => {
    if (!app) ctx.audio.playMusic(MUSIC);
    else ctx.audio.playMusic(GAME_MUSIC);
  }, [ctx, app]);

  useButton('b', () => {
    if (!app) ctx.exit();
  });

  const current = APPS.find((a) => a.id === app);
  if (current) {
    const Component = current.Component;
    return <Component ctx={ctx} onQuit={() => setApp(null)} />;
  }

  return (
    <div className="hb-app">
      <Bubbles />
      <div className="hb-head">
        <span>
          <b>Homebrew Channel</b> · freeWii edition
        </span>
        <span>
          {APPS.length} app{APPS.length > 1 ? 's' : ''} · {players.length} player{players.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="hb-list">
        {APPS.map((a) => (
          <Entry key={a.id} app={a} onLoad={() => setApp(a.id)} />
        ))}
      </div>
      <div className="hb-foot">
        <Pill onClick={() => ctx.exit()} clickSound="back">
          Wii Menu
        </Pill>
        <span>You found the secret. Apps live in src/channels/homebrew/, add your own.</span>
      </div>
    </div>
  );
}
