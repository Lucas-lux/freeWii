import { useEffect, useReducer, useRef, useState } from 'react';
import { PLAYER_COLORS, Pill, useAnimationFrame, useImages, useInputEvent, type ChannelContext, type LoopHandle, type Wiimote } from '../../core';
import { BOWLING_IMAGES, RESULTS_MUSIC, SPORTS_MUSIC } from './assets';
import { BowlingGame, scoreFrames, type BowlingEvent, type Phase } from './bowlingGame';
import { renderBowling } from './bowlingRender';

const CRASHES = ['sports.crash1', 'sports.crash2', 'sports.crash3'];

const HINTS: Record<Phase, string> = {
  intro: '',
  aim: '◀ ▶ move · ▲ ▼ angle · hold B, swing your arm back then forward and let go (mouse: hold right button, drag down, flick up · or press S)',
  hold: 'Swing back… then forward! Twist the remote to curve the ball.',
  throw: '',
  rolling: '',
  settle: '',
  result: '',
  sweep: '',
  over: 'Press A to play again',
};

function label(remote: Wiimote): string {
  return remote.kind === 'phone' ? remote.name : `Player ${remote.player}`;
}

function rollMarks(rolls: number[], frame: number): string[] {
  const marks: string[] = [];
  for (let i = 0; i < rolls.length; i++) {
    const r = rolls[i];
    const prev = rolls[i - 1];
    const freshRack = i === 0 || prev === 10 || (frame === 9 && i === 2 && rolls[0] !== 10);
    if (r === 10 && freshRack) marks.push('X');
    else if (!freshRack && prev + r === 10) marks.push('/');
    else marks.push(r === 0 ? '-' : String(r));
  }
  while (marks.length < (frame === 9 ? 3 : 2)) marks.push('');
  return marks;
}

function Scoreboard({ game }: { game: BowlingGame }) {
  return (
    <div className="bowl-score">
      {game.players.map((p, i) => {
        const { perFrame, total } = scoreFrames(p.frames);
        const current = i === game.current && game.phase !== 'over';
        return (
          <div key={i} className={`bowl-row ${current ? 'bowl-row--current' : ''}`}>
            <span className="bowl-name" style={{ color: PLAYER_COLORS[i % 4] }}>
              {p.name}
            </span>
            {Array.from({ length: 10 }, (_, f) => (
              <div key={f} className={`bowl-frame ${f === 9 ? 'bowl-frame--10' : ''} ${current && f === game.frame ? 'bowl-frame--current' : ''}`}>
                <div className="bowl-rolls">
                  {rollMarks(p.frames[f] ?? [], f).map((m, k) => (
                    <span key={k}>{m || ' '}</span>
                  ))}
                </div>
                <div className="bowl-total">{perFrame[f] ?? ' '}</div>
              </div>
            ))}
            <span className="bowl-grand">{total}</span>
          </div>
        );
      })}
    </div>
  );
}

interface Hold {
  remote: Wiimote;
  beta0: number | null;
  y0: number;
}

export function Bowling({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game] = useState(() => new BowlingGame(ctx.players.map(label)));
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const images = useImages(BOWLING_IMAGES);

  useEffect(() => {
    ctx.audio.playMusic(SPORTS_MUSIC);
    ctx.audio.sfx('sports.intro', 'start');
  }, [ctx]);
  const holdRef = useRef<Hold | null>(null);
  const loopRef = useRef<LoopHandle | null>(null);

  const isCurrent = (remote: Wiimote) => {
    const cur = ctx.players[game.current];
    return !cur || cur.id === remote.id;
  };

  useInputEvent('buttondown', ({ remote, button }) => {
    if (ctx.paused || !isCurrent(remote)) return;
    switch (button) {
      case 'left':
        game.moveAim(-0.05);
        break;
      case 'right':
        game.moveAim(0.05);
        break;
      case 'up':
        game.rotateAim(1);
        break;
      case 'down':
        game.rotateAim(-1);
        break;
      case 'b':
        if (game.phase === 'aim') {
          game.startHold();
          holdRef.current = { remote, beta0: remote.orientation?.beta ?? null, y0: remote.pointer.y };
        }
        break;
      case 'a':
        if (game.phase === 'over') {
          game.restart();
          ctx.audio.playMusic(SPORTS_MUSIC);
        }
        break;
    }
  });

  useInputEvent('buttonup', ({ remote, button }) => {
    if (button === 'b' && isCurrent(remote)) {
      game.cancelHold();
      holdRef.current = null;
    }
  });

  // Phone: the arm follows the pitch of the remote while B is held (point up = backswing).
  useInputEvent('motion', ({ remote, sample }) => {
    const h = holdRef.current;
    if (!h || h.remote !== remote || game.phase !== 'hold' || !sample.orientation) return;
    if (h.beta0 === null) {
      h.beta0 = sample.orientation.beta;
      return;
    }
    game.setArm(-(sample.orientation.beta - h.beta0) / 55);
  });

  // Mouse: drag down while holding the right button = backswing, flick up = throw.
  useInputEvent('pointer', ({ remote, pointer }) => {
    const h = holdRef.current;
    if (!h || h.remote !== remote || game.phase !== 'hold' || remote.kind !== 'local') return;
    game.setArm(-(pointer.y - h.y0) / 0.28);
  });

  useInputEvent('swing', ({ remote, swing }) => {
    if (ctx.paused || !isCurrent(remote) || game.phase !== 'hold') return;
    game.release(swing.strength, swing.roll, swing.direction.x);
    holdRef.current = null;
    remote.rumble(90);
  });

  useEffect(
    () =>
      ctx.onResize((w, h) => {
        const c = canvasRef.current;
        if (!c) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }),
    [ctx],
  );

  useEffect(() => () => loopRef.current?.stop(0.1), []);

  const handleEvent = (ev: BowlingEvent) => {
    const a = ctx.audio;
    switch (ev) {
      case 'intro':
        a.sfx('sports.turn', 'stage');
        break;
      case 'throw':
        a.sfx('sports.throw', 'throw');
        break;
      case 'crash':
        a.sfx(CRASHES[Math.floor(Math.random() * CRASHES.length)], 'crash');
        break;
      case 'gutter':
        a.sfx('sports.gutter', 'fail');
        break;
      case 'strike':
        a.sfx('sports.strike', 'strike');
        break;
      case 'spare':
        a.sfx('sports.spare', 'success');
        break;
      case 'cheer':
        a.sfx('sports.cheer', 'cheer');
        break;
      case 'aww':
        a.sfx('sports.aww', 'aww');
        break;
      case 'sweep':
        a.sfx('sports.sweep', 'sweep');
        break;
      case 'over':
        a.playMusic(RESULTS_MUSIC);
        break;
      case 'roll':
        break;
    }
  };

  const powerRef = useRef<HTMLElement>(null);

  useAnimationFrame((dt) => {
    if (!ctx.paused) game.update(dt);
    for (const ev of game.events.splice(0)) handleEvent(ev);
    const rolling = game.phase === 'rolling' || game.phase === 'settle';
    if (rolling && !loopRef.current) loopRef.current = ctx.audio.startLoop('sports.roll', { synth: 'roll', gain: 0.2 });
    if (!rolling && loopRef.current) {
      loopRef.current.stop(0.3);
      loopRef.current = null;
    }
    if (loopRef.current) loopRef.current.setGain(game.ball.active ? 0.05 + Math.min(0.3, game.ball.vz / 30) : 0.02);
    if (powerRef.current) powerRef.current.style.height = `${Math.max(0, -game.arm) * 50}%`;
    if (game.hudDirty) {
      game.hudDirty = false;
      refresh();
    }
    const c = canvasRef.current;
    const g2 = c?.getContext('2d');
    if (!c || !g2) return;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    const color = PLAYER_COLORS[game.current % 4];
    renderBowling(g2, game, c.width, c.height, { ballColor: color, shirtColor: color }, images);
  });

  const ranking = game.players
    .map((p) => ({ name: p.name, total: scoreFrames(p.frames).total }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="bowl">
      <canvas ref={canvasRef} className="bowl-canvas" />
      <Scoreboard game={game} />
      {game.phase === 'intro' && (
        <div className="bowl-intro" key={`${game.current}-${game.frame}`}>
          <div className="bowl-intro-name">{game.player.name}</div>
          <div className="bowl-intro-frame">Frame {game.frame + 1}</div>
        </div>
      )}
      {game.message && (
        <div className="bowl-msg" key={`${game.message}-${game.frame}-${game.current}`}>
          {game.message}
        </div>
      )}
      {(game.phase === 'hold' || game.phase === 'throw') && (
        <div className="bowl-power">
          <i ref={powerRef} />
          <b />
        </div>
      )}
      <div className="bowl-hint">{HINTS[game.phase]}</div>
      {game.phase === 'over' && (
        <div className="bowl-over">
          <h2>Game over</h2>
          <table>
            <tbody>
              {ranking.map((p, i) => (
                <tr key={p.name + i}>
                  <td style={{ color: PLAYER_COLORS[game.players.findIndex((q) => q.name === p.name) % 4] }}>{p.name}</td>
                  <td>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pill
            onClick={() => {
              game.restart();
              ctx.audio.playMusic(SPORTS_MUSIC);
            }}
            clickSound="start"
          >
            Play again (A)
          </Pill>
        </div>
      )}
      <Pill small className="bowl-quit" onClick={onQuit} clickSound="back">
        Quit
      </Pill>
    </div>
  );
}
