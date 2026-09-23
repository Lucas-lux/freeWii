import { useState } from 'react';
import { useButton, useInputEvent, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

/**
 * Solo: return the ball as many times as you can, it speeds up. Two remotes: a duel, the far paddle
 * is the second player and every miss is a point for the other side (first to 7).
 */
class TableTennisGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'over' = 'ready';
  rally = 0;
  best = 0;
  countdown = 2;
  versus = false;
  score = { p1: 0, p2: 0 };
  paddleX = 0;
  ball = { x: 0, z: 0.5, dir: 1, speed: 0.9, fromX: 0, toX: 0, t: 0 };
  oppX = 0;
  private trail: { x: number; z: number }[] = [];

  start(versus = false): void {
    this.versus = versus;
    this.score = { p1: 0, p2: 0 };
    this.phase = 'ready';
    this.countdown = 2;
    this.rally = 0;
    this.serve(1);
    this.hudDirty = true;
  }

  setOpponent(nx: number): void {
    if (this.versus) this.oppX = Math.max(-1.1, Math.min(1.1, (nx - 0.5) * 2.6));
  }

  private point(winner: 'p1' | 'p2'): void {
    this.score[winner] += 1;
    this.rally = 0;
    this.events.push('miss');
    if (this.score[winner] >= 7) {
      this.phase = 'over';
      this.events.push('over');
    } else {
      this.phase = 'ready';
      this.countdown = 1.2;
      this.serve(winner === 'p1' ? 1 : -1);
    }
    this.hudDirty = true;
  }

  private serve(dir: number): void {
    const b = this.ball;
    b.dir = dir;
    b.z = dir === 1 ? 0.02 : 0.98;
    b.fromX = dir === 1 ? this.paddleX : this.oppX;
    // the first serve comes back close to the paddle, the rally opens up afterwards
    b.toX = dir === 1 ? rand(-0.75, 0.75) : Math.max(-0.8, Math.min(0.8, this.paddleX + rand(-0.3, 0.3)));
    b.t = 0;
    b.x = b.fromX;
  }

  setPaddle(nx: number): void {
    this.paddleX = Math.max(-1.1, Math.min(1.1, (nx - 0.5) * 2.6));
  }

  update(dt: number): void {
    if (this.phase === 'ready') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'play';
        this.ball.speed = this.versus ? 1.1 : 0.9;
        this.events.push('go');
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase !== 'play') return;
    const b = this.ball;
    b.t += dt * b.speed;
    b.z += b.dir * dt * b.speed;
    b.x = b.fromX + (b.toX - b.fromX) * Math.min(1, b.t);
    if (!this.versus) this.oppX += (b.x - this.oppX) * Math.min(1, dt * 6);
    this.trail.push({ x: b.x, z: b.z });
    if (this.trail.length > 8) this.trail.shift();
    if (b.dir === 1 && b.z >= 1) {
      if (this.versus && Math.abs(this.oppX - b.x) >= 0.24) return this.point('p1');
      // the CPU always returns, with some angle
      b.dir = -1;
      b.z = 0.98;
      b.fromX = b.x;
      b.toX = rand(-0.85, 0.85);
      b.t = 0;
      this.events.push('opp');
    } else if (b.dir === -1 && b.z <= 0) {
      if (Math.abs(this.paddleX - b.x) < 0.24) {
        this.rally += 1;
        b.speed = Math.min(2.6, b.speed * 1.035);
        b.dir = 1;
        b.z = 0.02;
        b.fromX = b.x;
        b.toX = Math.max(-0.9, Math.min(0.9, b.x + (b.x - this.paddleX) * 2.5 + rand(-0.4, 0.4)));
        b.t = 0;
        this.events.push('hit');
        this.hudDirty = true;
      } else if (this.versus) {
        return this.point('p2');
      } else {
        this.best = Math.max(this.best, this.rally);
        this.phase = 'over';
        this.events.push('miss', 'over');
        this.hudDirty = true;
      }
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b3a55');
    bg.addColorStop(1, '#101828');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const proj = (x: number, z: number) => {
      const s = 1 - z * 0.62;
      return { x: W / 2 + x * W * 0.24 * s, y: H * 0.28 + (1 - z) * H * 0.62, s };
    };
    const tl = proj(-1, 1), tr = proj(1, 1), bl = proj(-1, 0), br = proj(1, 0);
    g.fillStyle = '#1e7d4a';
    g.beginPath();
    g.moveTo(tl.x, tl.y); g.lineTo(tr.x, tr.y); g.lineTo(br.x, br.y); g.lineTo(bl.x, bl.y); g.closePath();
    g.fill();
    g.strokeStyle = '#eafff2';
    g.lineWidth = Math.max(2, W * 0.004);
    g.stroke();
    const ml = proj(-1, 0.5), mr = proj(1, 0.5);
    g.beginPath(); g.moveTo(ml.x, ml.y); g.lineTo(mr.x, mr.y); g.stroke();
    const c0 = proj(0, 0), c1 = proj(0, 1);
    g.beginPath(); g.moveTo(c0.x, c0.y); g.lineTo(c1.x, c1.y); g.stroke();
    // net
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(ml.x - W * 0.01, ml.y - H * 0.07, mr.x - ml.x + W * 0.02, H * 0.07);
    // opponent paddle
    const op = proj(this.oppX, 1);
    g.fillStyle = '#e53935';
    g.beginPath(); g.ellipse(op.x, op.y - H * 0.03, W * 0.022, W * 0.026, 0, 0, Math.PI * 2); g.fill();
    // ball trail + ball
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const p = proj(t.x, t.z);
      g.fillStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.25})`;
      g.beginPath(); g.arc(p.x, p.y - H * 0.04, W * 0.008 * p.s, 0, Math.PI * 2); g.fill();
    }
    const b = this.ball;
    const p = proj(b.x, b.z);
    const bounce = Math.abs(Math.sin(b.z * Math.PI * 2)) * H * 0.06;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(p.x, p.y, W * 0.012 * p.s, W * 0.005 * p.s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff59d';
    g.beginPath(); g.arc(p.x, p.y - H * 0.04 - bounce, W * 0.011 * p.s, 0, Math.PI * 2); g.fill();
    // player paddle
    const pp = proj(this.paddleX, 0);
    g.fillStyle = '#3b82f6';
    g.beginPath(); g.ellipse(pp.x, pp.y - H * 0.02, W * 0.05, W * 0.058, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c98a4b';
    g.fillRect(pp.x - W * 0.012, pp.y + W * 0.03, W * 0.024, H * 0.1);
  }
}

export function TableTennis({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new TableTennisGame();
    g.start(ctx.players.length >= 2);
    return g;
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    const idx = ctx.players.findIndex((p) => p.id === remote.id);
    if (idx <= 0) game.setPaddle(pointer.x);
    else if (idx === 1) game.setOpponent(pointer.x);
  });
  useButton('a', () => {
    if (game.phase === 'over') game.start(ctx.players.length >= 2);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { hit: 'ping', opp: 'tick', miss: 'fail', go: 'go', over: 'timeup' };
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint={game.versus ? 'Duel: each pointer moves its paddle · a miss is a point for the other side · first to 7' : 'Move the paddle with the pointer and keep the rally going · the ball gets faster'}
      hud={() => (
        <>
          <div className="mg-hud">
            {game.versus ? (
              <>
                <div className="mg-score" style={{ borderColor: '#3b82f6' }}>{game.score.p1}<small>Player 1</small></div>
                <div className="mg-score" style={{ borderColor: '#ef4444' }}>{game.score.p2}<small>Player 2</small></div>
              </>
            ) : (
              <div>
                <div className="mg-big">{game.rally}</div>
                <div className="mg-label">rally · best {game.best}</div>
              </div>
            )}
          </div>
          {game.phase === 'ready' && <CenterCard big="Ready…" keyId="ready" />}
          {game.phase === 'over' && game.versus && (
            <Results title={game.score.p1 > game.score.p2 ? 'Player 1 wins!' : 'Player 2 wins!'} rows={[{ label: 'Player 1', value: String(game.score.p1), color: '#3b82f6' }, { label: 'Player 2', value: String(game.score.p2), color: '#ef4444' }]} onAgain={() => game.start(true)} />
          )}
          {game.phase === 'over' && !game.versus && (
            <Results title="Missed!" rating={game.rally >= 50 ? 'Amazing!' : game.rally >= 20 ? 'Great!' : game.rally >= 10 ? 'Good' : 'Keep trying'} rows={[{ label: 'Rally', value: String(game.rally) }, { label: 'Best', value: String(game.best) }]} onAgain={() => game.start()} />
          )}
        </>
      )}
    />
  );
}
