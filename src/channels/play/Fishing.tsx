import { useState } from 'react';
import { PLAYER_COLORS, useButton, useInputEvent, type ChannelContext, type Wiimote } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

type FishId = 'fry' | 'minnow' | 'sunfish' | 'puffer' | 'gar' | 'king';
type Pattern = 'none' | 'spots' | 'stripes' | 'scales' | 'streaks';

export interface FishKind {
  id: FishId;
  name: string;
  points: number;
  size: number;
  speed: number;
  weight: number;
  body: string;
  belly: string;
  fin: string;
  pattern: Pattern;
  long: boolean;
}

/** Six species drawn after the sticker sheet: small fry, minnow, sunfish, puffer, tiger gar, king fish. */
export const KINDS: FishKind[] = [
  { id: 'fry', name: 'Small fry', points: 20, size: 0.7, speed: 0.07, weight: 6, body: '#7cb342', belly: '#f5f5f5', fin: '#558b2f', pattern: 'none', long: false },
  { id: 'minnow', name: 'Minnow', points: 10, size: 0.6, speed: 0.09, weight: 5, body: '#9e9e9e', belly: '#e0e0e0', fin: '#757575', pattern: 'spots', long: false },
  { id: 'sunfish', name: 'Sunfish', points: 40, size: 0.9, speed: 0.06, weight: 4, body: '#fdd835', belly: '#bbdefb', fin: '#64b5f6', pattern: 'streaks', long: false },
  { id: 'puffer', name: 'Puffer', points: 60, size: 1.0, speed: 0.045, weight: 3, body: '#ef6c00', belly: '#ffb74d', fin: '#e65100', pattern: 'spots', long: false },
  { id: 'gar', name: 'Tiger gar', points: 100, size: 1.5, speed: 0.13, weight: 2, body: '#8bc34a', belly: '#fbc02d', fin: '#78909c', pattern: 'stripes', long: true },
  { id: 'king', name: 'King fish', points: 200, size: 2.1, speed: 0.035, weight: 1, body: '#5c6bc0', belly: '#90caf9', fin: '#283593', pattern: 'scales', long: true },
];

type FishState = 'swim' | 'approach' | 'nibble' | 'bite' | 'flee' | 'caught';

interface Fish {
  kind: FishKind;
  x: number;
  y: number;
  angle: number;
  state: FishState;
  t: number;
  rod: Rod | null;
  nibbles: number;
  wiggle: number;
}

interface Rod {
  id: string;
  name: string;
  color: string;
  index: number;
  bobber: { x: number; y: number };
  still: number;
  score: number;
  count: number;
  hooked: Fish | null;
  shake: number;
  sink: number;
  msg: string;
  msgT: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  big: boolean;
}

export const POND = { cx: 0.5, cy: 0.58, rx: 0.4, ry: 0.31 };
const inPond = (x: number, y: number) => ((x - POND.cx) / POND.rx) ** 2 + ((y - POND.cy) / POND.ry) ** 2 <= 1;
const BITE_WINDOW = 1.0;

/**
 * Wii Play style pond: point to place your float and hold it still. A fish comes, nibbles (small
 * tugs), then bites (the float sinks): pull up right then to land it. Everyone fishes at once.
 */
class FishingGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'play' | 'over' = 'ready';
  countdown = 3;
  time = 60;
  rods: Rod[] = [];
  fishes: Fish[] = [];
  ripples: Ripple[] = [];
  bonus: FishKind = KINDS[2];
  private bonusT = 0;
  private lastTick = -1;

  start(players: { id: string; name: string; color: string }[]): void {
    this.phase = 'ready';
    this.countdown = 3;
    this.time = 60;
    this.rods = players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, index: i, bobber: { x: 0.35 + i * 0.1, y: 0.6 }, still: 0, score: 0, count: 0, hooked: null, shake: 0, sink: 0, msg: '', msgT: 0 }));
    this.fishes = [];
    this.ripples = [];
    for (let i = 0; i < 9; i++) this.spawn();
    this.pickBonus();
    this.hudDirty = true;
  }

  addRod(p: { id: string; name: string; color: string }): Rod {
    const existing = this.rods.find((r) => r.id === p.id);
    if (existing) return existing;
    const rod: Rod = { id: p.id, name: p.name, color: p.color, index: this.rods.length, bobber: { x: 0.5, y: 0.6 }, still: 0, score: 0, count: 0, hooked: null, shake: 0, sink: 0, msg: '', msgT: 0 };
    this.rods.push(rod);
    this.hudDirty = true;
    return rod;
  }

  private pickBonus(): void {
    const others = KINDS.filter((k) => k !== this.bonus);
    this.bonus = others[Math.floor(Math.random() * others.length)];
    this.bonusT = 15;
    this.hudDirty = true;
  }

  private spawn(): void {
    const total = KINDS.reduce((a, k) => a + k.weight, 0);
    let r = Math.random() * total;
    let kind = KINDS[0];
    for (const k of KINDS) {
      r -= k.weight;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    let x = 0, y = 0;
    do {
      x = rand(POND.cx - POND.rx * 0.85, POND.cx + POND.rx * 0.85);
      y = rand(POND.cy - POND.ry * 0.85, POND.cy + POND.ry * 0.85);
    } while (!inPond(x, y));
    this.fishes.push({ kind, x, y, angle: rand(0, Math.PI * 2), state: 'swim', t: 0, rod: null, nibbles: 0, wiggle: rand(0, 6) });
  }

  /** Move a rod's float; a moving float scares fish that were interested in it. */
  setBobber(rodId: string, nx: number, ny: number): void {
    const rod = this.rods.find((r) => r.id === rodId);
    if (!rod || rod.hooked) return;
    let x = nx, y = ny;
    if (!inPond(x, y)) {
      const dx = (x - POND.cx) / POND.rx, dy = (y - POND.cy) / POND.ry;
      const d = Math.hypot(dx, dy) || 1;
      x = POND.cx + (dx / d) * POND.rx * 0.98;
      y = POND.cy + (dy / d) * POND.ry * 0.98;
    }
    if (Math.hypot(x - rod.bobber.x, y - rod.bobber.y) > 0.004) {
      rod.still = 0;
      for (const f of this.fishes) if (f.rod === rod && (f.state === 'approach' || f.state === 'nibble')) this.scare(f);
    }
    rod.bobber = { x, y };
  }

  private scare(f: Fish): void {
    f.state = 'flee';
    f.t = 0;
    f.rod = null;
  }

  /** Pull the rod up: lands a biting fish, scares anything else that was interested. */
  yank(rodId: string): void {
    if (this.phase !== 'play') return;
    const rod = this.rods.find((r) => r.id === rodId);
    if (!rod) return;
    const f = rod.hooked;
    if (f && f.state === 'bite') {
      const bonus = f.kind === this.bonus;
      const pts = f.kind.points * (bonus ? 2 : 1);
      rod.score += pts;
      rod.count += 1;
      rod.hooked = null;
      rod.sink = 0;
      f.state = 'caught';
      f.t = 0;
      f.rod = rod;
      rod.msg = `${f.kind.name} +${pts}${bonus ? ' BONUS' : ''}`;
      rod.msgT = 1.6;
      this.ripples.push({ x: rod.bobber.x, y: rod.bobber.y, t: 0, big: true });
      this.events.push(bonus ? 'bonus' : 'catch');
      this.hudDirty = true;
      return;
    }
    for (const fish of this.fishes) if (fish.rod === rod && fish.state !== 'caught') this.scare(fish);
    this.ripples.push({ x: rod.bobber.x, y: rod.bobber.y, t: 0, big: false });
    rod.shake = 0.3;
    this.events.push('splash');
  }

  update(dt: number): void {
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < 1);
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
    this.bonusT -= dt;
    if (this.bonusT <= 0) {
      this.pickBonus();
      this.events.push('bonuschange');
    }
    for (const rod of this.rods) {
      rod.still += dt;
      rod.shake = Math.max(0, rod.shake - dt);
      rod.msgT -= dt;
      if (rod.msgT <= 0 && rod.msg) {
        rod.msg = '';
        this.hudDirty = true;
      }
    }
    for (const f of this.fishes) {
      f.t += dt;
      f.wiggle += dt * 6;
      const sp = f.kind.speed;
      switch (f.state) {
        case 'swim': {
          f.angle += rand(-1.2, 1.2) * dt;
          const nx = f.x + Math.cos(f.angle) * sp * dt, ny = f.y + Math.sin(f.angle) * sp * dt;
          if (inPond(nx, ny) && Math.hypot(nx - POND.cx, ny - POND.cy) < 0.36) {
            f.x = nx;
            f.y = ny;
          } else f.angle = Math.atan2(POND.cy - f.y, POND.cx - f.x) + rand(-0.4, 0.4);
          for (const rod of this.rods) {
            const busy = rod.hooked || this.fishes.some((o) => o.rod === rod && o !== f);
            if (busy || rod.still < 0.8) continue;
            if (Math.hypot(f.x - rod.bobber.x, f.y - rod.bobber.y) < 0.16 && Math.random() < dt * 0.7) {
              f.state = 'approach';
              f.rod = rod;
              f.t = 0;
            }
          }
          break;
        }
        case 'approach': {
          const rod = f.rod!;
          const dx = rod.bobber.x - f.x, dy = rod.bobber.y + 0.012 - f.y;
          const d = Math.hypot(dx, dy) || 1;
          f.angle = Math.atan2(dy, dx);
          f.x += (dx / d) * sp * 1.6 * dt;
          f.y += (dy / d) * sp * 1.6 * dt;
          if (d < 0.02) {
            f.state = 'nibble';
            f.t = 0;
            f.nibbles = 0;
          } else if (f.t > 4) this.scare(f);
          break;
        }
        case 'nibble': {
          const rod = f.rod!;
          if (f.t > 0.5) {
            f.t = 0;
            f.nibbles += 1;
            rod.shake = 0.25;
            this.ripples.push({ x: rod.bobber.x, y: rod.bobber.y, t: 0, big: false });
            this.events.push('nibble');
            if (f.nibbles >= 2 + Math.floor(Math.random() * 2)) {
              f.state = 'bite';
              f.t = 0;
              rod.hooked = f;
              rod.sink = 1;
              this.ripples.push({ x: rod.bobber.x, y: rod.bobber.y, t: 0, big: true });
              this.events.push('bite');
            }
          }
          break;
        }
        case 'bite': {
          const rod = f.rod!;
          if (f.t > BITE_WINDOW) {
            rod.hooked = null;
            rod.sink = 0;
            rod.msg = 'It got away!';
            rod.msgT = 1.2;
            this.scare(f);
            this.events.push('escape');
            this.hudDirty = true;
          }
          break;
        }
        case 'flee': {
          const away = Math.atan2(f.y - POND.cy, f.x - POND.cx) + rand(-0.5, 0.5);
          const nx = f.x + Math.cos(away) * sp * 3 * dt, ny = f.y + Math.sin(away) * sp * 3 * dt;
          if (inPond(nx, ny)) {
            f.x = nx;
            f.y = ny;
            f.angle = away;
          }
          if (f.t > 1.2) {
            f.state = 'swim';
            f.t = 0;
          }
          break;
        }
        case 'caught':
          if (f.t > 1) {
            this.fishes.splice(this.fishes.indexOf(f), 1);
            this.spawn();
          }
          break;
      }
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    // meadow, trees, pond
    g.fillStyle = '#8bc34a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#7cb342';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 0.173 + 0.05) % 1) * W, y = ((i * 0.29 + 0.1) % 1) * H;
      if (inPond(x / W, y / H)) continue;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + W * 0.012, y - H * 0.04); g.lineTo(x + W * 0.024, y); g.closePath(); g.fill();
    }
    for (const [tx, ty, s] of [[0.06, 0.2, 1], [0.93, 0.12, 0.8], [0.88, 0.88, 0.9], [0.1, 0.86, 0.7]]) {
      g.fillStyle = '#6d4c41';
      g.fillRect(tx * W - W * 0.006, ty * H, W * 0.012, H * 0.08 * s);
      g.fillStyle = '#43a047';
      g.beginPath(); g.arc(tx * W, ty * H - H * 0.02 * s, W * 0.045 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#66bb6a';
      g.beginPath(); g.arc(tx * W - W * 0.012 * s, ty * H - H * 0.04 * s, W * 0.03 * s, 0, Math.PI * 2); g.fill();
    }
    const px = POND.cx * W, py = POND.cy * H, rx = POND.rx * W, ry = POND.ry * H;
    g.fillStyle = '#dfe9c8';
    g.beginPath(); g.ellipse(px, py, rx * 1.03, ry * 1.04, 0, 0, Math.PI * 2); g.fill();
    const water = g.createRadialGradient(px, py - ry * 0.4, ry * 0.2, px, py, rx);
    water.addColorStop(0, '#bfe6ff');
    water.addColorStop(1, '#5aa9e6');
    g.fillStyle = water;
    g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.clip();
    for (const f of this.fishes) if (f.state !== 'caught') drawFish(g, f.kind, f.x * W, f.y * H, f.angle, W, 0.8, f.wiggle, f === this.bonusFish());
    g.fillStyle = 'rgba(140, 200, 255, 0.28)';
    g.fillRect(0, 0, W, H);
    for (const r of this.ripples) {
      g.strokeStyle = `rgba(255,255,255,${(1 - r.t) * 0.8})`;
      g.lineWidth = Math.max(1, W * 0.002);
      g.beginPath(); g.ellipse(r.x * W, r.y * H, W * (r.big ? 0.06 : 0.03) * r.t, W * (r.big ? 0.06 : 0.03) * r.t * 0.6, 0, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
    // rods, lines and floats
    this.rods.forEach((rod) => {
      const n = this.rods.length;
      const hx = (0.5 + (rod.index - (n - 1) / 2) * 0.3) * W, hy = H * 1.02;
      const bx = rod.bobber.x * W, by = rod.bobber.y * H + rod.sink * H * 0.012 + (rod.shake > 0 ? Math.sin(rod.shake * 60) * H * 0.006 : 0);
      // rod: comes in from the bottom, tip offset to the side of the float, line hangs down to the float
      const side = bx < hx ? 1 : -1;
      const tx = bx + side * W * 0.05, ty = by - H * 0.2;
      g.lineCap = 'round';
      g.strokeStyle = '#6d4c2f';
      g.lineWidth = W * 0.009;
      g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo(hx + (tx - hx) * 0.2, hy - H * 0.5, hx + (tx - hx) * 0.6, ty + (hy - ty) * 0.35); g.stroke();
      g.strokeStyle = rod.color;
      g.lineWidth = W * 0.005;
      g.beginPath(); g.moveTo(hx + (tx - hx) * 0.6, ty + (hy - ty) * 0.35); g.quadraticCurveTo(hx + (tx - hx) * 0.9, ty + (hy - ty) * 0.1, tx, ty); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = Math.max(1, W * 0.0012);
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx, by, bx, by); g.stroke();
      const r = W * 0.011;
      g.fillStyle = '#e53935';
      g.beginPath(); g.arc(bx, by, r, Math.PI, 0); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(bx, by, r, 0, Math.PI); g.fill();
      g.strokeStyle = rod.color;
      g.lineWidth = Math.max(1, W * 0.002);
      g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke();
      if (rod.msg) {
        g.font = `900 ${W * 0.026}px Nunito, sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = W * 0.004;
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.fillStyle = '#fff';
        g.strokeText(rod.msg, bx, by - H * 0.08);
        g.fillText(rod.msg, bx, by - H * 0.08);
      }
    });
    // landed fish fly up out of the water
    for (const f of this.fishes) {
      if (f.state !== 'caught' || !f.rod) continue;
      const k = f.t;
      const x = f.rod.bobber.x * W, y = f.rod.bobber.y * H - Math.sin(Math.min(1, k) * Math.PI) * H * 0.3;
      drawFish(g, f.kind, x, y, -Math.PI / 2 + Math.sin(k * 20) * 0.3, W, 1.3, f.wiggle, false, 1 - Math.max(0, k - 0.6) * 2.5);
    }
  }

  bonusFish(): Fish | null {
    return this.fishes.find((f) => f.kind === this.bonus) ?? null;
  }
}

/** Cartoon fish after the sticker sheet: outlined body, tail, fins, eye and a species pattern. */
export function drawFish(g: CanvasRenderingContext2D, k: FishKind, x: number, y: number, angle: number, W: number, alpha: number, wiggle = 0, glow = false, fade = 1): void {
  const s = W * 0.028 * k.size;
  const w = k.long ? s * 1.9 : s * 1.15, h = k.long ? s * 0.62 : s * 0.85;
  g.save();
  g.globalAlpha = alpha * Math.max(0, fade);
  g.translate(x, y);
  g.rotate(angle);
  if (Math.cos(angle) < 0) g.scale(1, -1);
  g.lineWidth = Math.max(1, s * 0.09);
  g.strokeStyle = '#3e2723';
  g.lineJoin = 'round';
  if (glow) {
    g.shadowColor = '#fff176';
    g.shadowBlur = s * 0.8;
  }
  const flap = Math.sin(wiggle) * 0.35;
  g.fillStyle = k.fin;
  g.beginPath(); g.moveTo(-w * 0.75, 0); g.lineTo(-w * 1.25, -h * 0.75 + flap * h); g.lineTo(-w * 1.25, h * 0.75 + flap * h); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-w * 0.2, -h * 0.85); g.lineTo(w * 0.15, -h * 0.85); g.lineTo(w * 0.05, -h * 1.3); g.lineTo(-w * 0.3, -h * 1.15); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = k.body;
  g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = k.belly;
  g.beginPath(); g.ellipse(w * 0.15, h * 0.55, w * 0.8, h * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = Math.max(1, s * 0.06);
  if (k.pattern === 'spots') for (const [sx, sy] of [[-0.3, -0.3], [0.1, -0.45], [-0.55, 0.15]]) { g.beginPath(); g.arc(sx * w, sy * h, h * 0.18, 0, Math.PI * 2); g.fill(); }
  if (k.pattern === 'stripes') for (let i = -3; i <= 2; i++) { g.beginPath(); g.moveTo(i * w * 0.22, -h); g.lineTo(i * w * 0.22 + w * 0.08, h * 0.2); g.stroke(); }
  if (k.pattern === 'streaks') for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-w * 0.6, -h * 0.5 + i * h * 0.35); g.lineTo(w * 0.1, -h * 0.65 + i * h * 0.35); g.stroke(); }
  if (k.pattern === 'scales') for (let r = 0; r < 3; r++) for (let c = -3; c <= 2; c++) { g.beginPath(); g.arc(c * w * 0.3 + (r % 2) * w * 0.15, -h * 0.55 + r * h * 0.45, h * 0.28, 0, Math.PI); g.stroke(); }
  g.restore();
  g.strokeStyle = '#3e2723';
  g.lineWidth = Math.max(1, s * 0.09);
  g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = k.fin;
  g.beginPath(); g.moveTo(w * 0.05, h * 0.25); g.lineTo(-w * 0.35, h * 0.55 + flap * h * 0.3); g.lineTo(-w * 0.1, h * 0.85); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(w * 0.55, -h * 0.25, h * 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111';
  g.beginPath(); g.arc(w * 0.6, -h * 0.25, h * 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(w * 0.85, h * 0.2); g.lineTo(w * 1.0, h * 0.28); g.stroke();
  g.restore();
}

function angler(remote: Wiimote) {
  return { id: remote.id, name: remote.kind === 'phone' ? remote.name : `Player ${remote.player}`, color: PLAYER_COLORS[(remote.player - 1) % 4] ?? '#3b82f6' };
}

/** Small drawing of the bonus species for the HUD, as a data URL rendered once per bonus change. */
function bonusIcon(kind: FishKind): string {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 80;
  const g = c.getContext('2d');
  if (!g) return '';
  drawFish(g, kind, 80, 40, 0, 900 / kind.size, 1, 0, false);
  return c.toDataURL();
}

export function Fishing({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new FishingGame();
    g.start(ctx.players.map(angler));
    return g;
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    game.addRod(angler(remote));
    game.setBobber(remote.id, pointer.x, pointer.y);
  });
  useInputEvent('swing', ({ remote }) => game.yank(remote.id));
  useButton('a', (remote) => {
    if (game.phase === 'over') game.start(ctx.players.map(angler));
    else game.yank(remote.id);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { catch: 'success', bonus: 'strike', splash: 'whoosh', nibble: 'tick', bite: 'pop', escape: 'deny', bonuschange: 'select', go: 'go', over: 'timeup', tick: 'countdown' };
  const ranking = [...game.rods].sort((a, b) => b.score - a.score);
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Point to place your float and keep it still · the fish nibbles, then bites and the float sinks: pull up right away (swing or A) · bonus species counts double"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{Math.max(0, Math.ceil(game.time))}</div>
              <div className="mg-label">seconds</div>
            </div>
            <div className="fish-bonus">
              <img src={bonusIcon(game.bonus)} alt="" draggable={false} />
              <div>
                <b>Bonus ×2</b>
                <small>{game.bonus.name}</small>
              </div>
            </div>
            <div className="mg-scores">
              {game.rods.map((r) => (
                <div key={r.id} className="mg-score" style={{ borderColor: r.color }}>
                  {r.score}
                  <small>
                    {r.name} · {r.count} fish
                  </small>
                </div>
              ))}
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small="Hold the float still…" big={String(Math.ceil(game.countdown))} keyId={Math.ceil(game.countdown)} />}
          {game.phase === 'over' && (
            <Results
              title="Time's up!"
              rating={ranking[0].score >= 600 ? 'Master angler!' : ranking[0].score >= 300 ? 'Nice catch' : 'Keep fishing'}
              rows={ranking.map((r) => ({ label: r.name, value: `${r.score} (${r.count} fish)`, color: r.color }))}
              onAgain={() => game.start(ctx.players.map(angler))}
            />
          )}
        </>
      )}
    />
  );
}
