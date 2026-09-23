import { useState } from 'react';
import { useButton, usePlayers, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';
import { contestants, ranked, type Contestant } from './shared';

type Kind = 'mole' | 'gold' | 'bomb';
interface Hole {
  x: number;
  y: number;
  kind: Kind | null;
  /** What the hole shows while it sinks back after a whack. */
  shown: Kind;
  up: number;
  t: number;
  hit: { color: string; t: number; text: string } | null;
}
interface Whacker {
  c: Contestant;
  score: number;
}

const DURATION = 30;
const POINTS: Record<Kind, number> = { mole: 1, gold: 3, bomb: -2 };

/** Point at the moles and press A. Gold moles are worth three, bombs cost two. */
class MoleGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'over' = 'ready';
  countdown = 3;
  time = DURATION;
  holes: Hole[] = [];
  whackers: Whacker[] = [];
  private spawnT = 0;
  private lastTick = -1;

  start(list: Contestant[]): void {
    this.whackers = list.map((c) => ({ c, score: 0 }));
    this.holes = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) this.holes.push({ x: 0.27 + c * 0.23, y: 0.34 + r * 0.23, kind: null, shown: 'mole', up: 0, t: 0, hit: null });
    this.phase = 'ready';
    this.countdown = 3;
    this.time = DURATION;
    this.spawnT = 0.5;
    this.lastTick = -1;
    this.hudDirty = true;
  }

  whack(id: string, px: number, py: number): void {
    if (this.phase !== 'play') return;
    const w = this.whackers.find((x) => x.c.id === id);
    if (!w) return;
    const hole = this.holes.find((h) => h.kind && h.up > 0.45 && Math.hypot((px - h.x) * 16, (py - h.y) * 9) < 1.4);
    if (!hole || !hole.kind) {
      this.events.push('miss');
      return;
    }
    const pts = POINTS[hole.kind];
    w.score += pts;
    hole.hit = { color: w.c.color, t: 0.5, text: pts > 0 ? `+${pts}` : String(pts) };
    this.events.push(hole.kind === 'bomb' ? 'bomb' : 'bonk');
    hole.kind = null;
    this.hudDirty = true;
  }

  update(dt: number): void {
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
    for (const h of this.holes) {
      if (h.hit) h.hit.t -= dt;
      if (h.hit && h.hit.t <= 0) h.hit = null;
      const target = h.kind ? 1 : 0;
      h.up += (target - h.up) * Math.min(1, dt * 12);
      if (h.kind) {
        h.t -= dt;
        if (h.t <= 0) h.kind = null;
      }
    }
    if (this.phase !== 'play') return;
    this.time -= dt;
    const progress = 1 - this.time / DURATION;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = rand(0.35, 0.9) * (1 - progress * 0.5);
      const free = this.holes.filter((h) => !h.kind && h.up < 0.1);
      if (free.length) {
        const h = free[Math.floor(Math.random() * free.length)];
        const roll = Math.random();
        h.kind = roll < 0.12 ? 'gold' : roll < 0.3 ? 'bomb' : 'mole';
        h.shown = h.kind;
        h.t = (h.kind === 'gold' ? 0.7 : 1.4) * (1 - progress * 0.45);
      }
    }
    if (Math.ceil(this.time) !== this.lastTick) {
      this.lastTick = Math.ceil(this.time);
      this.hudDirty = true;
    }
    if (this.time <= 0) {
      this.time = 0;
      this.phase = 'over';
      for (const h of this.holes) h.kind = null;
      this.events.push('over');
      this.hudDirty = true;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    g.fillStyle = '#7cb342';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 12; i++) {
      g.beginPath();
      g.ellipse(((i * 131) % 100) / 100 * W, ((i * 71) % 100) / 100 * H, W * 0.06, H * 0.03, 0, 0, Math.PI * 2);
      g.fill();
    }
    const rx = W * 0.085, ry = H * 0.05;
    for (const h of this.holes) {
      const x = h.x * W, y = h.y * H;
      g.fillStyle = '#4e342e';
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      if (h.up > 0.02) {
        const rise = h.up * H * 0.15;
        g.save();
        g.beginPath();
        g.rect(x - rx * 1.4, y - H * 0.3, rx * 2.8, H * 0.3);
        g.clip();
        const by = y + ry * 0.2 - rise;
        if (h.shown === 'bomb') {
          g.fillStyle = '#212121';
          g.beginPath();
          g.arc(x, by, rx * 0.62, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#8d6e63';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(x + rx * 0.2, by - rx * 0.55);
          g.quadraticCurveTo(x + rx * 0.5, by - rx * 1.0, x + rx * 0.7, by - rx * 0.8);
          g.stroke();
          g.fillStyle = '#ffeb3b';
          g.beginPath();
          g.arc(x + rx * 0.72, by - rx * 0.82, rx * 0.12, 0, Math.PI * 2);
          g.fill();
        } else {
          const gold = h.shown === 'gold';
          g.fillStyle = gold ? '#fdd835' : '#8d6e63';
          g.beginPath();
          g.roundRect(x - rx * 0.6, by - rx * 1.1, rx * 1.2, rx * 1.5, rx * 0.55);
          g.fill();
          g.fillStyle = gold ? '#fff59d' : '#d7ccc8';
          g.beginPath();
          g.ellipse(x, by - rx * 0.15, rx * 0.34, rx * 0.28, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#222';
          g.beginPath();
          g.arc(x - rx * 0.24, by - rx * 0.6, rx * 0.07, 0, Math.PI * 2);
          g.arc(x + rx * 0.24, by - rx * 0.6, rx * 0.07, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#e57373';
          g.beginPath();
          g.ellipse(x, by - rx * 0.36, rx * 0.12, rx * 0.09, 0, 0, Math.PI * 2);
          g.fill();
          if (gold) {
            g.fillStyle = '#ff8f00';
            g.beginPath();
            g.moveTo(x - rx * 0.4, by - rx * 1.05);
            g.lineTo(x - rx * 0.25, by - rx * 1.4);
            g.lineTo(x, by - rx * 1.12);
            g.lineTo(x + rx * 0.25, by - rx * 1.4);
            g.lineTo(x + rx * 0.4, by - rx * 1.05);
            g.closePath();
            g.fill();
          }
        }
        g.restore();
      }
      g.fillStyle = '#3e2723';
      g.beginPath();
      g.ellipse(x, y + ry * 0.35, rx, ry * 0.7, 0, 0, Math.PI);
      g.fill();
      if (h.hit) {
        const k = 1 - h.hit.t / 0.5;
        g.strokeStyle = h.hit.color;
        g.lineWidth = 5;
        g.beginPath();
        g.arc(x, y - H * 0.1, rx * (0.4 + k * 0.9), 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = h.hit.text.startsWith('+') ? '#fff' : '#ffcdd2';
        g.font = `900 ${H * 0.06}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.fillText(h.hit.text, x, y - H * 0.16 - k * H * 0.06);
      }
    }
  }
}

export function Mole({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const players = usePlayers();
  const [game] = useState(() => {
    const g = new MoleGame();
    g.start(contestants(players));
    return g;
  });
  useButton('a', (remote) => {
    if (game.phase === 'over') game.start(contestants(players));
    else game.whack(remote.id, remote.pointer.x, remote.pointer.y);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { tick: 'countdown', go: 'go', bonk: 'pop', bomb: 'crash', miss: 'whoosh', over: 'timeup' };
  const top = ranked(game.whackers);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Point at a mole and press A · gold mole = 3 points · bomb = −2 · thirty seconds"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{Math.max(0, Math.ceil(game.time))}</div>
              <div className="mg-label">seconds</div>
            </div>
            <div className="mg-scores">
              {game.whackers.map((w) => (
                <div key={w.c.id} className="mg-score" style={{ borderColor: w.c.color }}>
                  {w.score}
                  <small>{w.c.name}</small>
                </div>
              ))}
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small="Bonk them!" big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'over' && (
            <Results title={top.length > 1 ? `${top[0].c.name} wins!` : "Time's up!"} rating={top[0] && top[0].score >= 30 ? 'Mole nightmare' : top[0] && top[0].score >= 15 ? 'Solid bonking' : 'The moles won'} rows={top.map((w) => ({ label: w.c.name, value: `${w.score} pts`, color: w.c.color }))} onAgain={() => game.start(contestants(players))} />
          )}
        </>
      )}
    />
  );
}
