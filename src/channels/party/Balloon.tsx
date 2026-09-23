import { useState } from 'react';
import { useInputEvent, usePlayers, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';
import { contestants, drawGuy, ranked, type Contestant } from './shared';

interface Blower {
  c: Contestant;
  size: number;
  limit: number;
  holding: boolean;
  popped: boolean;
  banked: number;
  score: number;
  shreds: number;
}

const ROUNDS = 3;
const ROUND_TIME = 10;

/** Hold A to inflate your balloon, let go before it pops. Biggest banked balloon wins. */
class BalloonGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'between' | 'over' = 'ready';
  round = 1;
  time = ROUND_TIME;
  countdown = 3;
  blowers: Blower[] = [];
  private timer = 0;
  private lastTick = -1;
  private t = 0;

  start(list: Contestant[]): void {
    this.blowers = list.map((c) => ({ c, size: 0, limit: 1, holding: false, popped: false, banked: 0, score: 0, shreds: 0 }));
    this.round = 1;
    this.startRound();
  }

  private startRound(): void {
    for (const b of this.blowers) {
      b.size = 0;
      b.limit = rand(0.5, 1);
      b.holding = false;
      b.popped = false;
      b.banked = 0;
      b.shreds = 0;
    }
    this.time = ROUND_TIME;
    this.countdown = 3;
    this.lastTick = -1;
    this.phase = 'ready';
    this.hudDirty = true;
  }

  hold(id: string, down: boolean): void {
    if (this.phase !== 'play') return;
    const b = this.blowers.find((x) => x.c.id === id);
    if (!b || b.popped || b.banked > 0) return;
    if (down) b.holding = true;
    else if (b.holding) {
      b.holding = false;
      b.banked = b.size;
      b.score += Math.round(b.size * 100);
      this.events.push('bank');
      this.hudDirty = true;
    }
  }

  puff(id: string): void {
    if (this.phase !== 'play') return;
    const b = this.blowers.find((x) => x.c.id === id);
    if (b && !b.popped && b.banked === 0) this.inflate(b, 0.05);
  }

  private inflate(b: Blower, amount: number): void {
    b.size += amount;
    if (b.size >= b.limit) {
      b.size = b.limit;
      b.popped = true;
      b.holding = false;
      b.shreds = 1;
      this.events.push('pop');
      this.hudDirty = true;
    }
  }

  update(dt: number): void {
    this.t += dt;
    for (const b of this.blowers) b.shreds = Math.max(0, b.shreds - dt);
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
    } else if (this.phase === 'play') {
      this.time -= dt;
      for (const b of this.blowers) if (b.holding) this.inflate(b, dt * 0.2 * (1 + b.size * 0.6));
      if (Math.ceil(this.time) !== this.lastTick) {
        this.lastTick = Math.ceil(this.time);
        this.hudDirty = true;
      }
      const settled = this.blowers.every((b) => b.popped || b.banked > 0);
      if (this.time <= 0 || settled) {
        // still holding when the whistle blows: greedy, it pops
        for (const b of this.blowers) if (b.holding) this.inflate(b, 1);
        this.phase = 'between';
        this.timer = 2.4;
        this.hudDirty = true;
      }
    } else if (this.phase === 'between') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.round >= ROUNDS) {
          this.phase = 'over';
          this.events.push('over');
          this.hudDirty = true;
        } else {
          this.round += 1;
          this.startRound();
        }
      }
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#81d4fa');
    bg.addColorStop(1, '#e1f5fe');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#8bc34a';
    g.fillRect(0, H * 0.82, W, H * 0.18);
    const n = this.blowers.length;
    this.blowers.forEach((b, i) => {
      const x = (W * (i + 0.5)) / n;
      const gy = H * 0.86;
      drawGuy(g, x, gy, H * 0.14, b.c.color, { face: b.popped ? 'sad' : b.holding ? 'shout' : b.banked > 0 ? 'smile' : 'wow', arms: b.holding ? 0.4 : 0 });
      const r = H * 0.04 + b.size * H * 0.24;
      const by = gy - H * 0.2 - r;
      if (b.popped) {
        if (b.shreds > 0) {
          g.fillStyle = b.c.color;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2, d = (1 - b.shreds) * r * 2.5;
            g.beginPath();
            g.ellipse(x + Math.cos(a) * d, by + Math.sin(a) * d, r * 0.18, r * 0.08, a, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.fillStyle = '#b71c1c';
        g.font = `900 ${H * 0.05}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.fillText('POP!', x, gy - H * 0.32);
      } else {
        const wob = b.holding ? Math.sin(this.t * 40) * r * 0.03 : 0;
        g.strokeStyle = '#555';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, gy - H * 0.16);
        g.lineTo(x + wob, by + r);
        g.stroke();
        const grad = g.createRadialGradient(x - r * 0.35, by - r * 0.35, r * 0.1, x, by, r);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.15, b.c.color);
        grad.addColorStop(1, b.c.color);
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(x + wob, by, r, r * 1.12, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#333';
        g.font = `900 ${H * 0.04}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.fillText(b.banked > 0 ? `✓ ${Math.round(b.banked * 100)} cm` : `${Math.round(b.size * 100)} cm`, x, by - r * 1.12 - H * 0.02);
      }
    });
  }
}

export function Balloon({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const players = usePlayers();
  const [game] = useState(() => {
    const g = new BalloonGame();
    g.start(contestants(players));
    return g;
  });
  useInputEvent('buttondown', ({ remote, button }) => {
    if (button !== 'a') return;
    if (game.phase === 'over') game.start(contestants(players));
    else game.hold(remote.id, true);
  });
  useInputEvent('buttonup', ({ remote, button }) => {
    if (button === 'a') game.hold(remote.id, false);
  });
  useInputEvent('swing', ({ remote }) => game.puff(remote.id));
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { tick: 'countdown', go: 'go', pop: 'crash', bank: 'success', over: 'cheer' };
  const top = ranked(game.blowers);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Hold A to inflate (shakes add air) · release before it pops to bank the size · still holding at 0 s = pop · three rounds"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{Math.max(0, Math.ceil(game.time))}</div>
              <div className="mg-label">round {game.round}/{ROUNDS}</div>
            </div>
            <div className="mg-scores">
              {game.blowers.map((b) => (
                <div key={b.c.id} className="mg-score" style={{ borderColor: b.c.color }}>
                  {b.score}
                  <small>{b.c.name}</small>
                </div>
              ))}
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small={`Round ${game.round}`} big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'over' && (
            <Results title={top.length > 1 ? `${top[0].c.name} wins!` : 'Done!'} rating={top[0] && top[0].score >= 220 ? 'Hot air champion' : 'Nice lungs'} rows={top.map((b) => ({ label: b.c.name, value: `${b.score} cm`, color: b.c.color }))} onAgain={() => game.start(contestants(players))} />
          )}
        </>
      )}
    />
  );
}
