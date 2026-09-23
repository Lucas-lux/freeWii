import { useState } from 'react';
import { useInputEvent, type ChannelContext, type WiiButton } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

const AH = 9 / 16; // arena height in x units
interface Rect { x: number; y: number; w: number; h: number }
interface Tank { x: number; y: number; angle: number; turret: number; kind: 'player' | 'brown' | 'gray' | 'teal'; alive: boolean; shootT: number; moveT: number; dir: number }
interface Shell { x: number; y: number; vx: number; vy: number; bounces: number; owner: 'player' | 'enemy'; alive: boolean }
interface Mine { x: number; y: number; t: number }
interface Boom { x: number; y: number; t: number; r: number }

const TANK_R = 0.022;
const SPEEDS = { player: 0.2, brown: 0, gray: 0.09, teal: 0.16 };

/** Top-down tank arcade: D-pad drives, the pointer aims, A fires (shells bounce once), B drops a mine. */
class TanksGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'cleared' | 'dead' | 'over' | 'won' = 'ready';
  mission = 1;
  lives = 3;
  score = 0;
  countdown = 2;
  player: Tank = { x: 0.1, y: AH / 2, angle: 0, turret: 0, kind: 'player', alive: true, shootT: 0, moveT: 0, dir: 0 };
  enemies: Tank[] = [];
  shells: Shell[] = [];
  mines: Mine[] = [];
  booms: Boom[] = [];
  walls: Rect[] = [];
  input = { dx: 0, dy: 0 };
  pointer = { x: 0.5, y: 0.5 };

  start(): void {
    this.mission = 1;
    this.lives = 3;
    this.score = 0;
    this.setupMission();
  }

  private setupMission(): void {
    this.phase = 'ready';
    this.countdown = 2;
    this.player = { ...this.player, x: 0.1, y: AH / 2, alive: true, turret: 0 };
    this.shells = [];
    this.mines = [];
    this.booms = [];
    this.walls = [];
    const blocks = 3 + Math.min(5, this.mission);
    for (let i = 0; i < blocks; i++) {
      this.walls.push({ x: rand(0.22, 0.75), y: rand(0.06, AH - 0.14), w: rand(0.04, 0.12), h: rand(0.03, 0.09) });
    }
    this.enemies = [];
    const n = 1 + Math.floor(this.mission * 0.8);
    for (let i = 0; i < n; i++) {
      const kind: Tank['kind'] = this.mission >= 6 && i % 3 === 0 ? 'teal' : this.mission >= 3 && i % 2 === 0 ? 'gray' : 'brown';
      let x = 0, y = 0, tries = 0;
      do {
        x = rand(0.55, 0.92);
        y = rand(0.06, AH - 0.06);
        tries++;
      } while (tries < 30 && this.walls.some((w) => x > w.x - 0.04 && x < w.x + w.w + 0.04 && y > w.y - 0.04 && y < w.y + w.h + 0.04));
      this.enemies.push({ x, y, angle: Math.PI, turret: Math.PI, kind, alive: true, shootT: rand(1.5, 3), moveT: 0, dir: rand(0, Math.PI * 2) });
    }
    this.hudDirty = true;
  }

  fire(): void {
    if (this.phase !== 'play' || !this.player.alive) return;
    if (this.shells.filter((s) => s.owner === 'player' && s.alive).length >= 3) return;
    this.launch(this.player, 'player', 0.55);
    this.events.push('fire');
  }

  dropMine(): void {
    if (this.phase !== 'play' || !this.player.alive || this.mines.length >= 2) return;
    this.mines.push({ x: this.player.x, y: this.player.y, t: 0 });
    this.events.push('mine');
  }

  private launch(t: Tank, owner: Shell['owner'], speed: number): void {
    const a = t.turret;
    this.shells.push({ x: t.x + Math.cos(a) * TANK_R * 1.6, y: t.y + Math.sin(a) * TANK_R * 1.6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, bounces: 0, owner, alive: true });
  }

  private hitsWall(x: number, y: number, r: number): Rect | null {
    if (x < r || x > 1 - r || y < r || y > AH - r) return { x: -1, y: -1, w: 0, h: 0 };
    for (const w of this.walls) if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return w;
    return null;
  }

  private explode(x: number, y: number, r: number): void {
    this.booms.push({ x, y, t: 0, r });
    for (const e of this.enemies) {
      if (e.alive && Math.hypot(e.x - x, e.y - y) < r) {
        e.alive = false;
        this.score += 100;
        this.events.push('boom');
      }
    }
    if (this.player.alive && Math.hypot(this.player.x - x, this.player.y - y) < r) this.killPlayer();
    this.hudDirty = true;
  }

  private killPlayer(): void {
    this.player.alive = false;
    this.lives -= 1;
    this.events.push('boom');
    this.phase = this.lives <= 0 ? 'over' : 'dead';
    this.countdown = 2;
    if (this.lives <= 0) this.events.push('over');
    this.hudDirty = true;
  }

  update(dt: number): void {
    for (const b of this.booms) b.t += dt;
    this.booms = this.booms.filter((b) => b.t < 0.5);
    if (this.phase === 'ready' || this.phase === 'cleared' || this.phase === 'dead') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        if (this.phase === 'cleared') {
          this.mission += 1;
          if (this.mission > 8) {
            this.phase = 'won';
            this.events.push('won');
            this.hudDirty = true;
            return;
          }
          this.setupMission();
        } else if (this.phase === 'dead') this.setupMission();
        else {
          this.phase = 'play';
          this.events.push('go');
          this.hudDirty = true;
        }
      }
      return;
    }
    if (this.phase !== 'play') return;
    const p = this.player;
    // player movement (D-pad), turret follows the pointer
    const mx = this.input.dx, my = this.input.dy;
    if (mx || my) {
      const len = Math.hypot(mx, my) || 1;
      const nx = p.x + (mx / len) * SPEEDS.player * dt;
      const ny = p.y + (my / len) * SPEEDS.player * dt;
      if (!this.hitsWall(nx, p.y, TANK_R)) p.x = nx;
      if (!this.hitsWall(p.x, ny, TANK_R)) p.y = ny;
      p.angle = Math.atan2(my, mx);
    }
    p.turret = Math.atan2(this.pointer.y * AH - p.y, this.pointer.x - p.x);
    // enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.turret = Math.atan2(p.y - e.y, p.x - e.x) + rand(-0.08, 0.08);
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = e.kind === 'teal' ? rand(0.8, 1.6) : e.kind === 'gray' ? rand(1.5, 2.8) : rand(2.5, 4);
        this.launch(e, 'enemy', e.kind === 'teal' ? 0.5 : 0.36);
        this.events.push('efire');
      }
      const sp = SPEEDS[e.kind];
      if (sp > 0) {
        e.moveT -= dt;
        if (e.moveT <= 0) {
          e.moveT = rand(0.6, 1.6);
          e.dir = rand(0, Math.PI * 2);
        }
        const nx = e.x + Math.cos(e.dir) * sp * dt, ny = e.y + Math.sin(e.dir) * sp * dt;
        if (this.hitsWall(nx, ny, TANK_R)) e.dir += Math.PI / 2;
        else {
          e.x = nx;
          e.y = ny;
          e.angle = e.dir;
        }
      }
    }
    // shells
    for (const s of this.shells) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (this.hitsWall(s.x, s.y, 0.004)) {
        if (s.bounces >= 1) {
          s.alive = false;
          continue;
        }
        s.bounces += 1;
        // reflect against the nearer axis
        const back = { x: s.x - s.vx * dt, y: s.y - s.vy * dt };
        if (this.hitsWall(back.x, s.y, 0.004)) s.vy *= -1;
        else s.vx *= -1;
        s.x = back.x;
        s.y = back.y;
        this.events.push('bounce');
      }
      for (const e of this.enemies) {
        if (e.alive && s.owner === 'player' && Math.hypot(e.x - s.x, e.y - s.y) < TANK_R) {
          s.alive = false;
          e.alive = false;
          this.score += e.kind === 'teal' ? 300 : e.kind === 'gray' ? 200 : 100;
          this.booms.push({ x: e.x, y: e.y, t: 0, r: 0.04 });
          this.events.push('boom');
          this.hudDirty = true;
        }
      }
      if (s.alive && p.alive && s.owner === 'enemy' && Math.hypot(p.x - s.x, p.y - s.y) < TANK_R) {
        s.alive = false;
        this.booms.push({ x: p.x, y: p.y, t: 0, r: 0.04 });
        this.killPlayer();
      }
    }
    for (let i = 0; i < this.shells.length; i++) {
      for (let j = i + 1; j < this.shells.length; j++) {
        const a = this.shells[i], b = this.shells[j];
        if (a.alive && b.alive && Math.hypot(a.x - b.x, a.y - b.y) < 0.012) a.alive = b.alive = false;
      }
    }
    this.shells = this.shells.filter((s) => s.alive);
    // mines
    for (const m of this.mines) {
      m.t += dt;
      const near = this.enemies.some((e) => e.alive && Math.hypot(e.x - m.x, e.y - m.y) < 0.035);
      if (m.t > 3 || (m.t > 0.8 && near)) {
        m.t = 99;
        this.explode(m.x, m.y, 0.07);
      }
    }
    this.mines = this.mines.filter((m) => m.t < 99);
    if (this.phase === 'play' && this.enemies.every((e) => !e.alive)) {
      this.phase = 'cleared';
      this.countdown = 2;
      this.score += 250;
      this.events.push('cleared');
      this.hudDirty = true;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const u = W;
    g.fillStyle = '#d6c39a';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.05)';
    g.lineWidth = 1;
    for (let x = 0; x < 1; x += 0.05) {
      g.beginPath(); g.moveTo(x * u, 0); g.lineTo(x * u, H); g.stroke();
    }
    for (let y = 0; y < AH; y += 0.05) {
      g.beginPath(); g.moveTo(0, y * u); g.lineTo(W, y * u); g.stroke();
    }
    for (const w of this.walls) {
      g.fillStyle = '#8b5e3c';
      g.fillRect(w.x * u, w.y * u, w.w * u, w.h * u);
      g.fillStyle = '#a97142';
      g.fillRect(w.x * u, w.y * u, w.w * u, w.h * u * 0.3);
    }
    for (const m of this.mines) {
      g.fillStyle = m.t % 0.4 < 0.2 ? '#fbbf24' : '#78350f';
      g.beginPath(); g.arc(m.x * u, m.y * u, 0.01 * u, 0, Math.PI * 2); g.fill();
    }
    const tank = (t: Tank, body: string) => {
      const r = TANK_R * u;
      g.save();
      g.translate(t.x * u, t.y * u);
      g.rotate(t.angle);
      g.fillStyle = '#333';
      g.fillRect(-r, -r * 1.1, r * 2, r * 0.35);
      g.fillRect(-r, r * 0.75, r * 2, r * 0.35);
      g.fillStyle = body;
      g.beginPath(); g.roundRect(-r * 0.9, -r * 0.8, r * 1.8, r * 1.6, r * 0.3); g.fill();
      g.restore();
      g.save();
      g.translate(t.x * u, t.y * u);
      g.rotate(t.turret);
      g.fillStyle = body;
      g.beginPath(); g.arc(0, 0, r * 0.55, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#222';
      g.fillRect(0, -r * 0.14, r * 1.7, r * 0.28);
      g.restore();
    };
    for (const e of this.enemies) if (e.alive) tank(e, e.kind === 'teal' ? '#0d9488' : e.kind === 'gray' ? '#6b7280' : '#92400e');
    if (this.player.alive) tank(this.player, '#2563eb');
    for (const s of this.shells) {
      g.fillStyle = s.owner === 'player' ? '#111' : '#7f1d1d';
      g.beginPath(); g.arc(s.x * u, s.y * u, 0.005 * u, 0, Math.PI * 2); g.fill();
    }
    for (const b of this.booms) {
      const k = b.t / 0.5;
      g.fillStyle = `rgba(255,${Math.floor(200 - k * 150)},50,${1 - k})`;
      g.beginPath(); g.arc(b.x * u, b.y * u, b.r * u * (0.5 + k), 0, Math.PI * 2); g.fill();
    }
  }
}

export function Tanks({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new TanksGame();
    g.start();
    return g;
  });
  const held = useState(() => new Set<WiiButton>())[0];
  const applyMove = () => {
    game.input.dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    game.input.dy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
  };
  useInputEvent('pointer', ({ pointer }) => {
    game.pointer = { x: pointer.x, y: pointer.y };
  });
  useInputEvent('buttondown', ({ button }) => {
    if (button === 'a') {
      if (game.phase === 'over' || game.phase === 'won') game.start();
      else game.fire();
    } else if (button === 'b') game.dropMine();
    else if (button === 'up' || button === 'down' || button === 'left' || button === 'right') {
      held.add(button);
      applyMove();
    }
  });
  useInputEvent('buttonup', ({ button }) => {
    if (held.delete(button)) applyMove();
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { fire: 'shot', efire: 'tick', bounce: 'ping', boom: 'crash', mine: 'select', cleared: 'success', go: 'go', over: 'fail', won: 'strike' };
  const alive = game.enemies.filter((e) => e.alive).length;
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hideCursor={false}
      hint="D-pad drives · pointer aims · A fires (shells bounce once, 3 at a time) · B drops a mine"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{game.score}</div>
              <div className="mg-label">
                Mission {game.mission}/8 · {alive} enem{alive === 1 ? 'y' : 'ies'} · {'♥'.repeat(Math.max(0, game.lives))}
              </div>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small={`Mission ${game.mission}`} big="Ready" keyId={`m${game.mission}`} />}
          {game.phase === 'cleared' && <CenterCard big="Mission clear!" keyId={`c${game.mission}`} />}
          {game.phase === 'dead' && <CenterCard big="Tank destroyed" keyId={`d${game.lives}`} />}
          {(game.phase === 'over' || game.phase === 'won') && (
            <Results
              title={game.phase === 'won' ? 'All missions clear!' : 'Game over'}
              rating={game.phase === 'won' ? 'Commander!' : game.mission >= 5 ? 'Brave' : 'Reload'}
              rows={[
                { label: 'Score', value: String(game.score) },
                { label: 'Missions', value: String(game.phase === 'won' ? 8 : game.mission - 1) },
              ]}
              onAgain={() => game.start()}
            />
          )}
        </>
      )}
    />
  );
}
