import { useState } from 'react';
import { PLAYER_COLORS, useButton, useInputEvent, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, type CanvasGame } from '../_shared/MiniGame';

interface Mallet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  cpu: boolean;
  score: number;
}

const GOAL = 5;
const MALLET_W = 0.018;
const MALLET_H = 0.11;
const PUCK_R = 0.014;

/** Neon air hockey: pointer moves your mallet on your half, first to 5 goals. Second remote or CPU on the right. */
class LaserHockeyGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'goal' | 'over' = 'ready';
  countdown = 3;
  left: Mallet = { x: 0.12, y: 0.5, vx: 0, vy: 0, cpu: false, score: 0 };
  right: Mallet = { x: 0.88, y: 0.5, vx: 0, vy: 0, cpu: true, score: 0 };
  puck = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  private trail: { x: number; y: number }[] = [];
  private targets = { left: { x: 0.12, y: 0.5 }, right: { x: 0.88, y: 0.5 } };

  start(twoPlayers: boolean): void {
    this.right.cpu = !twoPlayers;
    this.left.score = 0;
    this.right.score = 0;
    this.phase = 'ready';
    this.countdown = 3;
    this.reset(1);
    this.hudDirty = true;
  }

  private reset(dir: number): void {
    this.puck = { x: 0.5, y: 0.5, vx: 0.28 * dir, vy: (Math.random() - 0.5) * 0.2 };
    this.trail = [];
  }

  setTarget(side: 'left' | 'right', nx: number, ny: number): void {
    const t = this.targets[side];
    t.x = side === 'left' ? Math.max(0.03, Math.min(0.47, nx)) : Math.max(0.53, Math.min(0.97, nx));
    t.y = Math.max(0.08, Math.min(0.92, ny));
  }

  update(dt: number): void {
    if (this.phase === 'ready' || this.phase === 'goal') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'play';
        this.events.push('go');
        this.hudDirty = true;
      }
    }
    if (this.right.cpu) {
      const t = this.targets.right;
      t.y = this.puck.y + (this.puck.vx > 0 ? 0 : (0.5 - this.puck.y) * 0.5);
      t.x = this.puck.vx > 0 && this.puck.x > 0.55 ? Math.max(0.6, this.puck.x - 0.08) : 0.88;
    }
    for (const [m, t] of [[this.left, this.targets.left], [this.right, this.targets.right]] as const) {
      const nx = m.x + (t.x - m.x) * Math.min(1, dt * (m.cpu ? 5 : 16));
      const ny = m.y + (t.y - m.y) * Math.min(1, dt * (m.cpu ? 5 : 16));
      m.vx = (nx - m.x) / Math.max(dt, 1e-3);
      m.vy = (ny - m.y) / Math.max(dt, 1e-3);
      m.x = nx;
      m.y = ny;
    }
    if (this.phase !== 'play') return;
    const p = this.puck;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y < PUCK_R + 0.06 || p.y > 0.94 - PUCK_R) {
      p.vy *= -1;
      p.y = Math.max(PUCK_R + 0.06, Math.min(0.94 - PUCK_R, p.y));
      this.events.push('wall');
    }
    const inGoal = p.y > 0.3 && p.y < 0.7;
    if (p.x < 0.02) {
      if (inGoal) return this.goal(this.right);
      p.vx = Math.abs(p.vx);
    } else if (p.x > 0.98) {
      if (inGoal) return this.goal(this.left);
      p.vx = -Math.abs(p.vx);
    }
    for (const m of [this.left, this.right]) {
      const dx = p.x - m.x, dy = p.y - m.y;
      if (Math.abs(dx) < MALLET_W + PUCK_R && Math.abs(dy) < MALLET_H / 2 + PUCK_R) {
        const dir = m === this.left ? 1 : -1;
        const speed = Math.min(1.4, Math.hypot(p.vx, p.vy) * 1.06 + Math.abs(m.vx) * 0.25 + 0.05);
        const angle = (dy / (MALLET_H / 2)) * 0.9;
        p.vx = Math.cos(angle) * speed * dir;
        p.vy = Math.sin(angle) * speed + m.vy * 0.15;
        p.x = m.x + dir * (MALLET_W + PUCK_R + 0.002);
        this.events.push('hit');
      }
    }
    this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 12) this.trail.shift();
  }

  private goal(scorer: Mallet): void {
    scorer.score += 1;
    this.events.push('goal');
    this.hudDirty = true;
    if (scorer.score >= GOAL) {
      this.phase = 'over';
      this.events.push('over');
      return;
    }
    this.phase = 'goal';
    this.countdown = 1.5;
    this.reset(scorer === this.left ? -1 : 1);
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    g.fillStyle = '#05060f';
    g.fillRect(0, 0, W, H);
    const neon = (color: string, w: number) => {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.shadowColor = color;
      g.shadowBlur = w * 3;
    };
    neon('#38bdf8', W * 0.004);
    g.strokeRect(W * 0.02, H * 0.06, W * 0.96, H * 0.88);
    g.beginPath(); g.moveTo(W / 2, H * 0.06); g.lineTo(W / 2, H * 0.94); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, H * 0.12, 0, Math.PI * 2); g.stroke();
    neon('#f472b6', W * 0.006);
    g.beginPath(); g.moveTo(W * 0.02, H * 0.3); g.lineTo(W * 0.02, H * 0.7); g.moveTo(W * 0.98, H * 0.3); g.lineTo(W * 0.98, H * 0.7); g.stroke();
    g.shadowBlur = 0;
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      g.fillStyle = `rgba(250,250,120,${(i / this.trail.length) * 0.4})`;
      g.beginPath(); g.arc(t.x * W, t.y * H, PUCK_R * W * (0.4 + (i / this.trail.length) * 0.6), 0, Math.PI * 2); g.fill();
    }
    for (const [m, color] of [[this.left, PLAYER_COLORS[0]], [this.right, this.right.cpu ? '#f97316' : PLAYER_COLORS[1]]] as const) {
      g.fillStyle = color;
      g.shadowColor = color;
      g.shadowBlur = W * 0.02;
      g.beginPath();
      g.roundRect((m.x - MALLET_W) * W, (m.y - MALLET_H / 2) * H, MALLET_W * 2 * W, MALLET_H * H, W * 0.008);
      g.fill();
    }
    g.fillStyle = '#fef08a';
    g.shadowColor = '#fef08a';
    g.shadowBlur = W * 0.02;
    g.beginPath(); g.arc(this.puck.x * W, this.puck.y * H, PUCK_R * W, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  }
}

export function LaserHockey({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new LaserHockeyGame();
    g.start(ctx.players.length >= 2);
    return g;
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    const idx = ctx.players.findIndex((p) => p.id === remote.id);
    if (idx === 0 || idx === -1) game.setTarget('left', pointer.x, pointer.y);
    else if (idx === 1 && !game.right.cpu) game.setTarget('right', pointer.x, pointer.y);
  });
  useButton('a', () => {
    if (game.phase === 'over') game.start(ctx.players.length >= 2);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { hit: 'ping', wall: 'tick', goal: 'success', go: 'go', over: 'strike' };
  const rightName = game.right.cpu ? 'CPU' : 'Player 2';
  const rightColor = game.right.cpu ? '#f97316' : PLAYER_COLORS[1];
  const winner = game.left.score > game.right.score ? 'Player 1' : rightName;
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint={`Pointer moves your mallet · first to ${GOAL} goals · a second remote plays on the right`}
      hud={() => (
        <>
          <div className="mg-hud">
            <div className="mg-score" style={{ borderColor: PLAYER_COLORS[0] }}>
              {game.left.score}
              <small>Player 1</small>
            </div>
            <div className="mg-score" style={{ borderColor: rightColor }}>
              {game.right.score}
              <small>{rightName}</small>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'goal' && <CenterCard big="GOAL!" keyId={`g${game.left.score}-${game.right.score}`} />}
          {game.phase === 'over' && (
            <Results
              title={`${winner} wins!`}
              rows={[
                { label: 'Player 1', value: String(game.left.score), color: PLAYER_COLORS[0] },
                { label: rightName, value: String(game.right.score), color: rightColor },
              ]}
              onAgain={() => game.start(ctx.players.length >= 2)}
            />
          )}
        </>
      )}
    />
  );
}
