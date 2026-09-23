import { useState } from 'react';
import { useButton, usePlayers, type ChannelContext } from '../../core';
import { MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';
import { contestants, ranked, type Contestant } from './shared';

interface Racer {
  c: Contestant;
  score: number;
  out: boolean;
  ms: number | null;
  best: number | null;
}

const ROUNDS = 5;

/** Wait for green, then press A first. Press too early and you sit the round out. */
class ReflexGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'wait' | 'go' | 'result' | 'over' = 'ready';
  round = 0;
  racers: Racer[] = [];
  msg = '';
  private timer = 1.5;
  private goAt = 0;
  private winner: Racer | null = null;

  start(list: Contestant[]): void {
    this.racers = list.map((c) => ({ c, score: 0, out: false, ms: null, best: null }));
    this.round = 0;
    this.phase = 'ready';
    this.timer = 1.5;
    this.msg = '';
    this.hudDirty = true;
  }

  private nextRound(): void {
    this.round += 1;
    if (this.round > ROUNDS) {
      this.phase = 'over';
      this.events.push('over');
      this.hudDirty = true;
      return;
    }
    for (const r of this.racers) {
      r.out = false;
      r.ms = null;
    }
    this.winner = null;
    this.msg = '';
    this.phase = 'wait';
    this.timer = rand(1.5, 4.5);
    this.hudDirty = true;
  }

  press(id: string): void {
    const r = this.racers.find((x) => x.c.id === id);
    if (!r) return;
    if (this.phase === 'wait') {
      if (r.out) return;
      r.out = true;
      this.events.push('false');
      if (this.racers.every((x) => x.out)) {
        this.msg = 'Everyone jumped the gun!';
        this.phase = 'result';
        this.timer = 1.8;
      }
      this.hudDirty = true;
    } else if (this.phase === 'go') {
      if (r.out || r.ms !== null) return;
      r.ms = Math.round(performance.now() - this.goAt);
      r.best = r.best === null ? r.ms : Math.min(r.best, r.ms);
      if (!this.winner) {
        this.winner = r;
        r.score += 1;
        this.events.push('win');
        this.msg = `${r.c.name} · ${r.ms} ms`;
      }
      if (this.racers.every((x) => x.out || x.ms !== null)) {
        this.phase = 'result';
        this.timer = 1.8;
      }
      this.hudDirty = true;
    }
  }

  update(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.phase === 'ready' || this.phase === 'result') this.nextRound();
    else if (this.phase === 'wait') {
      this.phase = 'go';
      this.goAt = performance.now();
      this.timer = 2;
      this.events.push('go');
      this.hudDirty = true;
    } else if (this.phase === 'go') {
      if (!this.winner) this.msg = 'Too slow!';
      this.phase = 'result';
      this.timer = 1.8;
      this.hudDirty = true;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const colors = { ready: '#1e88e5', wait: '#c62828', go: '#2e7d32', result: '#37474f', over: '#263238' };
    g.fillStyle = colors[this.phase];
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.font = `900 ${W * 0.12}px Nunito, sans-serif`;
    const big = this.phase === 'wait' ? 'Wait…' : this.phase === 'go' ? 'GO!' : this.phase === 'result' ? this.msg : this.phase === 'ready' ? 'Ready?' : '';
    g.fillText(big, W / 2, H * 0.42);
    g.font = `800 ${W * 0.024}px Nunito, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.8)';
    if (this.phase === 'wait') g.fillText('press A when the screen turns green', W / 2, H * 0.55);
    // player chips
    const n = this.racers.length;
    const cw = W * 0.2, ch = H * 0.11, gap = W * 0.015;
    const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2;
    this.racers.forEach((r, i) => {
      const x = x0 + i * (cw + gap), y = H * 0.74;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath();
      g.roundRect(x, y, cw, ch, ch * 0.2);
      g.fill();
      g.fillStyle = r.c.color;
      g.fillRect(x, y, ch * 0.12, ch);
      g.textAlign = 'left';
      g.fillStyle = '#333';
      g.font = `800 ${ch * 0.28}px Nunito, sans-serif`;
      g.fillText(r.c.name, x + ch * 0.3, y + ch * 0.32);
      g.font = `700 ${ch * 0.24}px Nunito, sans-serif`;
      g.fillStyle = r.out ? '#c62828' : '#607d8b';
      g.fillText(r.out ? 'false start' : r.ms !== null ? `${r.ms} ms` : '…', x + ch * 0.3, y + ch * 0.7);
      g.textAlign = 'right';
      g.fillStyle = '#ff8f00';
      g.fillText('★'.repeat(r.score), x + cw - ch * 0.2, y + ch * 0.5);
    });
  }
}

export function Reflex({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const players = usePlayers();
  const [game] = useState(() => {
    const g = new ReflexGame();
    g.start(contestants(players));
    return g;
  });
  useButton('a', (remote) => {
    if (game.phase === 'over') game.start(contestants(players));
    else game.press(remote.id);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { go: 'ping', win: 'success', false: 'deny', over: 'cheer' };
  const top = ranked(game.racers);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Press A the instant the screen turns green · too early = you sit the round out · five rounds"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{Math.min(ROUNDS, Math.max(1, game.round))}/{ROUNDS}</div>
              <div className="mg-label">round</div>
            </div>
          </div>
          {game.phase === 'over' && (
            <Results
              title={top.length > 1 ? `${top[0].c.name} wins!` : 'Done!'}
              rating={top[0]?.best !== null && top[0]?.best !== undefined && top[0].best < 250 ? 'Lightning!' : 'Human'}
              rows={top.map((r) => ({ label: r.c.name, value: `${r.score} round${r.score > 1 ? 's' : ''} · best ${r.best ?? '—'} ms`, color: r.c.color }))}
              onAgain={() => game.start(contestants(players))}
            />
          )}
        </>
      )}
    />
  );
}
