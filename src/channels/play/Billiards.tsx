import { useState } from 'react';
import { PLAYER_COLORS, useButton, useInputEvent, type ChannelContext, type Wiimote } from '../../core';
import { MiniGame, Results, type CanvasGame } from '../_shared/MiniGame';
import { createGauge, drawGauge, usePowerGauge, type Gauge } from '../_shared/usePowerGauge';

interface Cueist {
  id: string;
  name: string;
  color: string;
  score: number;
  fouls: number;
  shots: number;
}

interface Ball {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  pocketed: boolean;
}

const R = 0.017;
const TABLE = { x0: 0.08, y0: 0.14, x1: 0.92, y1: 0.86 };
const POCKETS = [
  [TABLE.x0, TABLE.y0], [0.5, TABLE.y0 - 0.01], [TABLE.x1, TABLE.y0],
  [TABLE.x0, TABLE.y1], [0.5, TABLE.y1 + 0.01], [TABLE.x1, TABLE.y1],
];
const COLORS = ['#f8fafc', '#facc15', '#2563eb', '#dc2626', '#7c3aed', '#f97316', '#16a34a', '#7f1d1d', '#111827', '#facc15'];
const MAX_SHOTS = 25;

/**
 * Nine-ball with pointer aim: point where the cue ball should go, hold B and pull back to load the
 * power gauge, swing to shoot (or A twice for the meter). Players take turns; pocket a ball to keep the cue.
 */
class BilliardsGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'aim' | 'moving' | 'over' = 'aim';
  balls: Ball[] = [];
  pointer = { x: 0.5, y: 0.5 };
  players: Cueist[] = [];
  cur = 0;
  shots = 0;
  message = '';
  gauge: Gauge;
  private msgT = 0;
  private pocketedThisShot = 0;
  private scratched = false;

  constructor(gauge: Gauge) {
    this.gauge = gauge;
  }

  get p(): Cueist {
    return this.players[this.cur];
  }

  get score(): number {
    return this.players.reduce((a, p) => a + p.score, 0);
  }

  start(players: { id: string; name: string; color: string }[]): void {
    this.players = players.map((p) => ({ ...p, score: 0, fouls: 0, shots: 0 }));
    this.cur = 0;
    this.balls = [{ n: 0, x: 0.28, y: 0.5, vx: 0, vy: 0, color: COLORS[0], pocketed: false }];
    const rows = [[1], [2, 3], [4, 9, 5], [6, 7], [8]];
    rows.forEach((row, ri) => {
      row.forEach((n, i) => {
        this.balls.push({ n, x: 0.62 + ri * R * 1.75, y: 0.5 + (i - (row.length - 1) / 2) * R * 2.05, vx: 0, vy: 0, color: COLORS[n], pocketed: false });
      });
    });
    this.phase = 'aim';
    this.shots = 0;
    this.message = '';
    this.hudDirty = true;
  }

  get cue(): Ball {
    return this.balls[0];
  }

  shoot(strength: number): void {
    if (this.phase !== 'aim') return;
    const c = this.cue;
    const dx = this.pointer.x - c.x, dy = this.pointer.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = 0.5 + Math.max(0.05, Math.min(1, strength)) * 1.3;
    c.vx = (dx / d) * v;
    c.vy = (dy / d) * v;
    this.phase = 'moving';
    this.shots += 1;
    this.p.shots += 1;
    this.pocketedThisShot = 0;
    this.scratched = false;
    this.events.push('shot');
    this.hudDirty = true;
  }

  private say(text: string): void {
    this.message = text;
    this.msgT = 1.4;
    this.hudDirty = true;
  }

  update(dt: number): void {
    this.gauge.update(dt);
    this.msgT -= dt;
    if (this.msgT <= 0 && this.message) {
      this.message = '';
      this.hudDirty = true;
    }
    if (this.phase !== 'moving') return;
    const steps = 4;
    const h = dt / steps;
    let moving = false;
    for (let s = 0; s < steps; s++) {
      for (const b of this.balls) {
        if (b.pocketed) continue;
        b.x += b.vx * h;
        b.y += b.vy * h;
        const damp = Math.max(0, 1 - 0.75 * h);
        b.vx *= damp;
        b.vy *= damp;
        if (Math.hypot(b.vx, b.vy) < 0.012) b.vx = b.vy = 0;
        for (const [px, py] of POCKETS) {
          if (Math.hypot(b.x - px, b.y - py) < 0.034) {
            b.pocketed = true;
            b.vx = b.vy = 0;
            if (b.n === 0) {
              this.p.fouls += 1;
              this.p.score = Math.max(0, this.p.score - 1);
              this.scratched = true;
              this.events.push('foul');
              this.say('Scratch!');
            } else {
              this.p.score += b.n === 9 ? 3 : 1;
              this.pocketedThisShot += 1;
              this.events.push('pocket');
              this.say(b.n === 9 ? '9-ball! +3' : `Ball ${b.n} +1`);
            }
          }
        }
        if (b.pocketed) continue;
        if (b.x < TABLE.x0 + R) { b.x = TABLE.x0 + R; b.vx = Math.abs(b.vx) * 0.8; this.events.push('rail'); }
        if (b.x > TABLE.x1 - R) { b.x = TABLE.x1 - R; b.vx = -Math.abs(b.vx) * 0.8; this.events.push('rail'); }
        if (b.y < TABLE.y0 + R) { b.y = TABLE.y0 + R; b.vy = Math.abs(b.vy) * 0.8; this.events.push('rail'); }
        if (b.y > TABLE.y1 - R) { b.y = TABLE.y1 - R; b.vy = -Math.abs(b.vy) * 0.8; this.events.push('rail'); }
      }
      for (let i = 0; i < this.balls.length; i++) {
        const a = this.balls[i];
        if (a.pocketed) continue;
        for (let j = i + 1; j < this.balls.length; j++) {
          const b = this.balls[j];
          if (b.pocketed) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= R * 2 || d === 0) continue;
          const nx = dx / d, ny = dy / d;
          const overlap = R * 2 - d;
          a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
          b.x += nx * overlap / 2; b.y += ny * overlap / 2;
          const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          a.vx -= rel * nx; a.vy -= rel * ny;
          b.vx += rel * nx; b.vy += rel * ny;
          if (rel > 0.15) this.events.push('clack');
        }
      }
    }
    for (const b of this.balls) if (!b.pocketed && (b.vx !== 0 || b.vy !== 0)) moving = true;
    if (!moving) {
      if (this.cue.pocketed) Object.assign(this.cue, { pocketed: false, x: 0.28, y: 0.5 });
      const left = this.balls.filter((b) => b.n > 0 && !b.pocketed).length;
      if (left === 0 || this.shots >= MAX_SHOTS * this.players.length) {
        this.phase = 'over';
        this.events.push('over');
      } else {
        if ((this.scratched || this.pocketedThisShot === 0) && this.players.length > 1) {
          this.cur = (this.cur + 1) % this.players.length;
          this.events.push('turn');
        }
        this.phase = 'aim';
      }
      this.hudDirty = true;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    g.fillStyle = '#3b2410';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#5c3a1e';
    g.fillRect((TABLE.x0 - 0.05) * W, (TABLE.y0 - 0.07) * H, (TABLE.x1 - TABLE.x0 + 0.1) * W, (TABLE.y1 - TABLE.y0 + 0.14) * H);
    g.fillStyle = '#166534';
    g.fillRect(TABLE.x0 * W, TABLE.y0 * H, (TABLE.x1 - TABLE.x0) * W, (TABLE.y1 - TABLE.y0) * H);
    g.fillStyle = '#0a0a0a';
    for (const [px, py] of POCKETS) {
      g.beginPath(); g.arc(px * W, py * H, 0.03 * W, 0, Math.PI * 2); g.fill();
    }
    if (this.phase === 'aim') {
      const c = this.cue;
      const dx = this.pointer.x - c.x, dy = this.pointer.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      g.setLineDash([W * 0.008, W * 0.01]);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = Math.max(1, W * 0.002);
      g.beginPath();
      g.moveTo(c.x * W, c.y * H);
      g.lineTo((c.x + (dx / d) * 0.35) * W, (c.y + (dy / d) * 0.35) * H);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = '#d9b26f';
      g.lineWidth = W * 0.006;
      g.beginPath();
      g.moveTo((c.x - (dx / d) * 0.035) * W, (c.y - (dy / d) * 0.035) * H);
      g.lineTo((c.x - (dx / d) * 0.3) * W, (c.y - (dy / d) * 0.3) * H);
      g.stroke();
    }
    if (this.gauge.active) drawGauge(g, this.gauge, W * 0.955, H * 0.25, W * 0.018, H * 0.5);
    for (const b of this.balls) {
      if (b.pocketed) continue;
      const x = b.x * W, y = b.y * H, r = R * W;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.arc(x + r * 0.2, y + r * 0.25, r, 0, Math.PI * 2); g.fill();
      const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, b.color);
      grad.addColorStop(1, b.color);
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      if (b.n > 8) {
        g.fillStyle = '#f8fafc';
        g.fillRect(x - r, y - r * 0.35, r * 2, r * 0.7);
      }
      if (b.n > 0) {
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#111';
        g.font = `800 ${r * 0.7}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(b.n), x, y + r * 0.05);
      }
    }
  }
}

function cueist(remote: Wiimote) {
  return { id: remote.id, name: remote.kind === 'phone' ? remote.name : `Player ${remote.player}`, color: PLAYER_COLORS[(remote.player - 1) % 4] ?? '#3b82f6' };
}

export function Billiards({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [gauge] = useState(() => createGauge(0.7));
  const [game] = useState(() => {
    const g = new BilliardsGame(gauge);
    g.start(ctx.players.map(cueist));
    return g;
  });
  const isCurrent = (remote: Wiimote) => game.players.length <= 1 || game.p.id === remote.id;
  useInputEvent('pointer', ({ remote, pointer }) => {
    if (!gauge.active && isCurrent(remote)) game.pointer = { x: pointer.x, y: pointer.y };
  });
  usePowerGauge({ gauge, enabled: () => game.phase === 'aim', accept: isCurrent, onRelease: (power) => game.shoot(power) });
  useButton('a', () => {
    if (game.phase === 'over') game.start(ctx.players.map(cueist));
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { shot: 'whoosh', clack: 'ping', rail: 'tick', pocket: 'success', foul: 'deny', turn: 'select', over: 'strike' };
  const left = game.balls.filter((b) => b.n > 0 && !b.pocketed).length;
  const ranking = [...game.players].sort((a, b) => b.score - a.score);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint={`Point where the cue ball should go · hold B and pull back to load power, swing to shoot · or press A twice for the meter · ${MAX_SHOTS} shots each`}
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big" style={{ color: game.p?.color }}>{game.p?.name}</div>
              <div className="mg-label">
                {left} ball{left === 1 ? '' : 's'} left · shot {game.p?.shots ?? 0}/{MAX_SHOTS}
              </div>
            </div>
            <div className="mg-scores">
              {game.players.map((p) => (
                <div key={p.id} className="mg-score" style={{ borderColor: p.color, opacity: p === game.p ? 1 : 0.7 }}>
                  {p.score}
                  <small>{p.name}</small>
                </div>
              ))}
            </div>
          </div>
          {game.message && <div className="mg-msg" key={game.message + game.shots}>{game.message}</div>}
          {game.phase === 'over' && (
            <Results
              title={left === 0 ? 'Table cleared!' : 'Out of shots'}
              rating={ranking[0].score >= 11 ? 'Hustler!' : ranking[0].score >= 6 ? 'Nice cue' : 'Chalk up'}
              rows={ranking.map((p) => ({ label: p.name, value: `${p.score} (${p.fouls} foul${p.fouls === 1 ? '' : 's'})`, color: p.color }))}
              onAgain={() => game.start(ctx.players.map(cueist))}
            />
          )}
        </>
      )}
    />
  );
}
