import { useState } from 'react';
import { useButton, usePlayers, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, type CanvasGame } from '../_shared/MiniGame';
import { contestants, ranked, type Contestant } from './shared';

interface Contender {
  c: Contestant;
  idx: number;
  done: boolean;
  out: boolean;
  score: number;
}

export const PADS = [
  { color: '#2e7d32', lit: '#69f0ae', freq: 329.63, x: -1, y: -1 },
  { color: '#c62828', lit: '#ff8a80', freq: 277.18, x: 1, y: -1 },
  { color: '#f9a825', lit: '#ffff8d', freq: 440, x: -1, y: 1 },
  { color: '#1565c0', lit: '#82b1ff', freq: 164.81, x: 1, y: 1 },
];
const MAX_LEN = 15;

/** Simon: watch the pads light up, then point and press A to repeat the sequence. Everyone plays at once. */
class SimonGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'show' | 'input' | 'between' | 'over' = 'ready';
  seq: number[] = [];
  lit = -1;
  round = 0;
  players: Contender[] = [];
  timer = 1.5;
  private showI = 0;
  private flash = { pad: -1, t: 0 };

  start(list: Contestant[]): void {
    this.players = list.map((c) => ({ c, idx: 0, done: false, out: false, score: 0 }));
    this.seq = [];
    this.round = 0;
    this.lit = -1;
    this.phase = 'ready';
    this.timer = 1.5;
    this.hudDirty = true;
  }

  private nextRound(): void {
    this.round += 1;
    this.seq.push(Math.floor(Math.random() * 4));
    for (const p of this.players) {
      p.idx = 0;
      p.done = p.out;
    }
    this.phase = 'show';
    this.showI = 0;
    this.timer = 0.6;
    this.lit = -1;
    this.hudDirty = true;
  }

  /** Which pad is under a stage-relative point, if any. */
  padAt(px: number, py: number): number {
    const dx = (px - 0.5) * 16, dy = (py - 0.5) * 9;
    return PADS.findIndex((p) => Math.abs(dx - p.x * 1.55) < 1.45 && Math.abs(dy - p.y * 1.55) < 1.45);
  }

  press(id: string, pad: number): void {
    if (this.phase !== 'input' || pad < 0) return;
    const p = this.players.find((x) => x.c.id === id);
    if (!p || p.out || p.done) return;
    this.flash = { pad, t: 0.25 };
    if (pad === this.seq[p.idx]) {
      p.idx += 1;
      this.events.push(`pad${pad}`);
      if (p.idx >= this.seq.length) {
        p.done = true;
        p.score = this.seq.length;
        this.events.push('good');
      }
    } else {
      p.out = true;
      p.done = true;
      this.events.push('wrong');
    }
    if (this.players.every((x) => x.done)) {
      this.phase = 'between';
      this.timer = 1.2;
    }
    this.hudDirty = true;
  }

  update(dt: number): void {
    this.flash.t = Math.max(0, this.flash.t - dt);
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === 'ready') this.nextRound();
    else if (this.phase === 'show') {
      if (this.lit >= 0) {
        this.lit = -1;
        this.timer = 0.14;
        this.showI += 1;
        if (this.showI >= this.seq.length) {
          this.phase = 'input';
          this.timer = 3 + this.seq.length * 1.3;
          this.hudDirty = true;
        }
      } else {
        this.lit = this.seq[this.showI];
        this.timer = Math.max(0.22, 0.5 - this.seq.length * 0.02);
        this.events.push(`pad${this.lit}`);
      }
    } else if (this.phase === 'input') {
      for (const p of this.players) if (!p.done) {
        p.out = true;
        p.done = true;
      }
      this.events.push('wrong');
      this.phase = 'between';
      this.timer = 1.2;
      this.hudDirty = true;
    } else if (this.phase === 'between') {
      if (this.players.every((p) => p.out) || this.seq.length >= MAX_LEN) {
        this.phase = 'over';
        this.events.push('over');
        this.hudDirty = true;
      } else this.nextRound();
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    g.fillStyle = '#1a1a2e';
    g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, s = H * 0.155, gap = H * 0.19;
    PADS.forEach((p, i) => {
      const x = cx + p.x * gap, y = cy + p.y * gap;
      const on = this.lit === i || (this.flash.pad === i && this.flash.t > 0);
      g.fillStyle = on ? p.lit : p.color;
      g.shadowColor = on ? p.lit : 'transparent';
      g.shadowBlur = on ? H * 0.06 : 0;
      g.beginPath();
      g.roundRect(x - s, y - s, s * 2, s * 2, s * 0.35);
      g.fill();
      g.shadowBlur = 0;
    });
    g.fillStyle = '#263238';
    g.beginPath();
    g.arc(cx, cy, H * 0.09, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${H * 0.07}px Nunito, sans-serif`;
    g.fillText(String(this.seq.length), cx, cy);
    g.font = `800 ${H * 0.032}px Nunito, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(this.phase === 'show' ? 'Watch…' : this.phase === 'input' ? 'Your turn!' : '', cx, H * 0.1);
  }
}

export function Simon({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const players = usePlayers();
  const [game] = useState(() => {
    const g = new SimonGame();
    g.start(contestants(players));
    return g;
  });
  useButton('a', (remote) => {
    if (game.phase === 'over') game.start(contestants(players));
    else game.press(remote.id, game.padAt(remote.pointer.x, remote.pointer.y));
  });
  const onEvent = (ev: string) => {
    if (ev.startsWith('pad')) ctx.audio.tone({ freq: PADS[Number(ev[3])].freq, duration: 0.35, type: 'square', gain: 0.12, lowpass: 1800 });
    else if (ev === 'good') ctx.audio.play('success');
    else if (ev === 'wrong') ctx.audio.play('fail');
    else if (ev === 'over') ctx.audio.play('cheer');
  };
  const top = ranked(game.players);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={onEvent}
      hint="Watch the pads light up, then point at them and press A in the same order · a mistake knocks you out"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{game.seq.length}</div>
              <div className="mg-label">colours</div>
            </div>
            <div className="mg-scores">
              {game.players.map((p) => (
                <div key={p.c.id} className="mg-score" style={{ borderColor: p.c.color, opacity: p.out ? 0.6 : 1 }}>
                  {p.out ? `out · ${p.score}` : `${p.idx} / ${game.seq.length}`}
                  <small>{p.c.name}</small>
                </div>
              ))}
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small="Memorise the colours" big="Simon" keyId="ready" />}
          {game.phase === 'over' && (
            <Results title={top.length > 1 ? `${top[0].c.name} wins!` : 'Game over'} rating={top[0] && top[0].score >= 12 ? 'Elephant memory' : top[0] && top[0].score >= 7 ? 'Sharp' : 'Goldfish'} rows={top.map((p) => ({ label: p.c.name, value: `${p.score} colours`, color: p.c.color }))} onAgain={() => game.start(contestants(players))} />
          )}
        </>
      )}
    />
  );
}
