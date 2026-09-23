import { useEffect, useReducer, useRef, useState } from 'react';
import { PLAYER_COLORS, Pill, useAnimationFrame, useImages, useInputEvent, type ChannelContext, type LoopHandle, type Wiimote } from '../../core';
import { PLAY_RANGE_MUSIC, PLAY_RESULTS_MUSIC, RANGE_IMAGES } from './assets';
import { RangeGame, STAGES, type RangeEvent } from './range';
import { renderRange } from './rangeRender';

function shooterOf(remote: Wiimote) {
  return {
    id: remote.id,
    name: remote.kind === 'phone' ? remote.name : `Player ${remote.player}`,
    color: PLAYER_COLORS[(remote.player - 1) % 4] ?? '#3b82f6',
  };
}

export function ShootingRange({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game] = useState(() => new RangeGame(ctx.players.map(shooterOf)));
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const images = useImages(RANGE_IMAGES);
  const humRef = useRef<LoopHandle | null>(null);

  // The game draws its own crosshairs. No background loop in the original range: only round jingles.
  useEffect(() => {
    ctx.audio.playMusic(PLAY_RANGE_MUSIC);
    ctx.setCursorVisible(false);
    return () => {
      ctx.setCursorVisible(true);
      humRef.current?.stop(0.1);
    };
  }, [ctx]);

  useInputEvent('buttondown', ({ remote, button }) => {
    if (ctx.paused || (button !== 'a' && button !== 'b')) return;
    if (game.phase === 'over') {
      if (button === 'a') {
        game.start();
        ctx.audio.playMusic(PLAY_RANGE_MUSIC);
      }
      return;
    }
    game.addShooter(shooterOf(remote));
    const result = game.shoot(remote.id, remote.pointer.x, remote.pointer.y);
    if (result === 'hit') remote.rumble(40);
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

  const handleEvent = (ev: RangeEvent) => {
    const a = ctx.audio;
    switch (ev) {
      case 'shot':
        a.sfx('play.shot', 'shot');
        break;
      case 'pop':
        a.sfx('play.pop', 'pop');
        break;
      case 'clay':
        a.sfx('play.clay', 'clay');
        break;
      case 'ping':
        a.sfx('play.can', 'ping');
        break;
      case 'hit':
        a.sfx('play.can', 'hit');
        break;
      case 'quack':
        a.sfx('play.quack', 'quack');
        break;
      case 'miss':
        a.sfx('play.miss', 'tick');
        break;
      case 'ufo':
        a.sfx('play.ufo', 'ufo');
        break;
      case 'ufohit':
        a.sfx('play.ufohit', 'hit');
        break;
      case 'stage': {
        const i = game.stageIndex;
        a.sfx(i === 0 ? 'play.roundFirst' : i === STAGES.length - 1 ? 'play.roundFinal' : 'play.roundNext', 'stage');
        break;
      }
      case 'bonus':
        a.sfx('play.bonus', 'success');
        break;
      case 'start':
        a.sfx('play.go', 'go');
        break;
      case 'tick':
        a.sfx('play.countdown', 'countdown');
        break;
      case 'over':
        a.sfx('play.timeup', 'timeup');
        a.playMusic(PLAY_RESULTS_MUSIC);
        break;
    }
  };

  useAnimationFrame((dt) => {
    if (!ctx.paused) game.update(dt);
    for (const ev of game.events.splice(0)) handleEvent(ev);
    const ufo = game.phase === 'play' && game.ufoAlive;
    if (ufo && !humRef.current) humRef.current = ctx.audio.startLoop('play.ufo-hum', { synth: 'hum', gain: 0.12 });
    if (!ufo && humRef.current) {
      humRef.current.stop(0.3);
      humRef.current = null;
    }
    if (game.hudDirty) {
      game.hudDirty = false;
      refresh();
    }
    const c = canvasRef.current;
    const g2 = c?.getContext('2d');
    if (!c || !g2) return;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    const pointers = ctx.input.remotes.map((r) => {
      const s = game.shooters.find((sh) => sh.id === r.id);
      return {
        x: r.pointer.x,
        y: r.pointer.y,
        onScreen: r.pointer.onScreen,
        color: PLAYER_COLORS[(r.player - 1) % 4] ?? '#3b82f6',
        player: r.player,
        recoil: s ? s.flashT / 0.12 : 0,
      };
    });
    renderRange(g2, game, c.width, c.height, pointers, images);
  });

  const ranking = [...game.shooters].sort((a, b) => b.score - a.score);
  const hint =
    game.phase === 'play'
      ? `Point and press B to shoot · ${game.stage.kind === 'can' ? 'cans take two hits' : game.stage.kind === 'ufo' ? 'the UFO takes three hits' : 'combos add bonus points'}`
      : game.phase === 'ready'
        ? 'Get ready…'
        : '';

  return (
    <div className="range">
      <canvas ref={canvasRef} className="range-canvas" />
      <div className="range-hud">
        <div>
          <div className="range-time">{game.phase === 'over' ? 0 : Math.ceil(game.remaining)}</div>
          <div className="range-round">
            Round {game.stageIndex + 1}/{STAGES.length} · {game.stage.title}
          </div>
        </div>
        <div className="range-scores">
          {game.shooters.map((s) => (
            <div key={s.id} className="range-score" style={{ borderColor: s.color }}>
              {s.score}
              <small>
                {s.name}
                {s.combo > 1 ? ` · combo ×${s.combo}` : ''}
              </small>
            </div>
          ))}
        </div>
      </div>
      {game.phase === 'ready' && (
        <div className="range-center" key={Math.ceil(game.countdown)}>
          {Math.ceil(game.countdown)}
        </div>
      )}
      {game.phase === 'stage' && (
        <div className="range-stage" key={game.stageIndex}>
          <div className="range-stage-round">Round {game.stageIndex + 1}</div>
          <div className="range-stage-title">{game.stage.title}</div>
        </div>
      )}
      {game.phase === 'over' && (
        <div className="range-over">
          <h2>Time's up!</h2>
          <div className="range-rating">{game.rating()}</div>
          <table>
            <tbody>
              {ranking.map((s) => (
                <tr key={s.id}>
                  <td style={{ color: s.color }}>{s.name}</td>
                  <td>
                    {s.hits}/{s.shots} hits · best combo ×{s.bestCombo}
                  </td>
                  <td>{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pill
            onClick={() => {
              game.start();
              ctx.audio.playMusic(PLAY_RANGE_MUSIC);
            }}
            clickSound="start"
          >
            Play again (A)
          </Pill>
        </div>
      )}
      <div className="range-hint">{hint}</div>
      <Pill small className="range-quit" onClick={onQuit} clickSound="back">
        Quit
      </Pill>
    </div>
  );
}
