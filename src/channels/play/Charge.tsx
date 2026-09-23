import { useState } from 'react';
import { useButton, useInputEvent, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

interface Thing {
  lane: number;
  z: number;
  kind: 'scarecrow' | 'hurdle';
  hit: boolean;
  /** seconds since it was hit (spin / tumble animation) */
  hitT: number;
  spin: number;
}

interface Puff {
  lane: number;
  z: number;
  t: number;
}

/** Ride the cow down the field: tilt to change lane, shake (swing) to jump hurdles, ram scarecrows for points. */
class ChargeGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'over' = 'ready';
  countdown = 3;
  time = 60;
  score = 0;
  lane = 1;
  laneX = 1;
  jump = 0;
  speed = 1.3;
  stumble = 0;
  things: Thing[] = [];
  puffs: Puff[] = [];
  private dist = 0;
  private spawnZ = 6;
  private lastTick = -1;

  start(): void {
    this.phase = 'ready';
    this.countdown = 3;
    this.time = 60;
    this.score = 0;
    this.lane = 1;
    this.laneX = 1;
    this.jump = 0;
    this.speed = 1.3;
    this.stumble = 0;
    this.things = [];
    this.puffs = [];
    this.dist = 0;
    this.spawnZ = 6;
    this.hudDirty = true;
  }

  steer(dir: number): void {
    if (this.phase !== 'play') return;
    this.lane = Math.max(0, Math.min(2, this.lane + dir));
  }

  /** Tilt input from the remote roll (radians): pick the lane by sign. */
  tilt(roll: number): void {
    if (this.phase !== 'play') return;
    this.lane = roll < -0.3 ? 0 : roll > 0.3 ? 2 : 1;
  }

  doJump(): void {
    if (this.phase === 'play' && this.jump <= 0 && this.stumble <= 0) {
      this.jump = 1;
      this.events.push('jump');
    }
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
    this.time -= dt;
    if (Math.ceil(this.time) !== this.lastTick) {
      this.lastTick = Math.ceil(this.time);
      this.hudDirty = true;
      if (this.lastTick <= 3 && this.lastTick > 0) this.events.push('tick');
    }
    if (this.time <= 0) {
      this.phase = 'over';
      this.events.push('over');
      this.hudDirty = true;
      return;
    }
    this.laneX += (this.lane - this.laneX) * Math.min(1, dt * 9);
    if (this.jump > 0) this.jump = Math.max(0, this.jump - dt * 1.6);
    if (this.stumble > 0) this.stumble = Math.max(0, this.stumble - dt);
    const v = this.stumble > 0 ? 0.35 : this.speed;
    this.dist += v * dt;
    this.speed = Math.min(2.4, this.speed + dt * 0.015);
    while (this.spawnZ < this.dist + 10) {
      const lane = Math.floor(rand(0, 3));
      this.things.push({ lane, z: this.spawnZ, kind: Math.random() < 0.6 ? 'scarecrow' : 'hurdle', hit: false, hitT: 0, spin: Math.random() < 0.5 ? -1 : 1 });
      if (Math.random() < 0.4) this.things.push({ lane: (lane + 1 + Math.floor(rand(0, 2))) % 3, z: this.spawnZ + 0.6, kind: 'scarecrow', hit: false, hitT: 0, spin: 1 });
      this.spawnZ += rand(1.4, 2.4);
    }
    for (const p of this.puffs) p.t += dt;
    this.puffs = this.puffs.filter((p) => p.t < 0.6);
    if (Math.random() < dt * 6) this.puffs.push({ lane: this.laneX + rand(-0.2, 0.2), z: this.dist + 0.3, t: 0 });
    for (const t of this.things) {
      if (t.hit) t.hitT += dt;
      const rel = t.z - this.dist;
      if (t.hit || rel > 0.25 || rel < -0.25 || Math.abs(t.lane - this.laneX) > 0.45) continue;
      t.hit = true;
      this.puffs.push({ lane: t.lane, z: t.z, t: 0 }, { lane: t.lane + 0.2, z: t.z + 0.1, t: 0.1 });
      if (t.kind === 'scarecrow') {
        this.score += 10;
        this.events.push('hit');
      } else if (this.jump > 0.25 && this.jump < 0.9) {
        t.hit = false; // cleared it: the hurdle stays up
        this.score += 5;
        this.events.push('jumped');
      } else {
        this.stumble = 1.1;
        this.events.push('crash');
      }
      this.hudDirty = true;
    }
    this.things = this.things.filter((t) => t.z - this.dist > -1 && t.hitT < 1.2);
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.45);
    sky.addColorStop(0, '#7dd3fc');
    sky.addColorStop(1, '#e0f2fe');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const proj = (lane: number, z: number) => {
      const t = Math.max(0.02, z / 10);
      const s = 1 / (1 + t * 9);
      return { x: W / 2 + (lane - 1) * W * 0.36 * s, y: H * 0.42 + H * 0.62 * s, s };
    };
    const far = proj(0, 10), near = proj(0, 0);
    g.fillStyle = '#65a30d';
    g.fillRect(0, far.y - H * 0.02, W, H);
    g.fillStyle = '#a3e635';
    g.beginPath();
    g.moveTo(proj(-0.6, 0).x, near.y); g.lineTo(proj(-0.6, 10).x, far.y); g.lineTo(proj(2.6, 10).x, far.y); g.lineTo(proj(2.6, 0).x, near.y);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = Math.max(1, W * 0.002);
    for (const l of [-0.5, 0.5, 1.5, 2.5]) {
      g.beginPath(); g.moveTo(proj(l, 0).x, near.y); g.lineTo(proj(l, 10).x, far.y); g.stroke();
    }
    const items = this.things.filter((t) => t.z - this.dist > -0.4 && t.z - this.dist < 10).sort((a, b) => b.z - a.z);
    for (const t of items) {
      const p = proj(t.lane, t.z - this.dist);
      const h = H * 0.42 * p.s;
      g.save();
      if (t.hit) {
        // knocked: tumble up and to the side, then fade
        const k = t.hitT;
        g.globalAlpha = Math.max(0, 1 - k / 1.2);
        g.translate(p.x + t.spin * k * h * 1.2, p.y - Math.sin(Math.min(1, k) * Math.PI) * h * 1.6);
        g.rotate(t.spin * k * 7);
        g.translate(-p.x, -p.y);
      }
      if (t.kind === 'hurdle') {
        g.fillStyle = '#92400e';
        g.fillRect(p.x - h * 0.6, p.y - h * 0.45, h * 1.2, h * 0.1);
        g.fillRect(p.x - h * 0.55, p.y - h * 0.45, h * 0.1, h * 0.45);
        g.fillRect(p.x + h * 0.45, p.y - h * 0.45, h * 0.1, h * 0.45);
      } else {
        g.fillStyle = '#b45309';
        g.fillRect(p.x - h * 0.05, p.y - h, h * 0.1, h);
        g.fillRect(p.x - h * 0.4, p.y - h * 0.75, h * 0.8, h * 0.1);
        g.fillStyle = '#fde68a';
        g.beginPath(); g.arc(p.x, p.y - h * 0.95, h * 0.18, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#7c2d12';
        g.beginPath(); g.arc(p.x, p.y - h * 1.08, h * 0.2, Math.PI, 0); g.fill();
      }
      g.restore();
    }
    for (const pf of this.puffs) {
      const p = proj(pf.lane, pf.z - this.dist);
      const k = pf.t / 0.6;
      g.fillStyle = `rgba(214,198,160,${0.6 * (1 - k)})`;
      g.beginPath(); g.arc(p.x, p.y - k * H * 0.05, H * 0.03 * p.s * (0.5 + k), 0, Math.PI * 2); g.fill();
    }
    const cp = proj(this.laneX, 0.6);
    const jumpY = Math.sin(this.jump * Math.PI) * H * 0.18;
    const gallop = this.phase === 'play' && this.stumble <= 0 ? Math.abs(Math.sin(this.dist * 9)) * H * 0.02 : 0;
    const cy = cp.y - jumpY - gallop + (this.stumble > 0 ? Math.sin(this.stumble * 40) * H * 0.01 : 0);
    const s = H * 0.13;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(cp.x, cp.y, s * 0.9, s * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fafafa';
    g.beginPath(); g.roundRect(cp.x - s * 0.75, cy - s * 1.1, s * 1.5, s * 0.9, s * 0.3); g.fill();
    g.fillStyle = '#1f2937';
    g.beginPath(); g.ellipse(cp.x - s * 0.3, cy - s * 0.8, s * 0.25, s * 0.18, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cp.x + s * 0.35, cy - s * 0.5, s * 0.2, s * 0.15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fca5a5';
    g.beginPath(); g.ellipse(cp.x, cy - s * 0.35, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3b82f6';
    g.beginPath(); g.roundRect(cp.x - s * 0.28, cy - s * 1.75, s * 0.56, s * 0.7, s * 0.15); g.fill();
    g.fillStyle = '#f1c27d';
    g.beginPath(); g.arc(cp.x, cy - s * 1.95, s * 0.24, 0, Math.PI * 2); g.fill();
  }
}

export function Charge({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new ChargeGame();
    g.start();
    return g;
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    if (remote.kind === 'phone') game.tilt(pointer.roll);
  });
  useInputEvent('swing', () => game.doJump());
  useButton(['left', 'right'], (_, b) => game.steer(b === 'left' ? -1 : 1));
  useButton('a', () => {
    if (game.phase === 'over') game.start();
    else game.doJump();
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { hit: 'pop', jumped: 'ping', jump: 'whoosh', crash: 'hit', go: 'go', over: 'timeup', tick: 'countdown' };
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Tilt the remote (or ◀ ▶) to change lane · shake or press A to jump hurdles · ram scarecrows for points"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{Math.max(0, Math.ceil(game.time))}</div>
              <div className="mg-label">seconds</div>
            </div>
            <div className="mg-score" style={{ borderColor: '#3b82f6' }}>
              {game.score}
              <small>scarecrows</small>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'over' && <Results title="Time's up!" rating={game.score >= 250 ? 'Stampede!' : game.score >= 120 ? 'Good ride' : 'Moo'} rows={[{ label: 'Score', value: String(game.score) }]} onAgain={() => game.start()} />}
        </>
      )}
    />
  );
}
