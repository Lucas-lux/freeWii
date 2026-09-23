import { useState } from 'react';
import { useButton, useInputEvent, usePlayers, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, type CanvasGame } from '../_shared/MiniGame';
import { contestants, drawGuy, ranked, type Contestant } from './shared';

interface Runner {
  c: Contestant;
  score: number;
  energy: number;
  last: number;
}

const DURATION = 10;

/** Shake the remote as many times as you can in ten seconds. */
class ShakeGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'over' = 'ready';
  countdown = 3;
  time = DURATION;
  runners: Runner[] = [];
  private lastTick = -1;
  private t = 0;

  start(list: Contestant[]): void {
    this.phase = 'ready';
    this.countdown = 3;
    this.time = DURATION;
    this.runners = list.map((c) => ({ c, score: 0, energy: 0, last: 0 }));
    this.lastTick = -1;
    this.hudDirty = true;
  }

  shake(id: string, now: number): void {
    if (this.phase !== 'play') return;
    const r = this.runners.find((x) => x.c.id === id);
    if (!r || now - r.last < 90) return;
    r.last = now;
    r.score += 1;
    r.energy = 1;
    this.hudDirty = true;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.phase === 'ready') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastTick && c > 0) {
        this.lastTick = c;
        this.events.push('tick');
        this.hudDirty = true;
      }
      if (this.countdown <= 0) {
        this.phase = 'play';
        this.events.push('go');
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase !== 'play') return;
    this.time -= dt;
    for (const r of this.runners) r.energy = Math.max(0, r.energy - dt * 3);
    if (Math.ceil(this.time) !== this.lastTick) {
      this.lastTick = Math.ceil(this.time);
      this.hudDirty = true;
    }
    if (this.time <= 0) {
      this.time = 0;
      this.phase = 'over';
      this.events.push('over');
      this.hudDirty = true;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ffb74d');
    bg.addColorStop(1, '#ff7043');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const best = Math.max(30, ...this.runners.map((r) => r.score));
    const n = this.runners.length;
    const laneH = Math.min(H * 0.18, (H * 0.7) / Math.max(1, n));
    const top = H * 0.5 - (laneH * n) / 2 + H * 0.05;
    this.runners.forEach((r, i) => {
      const y = top + laneH * (i + 0.5);
      const shakeAmt = r.energy;
      const wob = Math.sin(this.t * 60 + i) * 0.35 * shakeAmt;
      drawGuy(g, W * 0.14 + Math.sin(this.t * 80) * W * 0.008 * shakeAmt, y + laneH * 0.1, laneH * 0.55, r.c.color, {
        wobble: wob,
        face: shakeAmt > 0.5 ? 'shout' : 'smile',
        arms: shakeAmt,
      });
      const bx = W * 0.24, bw = W * 0.64, bh = laneH * 0.42;
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.roundRect(bx, y - bh / 2, bw, bh, bh / 2);
      g.fill();
      g.fillStyle = r.c.color;
      g.beginPath();
      g.roundRect(bx, y - bh / 2, Math.max(bh, bw * Math.min(1, r.score / best)), bh, bh / 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `900 ${bh * 0.7}px Nunito, sans-serif`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(`${r.c.name} · ${r.score}`, bx + bh * 0.5, y);
    });
  }
}

export function Shake({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const players = usePlayers();
  const [game] = useState(() => {
    const g = new ShakeGame();
    g.start(contestants(players));
    return g;
  });
  useInputEvent('motion', ({ remote, sample }) => {
    if (remote.kind !== 'phone') return;
    const a = sample.accel;
    if (Math.hypot(a.x, a.y, a.z) > 11) game.shake(remote.id, performance.now());
  });
  useInputEvent('swing', ({ remote }) => {
    if (remote.kind !== 'phone') game.shake(remote.id, performance.now());
  });
  useButton('a', () => {
    if (game.phase === 'over') game.start(contestants(players));
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { tick: 'countdown', go: 'go', over: 'timeup' };
  const top = ranked(game.runners);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Shake the remote as fast as you can (mouse: tap S) · ten seconds"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{Math.ceil(game.time)}</div>
              <div className="mg-label">seconds</div>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small="Get ready to shake!" big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'over' && (
            <Results
              title={top.length > 1 ? `${top[0].c.name} wins!` : 'Time!'}
              rating={top[0] && top[0].score >= 60 ? 'Earthquake!' : top[0] && top[0].score >= 35 ? 'Shaky' : 'Gentle breeze'}
              rows={top.map((r) => ({ label: r.c.name, value: `${r.score} shakes`, color: r.c.color }))}
              onAgain={() => game.start(contestants(players))}
            />
          )}
        </>
      )}
    />
  );
}
