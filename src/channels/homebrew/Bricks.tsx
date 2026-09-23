import { useState } from 'react';
import { PLAYER_COLORS, useButton, useInputEvent, usePlayers, type ChannelContext, type Wiimote } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

interface Paddle {
  id: string;
  name: string;
  color: string;
  x: number;
  w: number;
  wideT: number;
}
interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Paddle the ball rests on before launch. */
  stuck: string | null;
}
interface Brick {
  x: number;
  y: number;
  hp: number;
  color: string;
}
type Power = 'wide' | 'multi' | 'slow' | 'life';
interface Drop {
  x: number;
  y: number;
  kind: Power;
}

const BW = 0.082, BH = 0.045, PAD_Y = 0.93, PAD_H = 0.022, BALL_R = 0.012, SPEED = 0.55;
const POWER_COLORS: Record<Power, string> = { wide: '#42a5f5', multi: '#ffca28', slow: '#66bb6a', life: '#ef5350' };
const POWER_ICONS: Record<Power, string> = { wide: '↔', multi: '×3', slow: '🐢', life: '♥' };
const ROW_COLORS = ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5', '#ab47bc'];

function layout(level: number): Brick[] {
  const out: Brick[] = [];
  const cols = 10, x0 = 0.5 - (cols * (BW + 0.008)) / 2 + 0.004;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < cols; c++) {
      if (level === 2 && (r + c) % 2 === 1) continue;
      if (level === 3 && Math.abs(c - 4.5) > r + 0.6) continue;
      const hp = level === 3 && r < 2 ? 2 : level === 2 && r === 0 ? 2 : 1;
      out.push({ x: x0 + c * (BW + 0.008), y: 0.12 + r * (BH + 0.01), hp, color: ROW_COLORS[r] });
    }
  }
  return out;
}

/** Breakout with one paddle per remote, shared balls and lives. */
class BricksGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'clear' | 'over' | 'won' = 'ready';
  level = 1;
  score = 0;
  lives = 3;
  paddles: Paddle[] = [];
  balls: Ball[] = [];
  bricks: Brick[] = [];
  drops: Drop[] = [];
  slowT = 0;
  private timer = 0;
  private t = 0;

  start(players: Wiimote[]): void {
    this.paddles = players.map((r, i) => ({ id: r.id, name: r.kind === 'phone' ? r.name : `Player ${r.player}`, color: PLAYER_COLORS[(r.player - 1 + 4) % 4], x: 0.5 + (i - (players.length - 1) / 2) * 0.2, w: 0.14, wideT: 0 }));
    this.level = 1;
    this.score = 0;
    this.lives = 3;
    this.loadLevel();
  }

  private loadLevel(): void {
    this.bricks = layout(this.level);
    this.drops = [];
    this.slowT = 0;
    this.serve();
  }

  private serve(): void {
    const p = this.paddles[0];
    this.balls = [{ x: p ? p.x : 0.5, y: PAD_Y - PAD_H - BALL_R, vx: 0, vy: 0, stuck: p ? p.id : null }];
    this.phase = 'ready';
    this.hudDirty = true;
  }

  setPaddle(id: string, x: number): void {
    const p = this.paddles.find((q) => q.id === id);
    if (!p) return;
    p.x = Math.max(p.w / 2, Math.min(1 - p.w / 2, x));
    for (const b of this.balls) if (b.stuck === id) b.x = p.x;
  }

  launch(id: string): void {
    if (this.phase === 'ready') this.phase = 'play';
    if (this.phase !== 'play') return;
    for (const b of this.balls) {
      if (b.stuck !== id && b.stuck !== null && this.balls.length > 1) continue;
      if (b.stuck === null) continue;
      b.stuck = null;
      b.vx = rand(-0.3, 0.3) * SPEED;
      b.vy = -SPEED;
      this.events.push('launch');
    }
    this.hudDirty = true;
  }

  private loseBall(): void {
    this.lives -= 1;
    this.events.push('lost');
    if (this.lives <= 0) {
      this.phase = 'over';
      this.events.push('over');
    } else this.serve();
    this.hudDirty = true;
  }

  private catchPower(kind: Power, p: Paddle): void {
    this.events.push('power');
    if (kind === 'wide') {
      p.w = 0.22;
      p.wideT = 12;
    } else if (kind === 'slow') this.slowT = 8;
    else if (kind === 'life') this.lives += 1;
    else {
      const extra: Ball[] = [];
      for (const b of this.balls.filter((x) => !x.stuck)) {
        for (const a of [-0.5, 0.5]) {
          const ang = Math.atan2(b.vy, b.vx) + a;
          const sp = Math.hypot(b.vx, b.vy);
          extra.push({ x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, stuck: null });
        }
      }
      this.balls.push(...extra.slice(0, 8));
    }
    this.hudDirty = true;
  }

  update(dt: number): void {
    this.t += dt;
    for (const p of this.paddles) {
      if (p.wideT > 0) {
        p.wideT -= dt;
        if (p.wideT <= 0) p.w = 0.14;
      }
    }
    if (this.slowT > 0) this.slowT -= dt;
    if (this.phase === 'clear') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.level += 1;
        this.loadLevel();
      }
      return;
    }
    if (this.phase !== 'play' && this.phase !== 'ready') return;
    const k = this.slowT > 0 ? 0.65 : 1 + (this.level - 1) * 0.12;
    for (const b of this.balls) {
      if (b.stuck) continue;
      b.x += b.vx * k * dt;
      b.y += b.vy * k * dt * (16 / 9);
      if (b.x < BALL_R) (b.x = BALL_R), (b.vx = Math.abs(b.vx));
      if (b.x > 1 - BALL_R) (b.x = 1 - BALL_R), (b.vx = -Math.abs(b.vx));
      if (b.y < BALL_R + 0.02) (b.y = BALL_R + 0.02), (b.vy = Math.abs(b.vy));
      // paddles
      if (b.vy > 0 && b.y + BALL_R >= PAD_Y - PAD_H && b.y + BALL_R <= PAD_Y + PAD_H) {
        for (const p of this.paddles) {
          if (Math.abs(b.x - p.x) <= p.w / 2 + BALL_R * 0.5) {
            const off = (b.x - p.x) / (p.w / 2);
            const ang = -Math.PI / 2 + off * 1.05;
            const sp = Math.max(SPEED, Math.hypot(b.vx, b.vy)) * 1.01;
            b.vx = Math.cos(ang) * sp;
            b.vy = Math.sin(ang) * sp;
            b.y = PAD_Y - PAD_H - BALL_R;
            this.events.push('paddle');
            break;
          }
        }
      }
      // bricks
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const br = this.bricks[i];
        if (b.x + BALL_R < br.x || b.x - BALL_R > br.x + BW || b.y + BALL_R < br.y || b.y - BALL_R > br.y + BH) continue;
        const dx = Math.min(b.x + BALL_R - br.x, br.x + BW - (b.x - BALL_R));
        const dy = Math.min(b.y + BALL_R - br.y, br.y + BH - (b.y - BALL_R)) * (16 / 9);
        if (dx < dy) b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        else b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        br.hp -= 1;
        this.score += 10 * this.level;
        if (br.hp <= 0) {
          this.bricks.splice(i, 1);
          this.events.push('brick');
          if (Math.random() < 0.14) this.drops.push({ x: br.x + BW / 2, y: br.y, kind: (['wide', 'multi', 'slow', 'life'] as Power[])[Math.floor(Math.random() * 4)] });
        } else this.events.push('thud');
        this.hudDirty = true;
        break;
      }
    }
    const before = this.balls.length;
    this.balls = this.balls.filter((b) => b.stuck || b.y < 1.05);
    if (this.balls.length === 0 && before > 0) this.loseBall();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y += 0.22 * dt;
      const p = this.paddles.find((q) => Math.abs(d.x - q.x) < q.w / 2 + 0.01 && d.y > PAD_Y - PAD_H * 2 && d.y < PAD_Y + PAD_H * 2);
      if (p) {
        this.catchPower(d.kind, p);
        this.drops.splice(i, 1);
      } else if (d.y > 1.05) this.drops.splice(i, 1);
    }
    if (this.bricks.length === 0 && this.phase === 'play') {
      if (this.level >= 3) {
        this.phase = 'won';
        this.events.push('won');
      } else {
        this.phase = 'clear';
        this.timer = 2;
        this.events.push('clear');
      }
      this.hudDirty = true;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = g.createRadialGradient(W / 2, H * 1.2, H * 0.1, W / 2, H * 0.5, H);
    bg.addColorStop(0, '#123a6b');
    bg.addColorStop(0.6, '#071a33');
    bg.addColorStop(1, '#02060f');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(160,210,255,0.35)';
    for (let i = 0; i < 10; i++) {
      const y = H * (1.1 - ((this.t * 0.05 + i * 0.13) % 1.2));
      g.beginPath();
      g.arc(W * ((i * 0.37) % 1), y, W * (0.006 + (i % 3) * 0.004), 0, Math.PI * 2);
      g.stroke();
    }
    for (const br of this.bricks) {
      g.fillStyle = br.color;
      g.beginPath();
      g.roundRect(br.x * W, br.y * H, BW * W, BH * H, W * 0.006);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(br.x * W, br.y * H, BW * W, BH * H * 0.25);
      if (br.hp > 1) {
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = W * 0.003;
        g.strokeRect(br.x * W + W * 0.006, br.y * H + H * 0.008, BW * W - W * 0.012, BH * H - H * 0.016);
      }
    }
    for (const d of this.drops) {
      g.fillStyle = POWER_COLORS[d.kind];
      g.beginPath();
      g.roundRect((d.x - 0.02) * W, (d.y - 0.02) * H, 0.04 * W, 0.04 * H, W * 0.008);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `900 ${H * 0.026}px Nunito, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(POWER_ICONS[d.kind], d.x * W, d.y * H);
    }
    for (const p of this.paddles) {
      g.fillStyle = p.color;
      g.shadowColor = p.color;
      g.shadowBlur = W * 0.01;
      g.beginPath();
      g.roundRect((p.x - p.w / 2) * W, (PAD_Y - PAD_H) * H, p.w * W, PAD_H * 2 * H, PAD_H * H);
      g.fill();
      g.shadowBlur = 0;
    }
    for (const b of this.balls) {
      g.fillStyle = '#fff';
      g.shadowColor = '#82b1ff';
      g.shadowBlur = W * 0.012;
      g.beginPath();
      g.arc(b.x * W, b.y * H, BALL_R * W, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }
  }
}

export function Bricks({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const players = usePlayers();
  const [game] = useState(() => {
    const g = new BricksGame();
    g.start(players);
    return g;
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    if (pointer.onScreen) game.setPaddle(remote.id, pointer.x);
  });
  useButton('a', (remote) => {
    if (game.phase === 'over' || game.phase === 'won') game.start(players);
    else game.launch(remote.id);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { launch: 'whoosh', paddle: 'tick', brick: 'pop', thud: 'hit', power: 'success', lost: 'aww', over: 'fail', clear: 'stage', won: 'cheer' };
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Point left / right to move your paddle · A launches the ball · catch the falling power-ups · three levels"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{game.score}</div>
              <div className="mg-label">
                level {game.level}/3 · {'♥'.repeat(Math.max(0, game.lives))}
              </div>
            </div>
            <div className="mg-scores">
              {game.paddles.map((p) => (
                <div key={p.id} className="mg-score" style={{ borderColor: p.color }}>
                  {p.wideT > 0 ? '↔ wide' : 'paddle'}
                  <small>{p.name}</small>
                </div>
              ))}
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small={`Level ${game.level}`} big="Press A" keyId={`ready${game.level}${game.lives}`} />}
          {game.phase === 'clear' && <CenterCard small="Level clear!" big="Next" keyId={`clear${game.level}`} />}
          {(game.phase === 'over' || game.phase === 'won') && (
            <Results
              title={game.phase === 'won' ? 'You broke them all!' : 'Game over'}
              rating={game.score >= 2500 ? 'Homebrew hero' : game.score >= 1200 ? 'Brick layer' : 'Warming up'}
              rows={[
                { label: 'Score', value: String(game.score) },
                { label: 'Level', value: `${game.level}/3` },
              ]}
              onAgain={() => game.start(players)}
            />
          )}
        </>
      )}
    />
  );
}
