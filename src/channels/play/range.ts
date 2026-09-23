export type TargetKind = 'balloon' | 'clay' | 'can' | 'duck' | 'ufo';

/** Game space: x in 0..1, y in 0..H (H = 9/16) so that distances are isotropic. */
export const H = 9 / 16;

export interface Target {
  id: number;
  kind: TargetKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** base height for ducks, target point for the UFO */
  by: number;
  bx: number;
  r: number;
  hp: number;
  maxHp: number;
  color: string;
  t: number;
  dead: boolean;
  deadT: number;
  points: number;
  phase: number;
  dir: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

export interface Shooter {
  id: string;
  name: string;
  color: string;
  score: number;
  combo: number;
  bestCombo: number;
  hits: number;
  shots: number;
  lastShot: number;
  flashX: number;
  flashY: number;
  flashT: number;
}

export interface Stage {
  kind: TargetKind;
  title: string;
  seconds: number;
}

/** The five rounds, in the spirit of the original shooting gallery. */
export const STAGES: Stage[] = [
  { kind: 'balloon', title: 'Balloons', seconds: 12 },
  { kind: 'clay', title: 'Targets', seconds: 12 },
  { kind: 'can', title: 'Cans', seconds: 12 },
  { kind: 'duck', title: 'Ducks', seconds: 12 },
  { kind: 'ufo', title: 'UFO', seconds: 14 },
];

export type RangePhase = 'ready' | 'stage' | 'play' | 'over';
export type RangeEvent = 'pop' | 'hit' | 'miss' | 'shot' | 'start' | 'over' | 'tick' | 'stage' | 'ufo' | 'ufohit' | 'quack' | 'clay' | 'ping' | 'bonus';
export type ShotResult = 'hit' | 'miss' | 'reload' | 'ignored';

const BALLOON_COLORS = ['#ff5252', '#ffd740', '#40c4ff', '#69f0ae', '#ea80fc', '#ff9100'];
const POINTS: Record<TargetKind, number> = { balloon: 10, clay: 20, can: 30, duck: 25, ufo: 100 };
export const SHELF_Y = 0.4;
const STAGE_CARD_SECONDS = 1.4;

/** Timed target shooting in five rounds. Rendering lives in rangeRender.ts. */
export class RangeGame {
  phase: RangePhase = 'ready';
  stageIndex = 0;
  /** Seconds left in the current round. */
  remaining = STAGES[0].seconds;
  countdown = 3;
  targets: Target[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  shooters: Shooter[] = [];
  events: RangeEvent[] = [];
  hudDirty = true;
  private time = 0;
  private stageTimer = 0;
  private seq = 0;
  private spawnTimer = 0;
  private lastTick = -1;

  constructor(players: { id: string; name: string; color: string }[]) {
    for (const p of players) this.addShooter(p);
  }

  get stage(): Stage {
    return STAGES[this.stageIndex];
  }

  get ufoAlive(): boolean {
    return this.targets.some((t) => t.kind === 'ufo' && !t.dead);
  }

  addShooter(p: { id: string; name: string; color: string }): Shooter {
    const existing = this.shooters.find((s) => s.id === p.id);
    if (existing) return existing;
    const s: Shooter = { ...p, score: 0, combo: 0, bestCombo: 0, hits: 0, shots: 0, lastShot: -1, flashX: 0, flashY: 0, flashT: 0 };
    this.shooters.push(s);
    this.hudDirty = true;
    return s;
  }

  start(): void {
    this.phase = 'ready';
    this.stageIndex = 0;
    this.remaining = STAGES[0].seconds;
    this.countdown = 3;
    this.time = 0;
    this.stageTimer = 0;
    this.lastTick = -1;
    this.spawnTimer = 0;
    this.targets = [];
    this.particles = [];
    this.popups = [];
    for (const s of this.shooters) Object.assign(s, { score: 0, combo: 0, bestCombo: 0, hits: 0, shots: 0, lastShot: -1, flashT: 0 });
    this.hudDirty = true;
  }

  /** Total score across shooters, used for the final rating. */
  get totalScore(): number {
    return this.shooters.reduce((a, s) => a + s.score, 0);
  }

  rating(): string {
    const best = Math.max(0, ...this.shooters.map((s) => s.score));
    if (best >= 1400) return 'Perfect!';
    if (best >= 1000) return 'Excellent!';
    if (best >= 650) return 'Great!';
    if (best >= 350) return 'Good';
    return 'Nice try';
  }

  update(dt: number): void {
    for (const s of this.shooters) s.flashT = Math.max(0, s.flashT - dt);
    this.updateEffects(dt);
    if (this.phase === 'ready') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.enterStage(0);
      this.hudDirty = true;
      return;
    }
    if (this.phase === 'stage') {
      this.stageTimer += dt;
      if (this.stageTimer >= STAGE_CARD_SECONDS) {
        this.phase = 'play';
        this.spawnTimer = 0;
        this.events.push('start');
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase !== 'play') return;
    this.time += dt;
    this.remaining -= dt;
    const rem = Math.ceil(this.remaining);
    if (rem !== this.lastTick) {
      this.lastTick = rem;
      this.hudDirty = true;
      if (rem <= 3 && rem > 0) this.events.push('tick');
    }
    if (this.remaining <= 0) {
      for (const t of this.targets) {
        if (!t.dead) {
          t.dead = true;
          t.deadT = 10;
        }
      }
      if (this.stageIndex >= STAGES.length - 1) {
        this.phase = 'over';
        this.events.push('over');
        this.hudDirty = true;
        return;
      }
      this.enterStage(this.stageIndex + 1);
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer = this.spawnInterval();
    }
    for (const t of this.targets) {
      if (t.dead) {
        t.deadT += dt;
        continue;
      }
      t.t += dt;
      switch (t.kind) {
        case 'balloon':
          t.y += t.vy * dt;
          t.x += Math.sin(t.t * 2 + t.phase) * 0.05 * dt;
          break;
        case 'clay':
          t.vy += 0.75 * dt;
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          break;
        case 'duck':
          t.x += t.vx * dt;
          t.y = t.by + Math.sin(t.t * 3 + t.phase) * 0.02;
          break;
        case 'can':
          if (t.t > 7) {
            t.dead = true;
            t.deadT = 10;
          }
          break;
        case 'ufo': {
          // darts between random points, wobbling
          if (t.t > t.phase) {
            t.phase = t.t + 0.6 + Math.random() * 0.7;
            t.bx = 0.12 + Math.random() * 0.76;
            t.by = 0.05 + Math.random() * 0.26;
          }
          const dx = t.bx - t.x;
          const dy = t.by - t.y;
          const d = Math.hypot(dx, dy) || 1;
          const speed = 0.42;
          t.x += (dx / d) * Math.min(speed * dt, d);
          t.y += (dy / d) * Math.min(speed * dt, d) + Math.sin(t.t * 9) * 0.004;
          t.dir = dx >= 0 ? 1 : -1;
          break;
        }
      }
    }
    this.targets = this.targets.filter((t) => !(t.dead && t.deadT > 0.5) && t.x > -0.15 && t.x < 1.15 && t.y > -0.15 && t.y < H + 0.15);
  }

  private enterStage(index: number): void {
    this.stageIndex = index;
    this.remaining = STAGES[index].seconds;
    this.stageTimer = 0;
    this.lastTick = -1;
    this.phase = 'stage';
    this.targets = [];
    this.events.push('stage');
    this.hudDirty = true;
  }

  private spawnInterval(): number {
    const p = 1 - this.remaining / this.stage.seconds;
    switch (this.stage.kind) {
      case 'balloon':
        return 0.75 - p * 0.3;
      case 'clay':
        return 1.1 - p * 0.35;
      case 'can':
        return 1.4;
      case 'duck':
        return 1.0 - p * 0.35;
      case 'ufo':
        return 0.5;
    }
  }

  private spawn(): void {
    const kind = this.stage.kind;
    const p = 1 - this.remaining / this.stage.seconds;
    const speed = 1 + p * 0.7;
    if (kind === 'ufo' && this.ufoAlive) return;
    if (kind === 'can' && this.targets.filter((t) => t.kind === 'can' && !t.dead).length >= 4) return;
    const base: Target = {
      id: ++this.seq,
      kind,
      x: 0.1 + Math.random() * 0.8,
      y: H + 0.08,
      vx: 0,
      vy: 0,
      by: 0,
      bx: 0,
      r: 0.03,
      hp: 1,
      maxHp: 1,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      t: 0,
      dead: false,
      deadT: 0,
      points: POINTS[kind],
      phase: Math.random() * Math.PI * 2,
      dir: 1,
    };
    switch (kind) {
      case 'balloon':
        base.vy = -(0.07 + Math.random() * 0.06) * speed;
        base.r = 0.028 + Math.random() * 0.01;
        break;
      case 'clay': {
        const fromLeft = Math.random() < 0.5;
        base.x = fromLeft ? -0.05 : 1.05;
        base.vx = (fromLeft ? 1 : -1) * (0.28 + Math.random() * 0.15) * speed;
        base.vy = -(0.62 + Math.random() * 0.15);
        base.r = 0.024;
        base.color = '#ff7043';
        break;
      }
      case 'can':
        base.x = 0.15 + Math.random() * 0.7;
        base.y = SHELF_Y - 0.03;
        base.r = 0.026;
        base.hp = 2;
        base.maxHp = 2;
        base.color = '#b0bec5';
        break;
      case 'duck': {
        const fromLeft = Math.random() < 0.5;
        base.x = fromLeft ? -0.06 : 1.06;
        base.dir = fromLeft ? 1 : -1;
        base.vx = base.dir * (0.18 + Math.random() * 0.14) * speed;
        base.by = 0.08 + Math.random() * 0.18;
        base.y = base.by;
        base.r = 0.03;
        base.color = '#8d6e63';
        break;
      }
      case 'ufo':
        base.x = Math.random() < 0.5 ? -0.08 : 1.08;
        base.y = 0.12;
        base.bx = 0.5;
        base.by = 0.15;
        base.r = 0.045;
        base.hp = 3;
        base.maxHp = 3;
        base.phase = 0;
        base.color = '#b0bec5';
        this.events.push('ufo');
        break;
    }
    this.targets.push(base);
  }

  /** nx / ny are the pointer coordinates in 0..1 of the screen. */
  shoot(shooterId: string, nx: number, ny: number): ShotResult {
    if (this.phase !== 'play') return 'ignored';
    const s = this.shooters.find((sh) => sh.id === shooterId);
    if (!s) return 'ignored';
    if (this.time - s.lastShot < 0.2) return 'reload';
    s.lastShot = this.time;
    s.shots += 1;
    const x = nx;
    const y = ny * H;
    s.flashX = x;
    s.flashY = y;
    s.flashT = 0.12;
    this.events.push('shot');
    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < t.r * 1.2 && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (!best) {
      s.combo = 0;
      this.events.push('miss');
      this.hudDirty = true;
      return 'miss';
    }
    best.hp -= 1;
    if (best.hp > 0) {
      this.burst(best.x, best.y, best.color, 5);
      if (best.kind === 'ufo') {
        s.score += 15;
        this.popup(best.x, best.y, '+15', s.color);
        this.events.push('ufohit');
      } else this.events.push('hit');
      this.hudDirty = true;
      return 'hit';
    }
    best.dead = true;
    best.deadT = 0;
    s.hits += 1;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    const bonus = Math.min(50, (s.combo - 1) * 5);
    s.score += best.points + bonus;
    this.popup(best.x, best.y, `+${best.points + bonus}${s.combo > 1 ? ` ×${s.combo}` : ''}`, s.color);
    this.burst(best.x, best.y, best.color, best.kind === 'ufo' ? 24 : 14);
    this.events.push('pop');
    if (best.kind === 'ufo' || s.combo === 5 || s.combo === 10) this.events.push('bonus');
    if (best.kind === 'clay' || best.kind === 'ufo') this.events.push('clay');
    else if (best.kind === 'can') this.events.push('ping');
    else if (best.kind === 'duck') this.events.push('quack');
    this.hudDirty = true;
    return 'hit';
  }

  private popup(x: number, y: number, text: string, color: string): void {
    this.popups.push({ x, y: y - 0.02, text, color, t: 0 });
  }

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.7) * 0.6,
        life: 0.45 + Math.random() * 0.35,
        color,
        size: 0.004 + Math.random() * 0.006,
      });
    }
  }

  private updateEffects(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.7 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 0.9);
  }
}
