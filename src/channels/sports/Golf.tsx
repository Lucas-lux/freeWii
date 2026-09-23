import { useState } from 'react';
import { PLAYER_COLORS, useButton, type ChannelContext, type Wiimote } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';
import { createGauge, drawGauge, usePowerGauge, type Gauge } from '../_shared/usePowerGauge';

interface Hole {
  par: number;
  tee: [number, number];
  cup: [number, number];
  green: number;
  bunkers: [number, number, number][];
  water?: [number, number, number, number];
}

/** Course in normalised coordinates (x 0..1, y 0..1 of the screen). */
const HOLES: Hole[] = [
  { par: 3, tee: [0.15, 0.78], cup: [0.78, 0.3], green: 0.1, bunkers: [[0.68, 0.45, 0.05]] },
  { par: 4, tee: [0.1, 0.5], cup: [0.86, 0.5], green: 0.09, bunkers: [[0.5, 0.32, 0.05], [0.76, 0.66, 0.05]], water: [0.36, 0.6, 0.16, 0.14] },
  { par: 5, tee: [0.08, 0.82], cup: [0.9, 0.2], green: 0.09, bunkers: [[0.4, 0.5, 0.05], [0.82, 0.36, 0.05]], water: [0.55, 0.62, 0.2, 0.12] },
];

type Club = 'driver' | 'iron' | 'wedge' | 'putter';
type Lie = 'tee' | 'fairway' | 'rough' | 'bunker' | 'green';
const CLUB_RANGE: Record<Club, number> = { driver: 0.72, iron: 0.42, wedge: 0.22, putter: 0.16 };

interface Golfer {
  name: string;
  color: string;
  ball: { x: number; y: number };
  strokes: number;
  lie: Lie;
  lastLie: [number, number];
  holed: boolean;
  scores: number[];
}

/**
 * Aim with the D-pad, hold B and raise the remote to fill the power gauge, swing to shoot (or press A
 * twice to use the oscillating meter). Everyone plays the same hole; the farthest ball plays next.
 */
class GolfGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'aim' | 'flight' | 'result' | 'holed' | 'over' = 'ready';
  holeIndex = 0;
  players: Golfer[] = [];
  cur = 0;
  aim = 0;
  club: Club = 'driver';
  wind = { x: 0, y: 0 };
  message = '';
  gauge: Gauge;
  private timer = 0;
  private flight = { from: [0, 0] as [number, number], to: [0, 0] as [number, number], t: 0, dur: 1 };

  constructor(gauge: Gauge) {
    this.gauge = gauge;
  }

  get hole(): Hole {
    return HOLES[this.holeIndex];
  }

  get p(): Golfer {
    return this.players[this.cur];
  }

  start(names: string[]): void {
    this.players = names.map((name, i) => ({ name, color: PLAYER_COLORS[i % 4], ball: { x: 0, y: 0 }, strokes: 0, lie: 'tee', lastLie: [0, 0], holed: false, scores: [] }));
    this.holeIndex = 0;
    this.setupHole();
  }

  private setupHole(): void {
    this.phase = 'ready';
    this.timer = 1.6;
    for (const p of this.players) {
      p.ball = { x: this.hole.tee[0], y: this.hole.tee[1] };
      p.strokes = 0;
      p.lie = 'tee';
      p.holed = false;
    }
    this.cur = 0;
    this.wind = { x: rand(-0.06, 0.06), y: rand(-0.04, 0.04) };
    this.prepareShot();
    this.hudDirty = true;
  }

  private distToCup(p: Golfer): number {
    return Math.hypot(this.hole.cup[0] - p.ball.x, this.hole.cup[1] - p.ball.y);
  }

  private prepareShot(): void {
    const p = this.p;
    this.aim = Math.atan2(this.hole.cup[1] - p.ball.y, this.hole.cup[0] - p.ball.x);
    const d = this.distToCup(p);
    this.club = p.lie === 'green' ? 'putter' : d > 0.45 ? 'driver' : d > 0.2 ? 'iron' : 'wedge';
  }

  /** The player farthest from the cup plays next, like on a real course. */
  private nextTurn(): void {
    const waiting = this.players.map((p, i) => ({ p, i })).filter((e) => !e.p.holed);
    if (waiting.length === 0) {
      for (const p of this.players) p.scores.push(p.strokes);
      this.phase = 'holed';
      this.timer = 2;
      this.hudDirty = true;
      return;
    }
    waiting.sort((a, b) => this.distToCup(b.p) - this.distToCup(a.p));
    this.cur = waiting[0].i;
    this.prepareShot();
    this.phase = 'aim';
    this.message = '';
    this.hudDirty = true;
  }

  rotate(deg: number): void {
    if (this.phase === 'aim') this.aim += (deg * Math.PI) / 180;
  }

  cycleClub(): void {
    if (this.phase !== 'aim') return;
    const order: Club[] = ['driver', 'iron', 'wedge', 'putter'];
    this.club = order[(order.indexOf(this.club) + 1) % order.length];
    this.hudDirty = true;
  }

  swing(power: number): void {
    if (this.phase !== 'aim') return;
    const p = this.p;
    const lieFactor = p.lie === 'bunker' ? 0.55 : p.lie === 'rough' ? 0.78 : 1;
    const dist = CLUB_RANGE[this.club] * power * lieFactor;
    const air = this.club === 'putter' ? 0 : 1;
    const to: [number, number] = [p.ball.x + Math.cos(this.aim) * dist + this.wind.x * air * dist, p.ball.y + Math.sin(this.aim) * dist + this.wind.y * air * dist];
    p.lastLie = [p.ball.x, p.ball.y];
    this.flight = { from: [p.ball.x, p.ball.y], to, t: 0, dur: 0.6 + dist * 1.6 };
    p.strokes += 1;
    this.phase = 'flight';
    this.events.push(this.club === 'putter' ? 'putt' : 'drive');
    this.hudDirty = true;
  }

  private land(): void {
    const p = this.p;
    const [x, y] = this.flight.to;
    p.ball = { x: Math.max(0.02, Math.min(0.98, x)), y: Math.max(0.02, Math.min(0.98, y)) };
    const h = this.hole;
    const d = this.distToCup(p);
    this.phase = 'result';
    this.timer = 1.3;
    if (d < 0.018 || (this.club === 'putter' && d < 0.03)) {
      p.ball = { x: h.cup[0], y: h.cup[1] };
      p.holed = true;
      const diff = p.strokes - h.par;
      this.message = `${p.name}: ${diff <= -2 ? 'EAGLE!' : diff === -1 ? 'BIRDIE!' : diff === 0 ? 'PAR' : diff === 1 ? 'Bogey' : `+${diff}`}`;
      this.events.push(diff < 0 ? 'birdie' : 'holed');
      this.timer = 1.8;
    } else if (h.water && x > h.water[0] && x < h.water[0] + h.water[2] && y > h.water[1] && y < h.water[1] + h.water[3]) {
      p.ball = { x: p.lastLie[0], y: p.lastLie[1] };
      p.strokes += 1;
      p.lie = 'rough';
      this.message = 'Splash! +1 stroke';
      this.events.push('water');
    } else if (h.bunkers.some(([bx, by, br]) => Math.hypot(x - bx, y - by) < br)) {
      p.lie = 'bunker';
      this.message = 'Bunker';
      this.events.push('sand');
    } else if (d < h.green) {
      p.lie = 'green';
      this.message = 'On the green';
      this.events.push('green');
    } else {
      const [tx, ty] = h.tee, [cx, cy] = h.cup;
      const L = Math.hypot(cx - tx, cy - ty);
      const t = Math.max(0, Math.min(1, ((x - tx) * (cx - tx) + (y - ty) * (cy - ty)) / (L * L)));
      const off = Math.hypot(x - (tx + (cx - tx) * t), y - (ty + (cy - ty) * t));
      p.lie = off < 0.11 ? 'fairway' : 'rough';
      this.message = p.lie === 'rough' ? 'In the rough' : 'Fairway';
    }
    this.hudDirty = true;
  }

  update(dt: number): void {
    this.gauge.update(dt);
    switch (this.phase) {
      case 'ready':
        this.timer -= dt;
        if (this.timer <= 0) this.nextTurn();
        break;
      case 'flight':
        this.flight.t += dt;
        if (this.flight.t >= this.flight.dur) this.land();
        break;
      case 'result':
        this.timer -= dt;
        if (this.timer <= 0) this.nextTurn();
        break;
      case 'holed':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.holeIndex += 1;
          if (this.holeIndex >= HOLES.length) {
            this.phase = 'over';
            this.events.push('over');
            this.hudDirty = true;
          } else this.setupHole();
        }
        break;
    }
  }

  totalVsPar(p: Golfer): number {
    return p.scores.reduce((a, s, i) => a + s - HOLES[i].par, 0);
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const h = this.hole;
    g.fillStyle = '#3f8f3a';
    g.fillRect(0, 0, W, H);
    const [tx, ty] = h.tee, [cx, cy] = h.cup;
    g.strokeStyle = '#6cbf5a';
    g.lineCap = 'round';
    g.lineWidth = 0.22 * W;
    g.beginPath(); g.moveTo(tx * W, ty * H); g.lineTo(cx * W, cy * H); g.stroke();
    if (h.water) {
      g.fillStyle = '#3aa0e0';
      g.beginPath(); g.roundRect(h.water[0] * W, h.water[1] * H, h.water[2] * W, h.water[3] * H, W * 0.03); g.fill();
    }
    for (const [bx, by, br] of h.bunkers) {
      g.fillStyle = '#efd9a0';
      g.beginPath(); g.ellipse(bx * W, by * H, br * W, br * W * 0.75, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#9ee08a';
    g.beginPath(); g.ellipse(cx * W, cy * H, h.green * W, h.green * W * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.arc(cx * W, cy * H, W * 0.006, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = W * 0.003;
    g.beginPath(); g.moveTo(cx * W, cy * H); g.lineTo(cx * W, cy * H - H * 0.07); g.stroke();
    g.fillStyle = '#e53935';
    g.beginPath(); g.moveTo(cx * W, cy * H - H * 0.07); g.lineTo(cx * W + W * 0.025, cy * H - H * 0.055); g.lineTo(cx * W, cy * H - H * 0.04); g.closePath(); g.fill();
    g.fillStyle = '#bdbdbd';
    g.fillRect(tx * W - W * 0.012, ty * H - H * 0.01, W * 0.024, H * 0.02);
    if (this.phase === 'aim') {
      const range = CLUB_RANGE[this.club] * (this.gauge.active ? Math.max(0.05, this.gauge.power) : 1);
      const p = this.p;
      g.setLineDash([W * 0.008, W * 0.01]);
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = W * 0.002;
      g.beginPath();
      g.moveTo(p.ball.x * W, p.ball.y * H);
      g.lineTo((p.ball.x + Math.cos(this.aim) * range) * W, (p.ball.y + Math.sin(this.aim) * range) * H);
      g.stroke();
      g.setLineDash([]);
    }
    // wind compass (arrow length = strength)
    const wx = W * 0.88, wy = H * 0.2, wr = W * 0.03;
    const mag = Math.hypot(this.wind.x, this.wind.y);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.arc(wx, wy, wr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = Math.max(1, W * 0.0015);
    g.beginPath(); g.arc(wx, wy, wr, 0, Math.PI * 2); g.stroke();
    if (mag > 0.002) {
      const len = wr * 0.85 * Math.min(1, mag / 0.06);
      const ux = this.wind.x / mag, uy = this.wind.y / mag;
      const ex = wx + ux * len, ey = wy + uy * len;
      g.strokeStyle = '#fff';
      g.lineWidth = W * 0.003;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(wx - ux * len * 0.6, wy - uy * len * 0.6); g.lineTo(ex, ey); g.stroke();
      const ah = W * 0.008;
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(ex + ux * ah, ey + uy * ah);
      g.lineTo(ex - uy * ah * 0.7, ey + ux * ah * 0.7);
      g.lineTo(ex + uy * ah * 0.7, ey - ux * ah * 0.7);
      g.closePath(); g.fill();
    }
    g.fillStyle = '#fff';
    g.font = `800 ${W * 0.012}px Nunito, sans-serif`;
    g.textAlign = 'center';
    g.fillText(`WIND ${Math.round(mag * 250)}`, wx, wy + wr + W * 0.014);
    // every ball; the current one may be in flight
    this.players.forEach((p, i) => {
      let bx = p.ball.x, by = p.ball.y, lift = 0;
      if (this.phase === 'flight' && i === this.cur) {
        const f = this.flight;
        const k = Math.min(1, f.t / f.dur);
        bx = f.from[0] + (f.to[0] - f.from[0]) * k;
        by = f.from[1] + (f.to[1] - f.from[1]) * k;
        lift = this.club === 'putter' ? 0 : Math.sin(k * Math.PI) * 0.12;
      }
      if (p.holed && this.phase !== 'holed') return;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.arc(bx * W, by * H, W * 0.006, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(bx * W, by * H - lift * H, W * 0.006 * (1 + lift * 3), 0, Math.PI * 2); g.fill();
      g.strokeStyle = p.color;
      g.lineWidth = W * 0.002;
      g.stroke();
    });
    if (this.gauge.active) drawGauge(g, this.gauge, W * 0.955, H * 0.3, W * 0.018, H * 0.45);
  }
}

function golfer(remote: Wiimote): string {
  return remote.kind === 'phone' ? remote.name : `Player ${remote.player}`;
}

export function Golf({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [gauge] = useState(() => createGauge(0.75));
  const [game] = useState(() => {
    const g = new GolfGame(gauge);
    g.start(ctx.players.map(golfer));
    return g;
  });
  const isCurrent = (remote: Wiimote) => ctx.players.length <= 1 || ctx.players[game.cur]?.id === remote.id;
  usePowerGauge({ gauge, enabled: () => game.phase === 'aim', accept: isCurrent, onRelease: (power) => game.swing(power) });
  useButton(['left', 'right'], (remote, b) => {
    if (isCurrent(remote)) game.rotate(b === 'left' ? -2 : 2);
  });
  useButton(['up', 'down', 'one', 'two'], (remote) => {
    if (isCurrent(remote)) game.cycleClub();
  });
  useButton('a', () => {
    if (game.phase === 'over') game.start(ctx.players.map(golfer));
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { drive: 'whoosh', putt: 'tick', holed: 'success', birdie: 'strike', water: 'fail', sand: 'hit', green: 'ping', over: 'start' };
  const p = game.p;
  const vs = game.totalVsPar(p);
  const ranking = [...game.players].sort((a, b) => game.totalVsPar(a) - game.totalVsPar(b));
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="◀ ▶ aim · ▲ ▼ change club · hold B and raise the remote to load power, swing to shoot · or press A twice for the meter · watch the wind"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big" style={{ color: p.color }}>
                {p.name} · {p.strokes}
              </div>
              <div className="mg-label">
                Hole {game.holeIndex + 1}/{HOLES.length} · par {game.hole.par} · {game.club} · {p.lie}
              </div>
            </div>
            <div className="mg-score" style={{ borderColor: p.color }}>
              {vs > 0 ? `+${vs}` : vs === 0 ? 'E' : vs}
              <small>vs par</small>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small={`Par ${game.hole.par}`} big={`Hole ${game.holeIndex + 1}`} keyId={`h${game.holeIndex}`} />}
          {game.message && <div className="mg-msg" key={game.message + p.strokes + game.cur}>{game.message}</div>}
          {game.phase === 'over' && (
            <Results
              title="Round over"
              rating={game.totalVsPar(ranking[0]) <= -2 ? 'Champion!' : game.totalVsPar(ranking[0]) <= 0 ? 'Nice round' : 'Practice'}
              rows={ranking.map((q) => ({ label: q.name, value: `${q.scores.reduce((a, s) => a + s, 0)} (${game.totalVsPar(q) > 0 ? '+' : ''}${game.totalVsPar(q)})`, color: q.color }))}
              onAgain={() => game.start(ctx.players.map(golfer))}
            />
          )}
        </>
      )}
    />
  );
}
