import { useState } from 'react';
import { useButton, useInputEvent, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

type Pose = 0 | 1 | 2; // arms down, one arm up, both arms up
interface Bubble {
  x: number;
  y: number;
  r: number;
  pose: Pose;
  vy: number;
  popped: number;
}

/** Bubbles rise with a pose inside; twist the remote to strike the same pose and touch the bubble to pop it. */
class PoseMiiGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'over' = 'ready';
  countdown = 3;
  score = 0;
  lives = 3;
  pose: Pose = 0;
  mii = { x: 0.5, y: 0.5 };
  bubbles: Bubble[] = [];
  private spawnT = 0;
  private level = 0;

  start(): void {
    this.phase = 'ready';
    this.countdown = 3;
    this.score = 0;
    this.lives = 3;
    this.level = 0;
    this.bubbles = [];
    this.hudDirty = true;
  }

  setPointer(nx: number, ny: number, roll: number): void {
    this.mii.x = nx;
    this.mii.y = ny;
    this.pose = roll < -0.4 ? 1 : roll > 0.4 ? 2 : 0;
  }

  cyclePose(dir: number): void {
    this.pose = (((this.pose + dir) % 3) + 3) % 3 as Pose;
  }

  update(dt: number): void {
    if (this.phase === 'ready') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'play';
        this.events.push('go');
      }
      this.hudDirty = true;
      return;
    }
    if (this.phase !== 'play') return;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.bubbles.push({ x: rand(0.1, 0.9), y: 1.1, r: 0.075, pose: Math.floor(Math.random() * 3) as Pose, vy: -(0.08 + this.level * 0.012), popped: 0 });
      this.spawnT = Math.max(0.6, 1.6 - this.level * 0.08);
    }
    for (const b of this.bubbles) {
      if (b.popped > 0) {
        b.popped += dt;
        continue;
      }
      b.y += b.vy * dt;
      const d = Math.hypot((b.x - this.mii.x) * (16 / 9), b.y - this.mii.y);
      if (d < b.r) {
        if (b.pose === this.pose) {
          b.popped = 0.01;
          this.score += 10 + this.level;
          this.level += 1;
          this.events.push('pop');
          this.hudDirty = true;
        }
      }
      if (b.y < -0.15) {
        b.popped = 0.4;
        this.lives -= 1;
        this.events.push('miss');
        this.hudDirty = true;
        if (this.lives <= 0) {
          this.phase = 'over';
          this.events.push('over');
        }
      }
    }
    this.bubbles = this.bubbles.filter((b) => b.popped < 0.35);
  }

  private drawMii(g: CanvasRenderingContext2D, x: number, y: number, s: number, pose: Pose, color: string, alpha = 1): void {
    g.save();
    g.globalAlpha = alpha;
    g.lineCap = 'round';
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = s * 0.22;
    g.beginPath(); g.arc(x, y - s * 0.75, s * 0.32, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(x, y - s * 0.4); g.lineTo(x, y + s * 0.3); g.stroke();
    g.beginPath(); g.moveTo(x, y + s * 0.3); g.lineTo(x - s * 0.3, y + s); g.moveTo(x, y + s * 0.3); g.lineTo(x + s * 0.3, y + s); g.stroke();
    const arm = (side: number, up: boolean) => {
      g.beginPath();
      g.moveTo(x, y - s * 0.3);
      g.lineTo(x + side * s * 0.55, up ? y - s * 0.95 : y + s * 0.25);
      g.stroke();
    };
    arm(-1, pose === 2);
    arm(1, pose >= 1);
    g.restore();
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#ffd1dc');
    bg.addColorStop(1, '#ff8fab');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    for (const b of this.bubbles) {
      const x = b.x * W, y = b.y * H, r = b.r * H;
      if (b.popped > 0) {
        g.strokeStyle = `rgba(255,255,255,${1 - b.popped * 3})`;
        g.lineWidth = r * 0.15;
        g.beginPath(); g.arc(x, y, r * (1 + b.popped * 3), 0, Math.PI * 2); g.stroke();
        continue;
      }
      const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.6, 'rgba(180,230,255,0.35)');
      grad.addColorStop(1, 'rgba(120,200,255,0.55)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      this.drawMii(g, x, y, r * 0.55, b.pose, '#5b3d8a', 0.9);
    }
    this.drawMii(g, this.mii.x * W, this.mii.y * H, H * 0.075, this.pose, '#1d5fa8');
  }
}

export function PoseMii({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new PoseMiiGame();
    g.start();
    return g;
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    if (remote.kind === 'phone') game.setPointer(pointer.x, pointer.y, pointer.roll);
    else game.mii = { x: pointer.x, y: pointer.y };
  });
  useButton(['left', 'right', 'up', 'down'], (_, b) => game.cyclePose(b === 'left' || b === 'down' ? -1 : 1));
  useButton('a', () => {
    if (game.phase === 'over') game.start();
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { pop: 'pop', miss: 'deny', go: 'go', over: 'timeup' };
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Twist the remote to change pose (arrows on keyboard) · match the pose in the bubble and touch it"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{game.score}</div>
              <div className="mg-label">{'♥'.repeat(Math.max(0, game.lives))}</div>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'over' && <Results title="Game over" rating={game.score >= 300 ? 'Pose master!' : game.score >= 120 ? 'Nice moves' : 'Warm up'} rows={[{ label: 'Score', value: String(game.score) }]} onAgain={() => game.start()} />}
        </>
      )}
    />
  );
}
