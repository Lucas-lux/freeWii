import { useState } from 'react';
import { PLAYER_COLORS, useInputEvent, type ChannelContext, type Wiimote } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

const POINTS = ['0', '15', '30', '40', 'Ad'];
type Team = 'near' | 'far';
type Shot = 'Forehand' | 'Backhand' | 'Smash!' | 'Lob';

interface Racket {
  x: number;
  swingT: number;
  color: string;
  human: string | null;
}

/**
 * Near team = players 1 & 3, far team = players 2 & 4 (CPU when nobody holds a second remote).
 * Your Mii runs to the ball on its own; you time the swing. Sideways swings pick forehand/backhand,
 * a hard swing on a high ball is a smash, a soft swing is a lob.
 */
class TennisGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'serve' | 'rally' | 'point' | 'over' = 'ready';
  countdown = 2;
  teams: Record<Team, Racket[]> = { near: [], far: [] };
  cpuFar = true;
  ball = { x: 0, z: 0.05, y: 0.06, vx: 0, vz: 0, vy: 0, last: 'near' as Team, bounced: 0 };
  server: Team = 'near';
  pts: Record<Team, number> = { near: 0, far: 0 };
  games: Record<Team, number> = { near: 0, far: 0 };
  message = '';
  shot = '';
  private shotT = 0;
  private timer = 0;
  private cpuT = 0;

  start(near: string[], far: string[]): void {
    this.cpuFar = far.length === 0;
    this.teams = {
      near: near.map((id, i) => ({ x: near.length > 1 ? (i === 0 ? -0.5 : 0.5) : 0, swingT: 0, color: PLAYER_COLORS[i * 2 % 4], human: id })),
      far: (far.length ? far : ['cpu']).map((id, i) => ({ x: far.length > 1 ? (i === 0 ? -0.5 : 0.5) : 0, swingT: 0, color: id === 'cpu' ? '#e53935' : PLAYER_COLORS[(i * 2 + 1) % 4], human: id === 'cpu' ? null : id })),
    };
    this.phase = 'ready';
    this.countdown = 2;
    this.pts = { near: 0, far: 0 };
    this.games = { near: 0, far: 0 };
    this.server = 'near';
    this.message = '';
    this.placeServe();
    this.hudDirty = true;
  }

  private placeServe(): void {
    const z = this.server === 'near' ? 0.05 : 0.95;
    const r = this.teams[this.server][0];
    this.ball = { x: r.x, z, y: 0.06, vx: 0, vz: 0, vy: 0, last: this.server, bounced: 0 };
    this.cpuT = 1.1;
  }

  private nearest(team: Team): Racket {
    const rs = this.teams[team];
    return rs.reduce((a, b) => (Math.abs(a.x - this.ball.x) <= Math.abs(b.x - this.ball.x) ? a : b));
  }

  /** A human of `team` swung: serve, or return if the ball is within reach. */
  swing(team: Team, strength: number, lateral: number): void {
    const b = this.ball;
    const r = this.nearest(team);
    r.swingT = 0.3;
    if (this.phase === 'serve') {
      if (team !== this.server) return;
      this.hit(team, 0.95 + strength * 0.5, rand(-0.45, 0.45), 'Forehand', 0.5);
      return;
    }
    if (this.phase !== 'rally') return;
    const towards = team === 'near' ? b.vz < 0 : b.vz > 0;
    const zr = team === 'near' ? b.z : 1 - b.z;
    if (!towards || zr > 0.26 || zr < -0.04) {
      this.events.push('whiff');
      return;
    }
    if (Math.abs(r.x - b.x) > 0.42) {
      this.events.push('whiff');
      return;
    }
    const timing = (zr - 0.11) / 0.15; // early (+) pulls across, late (-) goes down the line
    const angle = Math.max(-1, Math.min(1, -timing * 1.1 + lateral * 0.45));
    let kind: Shot = lateral < -0.25 ? 'Backhand' : 'Forehand';
    let speed = 0.9 + strength * 0.8;
    let lift = 0.5;
    if (b.y > 0.22 && strength > 0.55) {
      kind = 'Smash!';
      speed = 2.1;
      lift = 0.18;
    } else if (strength < 0.32) {
      kind = 'Lob';
      speed = 0.75;
      lift = 1.05;
    }
    this.hit(team, speed, angle, kind, lift);
  }

  private hit(team: Team, speed: number, angle: number, kind: Shot, lift: number): void {
    const b = this.ball;
    const dir = team === 'near' ? 1 : -1;
    b.vz = dir * speed;
    b.vx = angle * 0.6 * (kind === 'Smash!' ? 0.8 : 1);
    b.vy = lift;
    b.y = Math.max(b.y, 0.03);
    b.last = team;
    b.bounced = 0;
    if (this.phase === 'serve') this.phase = 'rally';
    this.shot = kind;
    this.shotT = 0.9;
    this.events.push(kind === 'Smash!' ? 'smash' : 'hit');
    this.hudDirty = true;
  }

  private point(winner: Team, why: string): void {
    this.phase = 'point';
    this.timer = 1.6;
    this.message = why;
    this.pts[winner] += 1;
    const loser: Team = winner === 'near' ? 'far' : 'near';
    const w = this.pts[winner], l = this.pts[loser];
    const label = winner === 'near' ? 'Near side' : this.cpuFar ? 'CPU' : 'Far side';
    if (w >= 4 && w - l >= 2) {
      this.games[winner] += 1;
      this.pts = { near: 0, far: 0 };
      this.server = this.server === 'near' ? 'far' : 'near';
      this.message = `${why} · Game ${label}`;
      this.events.push(winner === 'near' ? 'game' : 'lost');
      if (this.games[winner] >= 2) {
        this.phase = 'over';
        this.events.push('over');
      }
    } else if (w === 4 && l === 4) {
      this.pts = { near: 3, far: 3 };
    } else this.events.push(winner === 'near' ? 'won' : 'lost');
    this.hudDirty = true;
  }

  private cpuSwing(): void {
    const b = this.ball;
    const r = this.nearest('far');
    r.swingT = 0.3;
    const incomingSmash = Math.abs(b.vz) > 1.8;
    const ok = incomingSmash ? 0.4 : b.y > 0.2 ? 0.9 : 0.82;
    if (Math.abs(r.x - b.x) > 0.34 || Math.random() > ok) return;
    if (b.y > 0.24 && Math.random() < 0.7) this.hit('far', 2.0, rand(-0.8, 0.8), 'Smash!', 0.18);
    else if (Math.random() < 0.15) this.hit('far', 0.75, rand(-0.6, 0.6), 'Lob', 1.05);
    else this.hit('far', 0.9 + rand(0, 0.5), rand(-0.9, 0.9), Math.random() < 0.5 ? 'Forehand' : 'Backhand', 0.5);
    this.events.push('opp');
  }

  update(dt: number): void {
    for (const t of ['near', 'far'] as Team[]) for (const r of this.teams[t]) r.swingT = Math.max(0, r.swingT - dt);
    this.shotT = Math.max(0, this.shotT - dt);
    if (this.shotT === 0 && this.shot) {
      this.shot = '';
      this.hudDirty = true;
    }
    if (this.phase === 'ready') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'serve';
        this.placeServe();
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase === 'point') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = 'serve';
        this.message = '';
        this.placeServe();
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase === 'serve') {
      if (this.server === 'far' && this.cpuFar) {
        this.cpuT -= dt;
        if (this.cpuT <= 0) this.hit('far', 1.05, rand(-0.45, 0.45), 'Forehand', 0.5);
      }
      return;
    }
    if (this.phase !== 'rally') return;
    const b = this.ball;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y += b.vy * dt;
    b.vy -= 2.2 * dt;
    if (b.y < 0) {
      b.y = 0;
      b.vy = Math.abs(b.vy) * 0.55;
      b.bounced += 1;
      this.events.push('bounce');
      if (Math.abs(b.x) > 1.08 || b.z < -0.05 || b.z > 1.05) return this.point(b.last === 'near' ? 'far' : 'near', 'Out!');
    }
    // the net
    if ((b.z - b.vz * dt < 0.5) !== (b.z < 0.5) && b.y < 0.045) return this.point(b.last === 'near' ? 'far' : 'near', 'Net!');
    // Miis shuffle towards the ball on their side
    for (const t of ['near', 'far'] as Team[]) {
      const coming = t === 'near' ? b.vz < 0 : b.vz > 0;
      const rs = this.teams[t];
      const r = this.nearest(t);
      const rate = t === 'far' && this.cpuFar ? (coming ? 3.2 : 1.4) : coming ? 4 : 1.5;
      const target = rs.length > 1 ? Math.max(-0.9, Math.min(0.9, b.x)) : b.x;
      r.x += (target - r.x) * Math.min(1, dt * rate);
    }
    if (b.vz > 0 && b.z >= 0.95 && this.cpuFar) {
      if (b.z < 1.0) this.cpuSwing();
    }
    if (b.vz < 0 && b.z <= -0.12) return this.point('far', 'Missed!');
    if (b.vz > 0 && b.z >= 1.12) return this.point('near', this.cpuFar ? 'Winner!' : 'Missed!');
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.35);
    sky.addColorStop(0, '#6cc1ff');
    sky.addColorStop(1, '#cfeaff');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#2f7d32';
    g.fillRect(0, H * 0.3, W, H);
    const proj = (x: number, z: number) => {
      const s = 1 / (1 + Math.max(0, z + 0.25) * 1.9);
      return { x: W / 2 + x * W * 0.62 * s, y: H * 0.32 + H * 0.95 * s * 0.75, s };
    };
    const court = (x0: number, z0: number, x1: number, z1: number, fill: string) => {
      const a = proj(x0, z0), b = proj(x0, z1), c = proj(x1, z1), d = proj(x1, z0);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
      g.fillStyle = fill; g.fill();
    };
    court(-1.35, -0.15, 1.35, 1.15, '#3b8f3e');
    court(-1, 0, 1, 1, '#4c9d4f');
    g.strokeStyle = '#f5f5f5';
    g.lineWidth = Math.max(2, W * 0.003);
    for (const [x0, z0, x1, z1] of [[-1, 0, 1, 0], [-1, 1, 1, 1], [-1, 0, -1, 1], [1, 0, 1, 1], [-1, 0.5, 1, 0.5], [0, 0.22, 0, 0.78], [-1, 0.22, 1, 0.22], [-1, 0.78, 1, 0.78]]) {
      const a = proj(x0, z0), b = proj(x1, z1);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    const nl = proj(-1.05, 0.5), nr = proj(1.05, 0.5);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(nl.x, nl.y - H * 0.06, nr.x - nl.x, H * 0.06);
    const figure = (x: number, z: number, color: string, swing: number, facing: number) => {
      const p = proj(x, z);
      const h = H * 0.3 * p.s;
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(p.x, p.y, h * 0.35, h * 0.08, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#37474f';
      g.fillRect(p.x - h * 0.16, p.y - h * 0.42, h * 0.32, h * 0.42);
      g.fillStyle = color;
      g.beginPath(); g.roundRect(p.x - h * 0.2, p.y - h * 0.8, h * 0.4, h * 0.42, h * 0.1); g.fill();
      g.fillStyle = '#f1c27d';
      g.beginPath(); g.arc(p.x, p.y - h * 0.92, h * 0.13, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f1c27d';
      g.lineWidth = h * 0.09;
      g.lineCap = 'round';
      const a = swing > 0 ? -1.4 + (0.3 - swing) * 6 : 0.4;
      g.beginPath(); g.moveTo(p.x + h * 0.2 * facing, p.y - h * 0.7); g.lineTo(p.x + h * 0.2 * facing + Math.cos(a) * h * 0.4 * facing, p.y - h * 0.7 + Math.sin(a) * h * 0.4); g.stroke();
      g.strokeStyle = '#d32f2f';
      g.lineWidth = h * 0.05;
      g.beginPath(); g.ellipse(p.x + h * 0.2 * facing + Math.cos(a) * h * 0.55 * facing, p.y - h * 0.7 + Math.sin(a) * h * 0.55, h * 0.14, h * 0.1, a, 0, Math.PI * 2); g.stroke();
    };
    const b = this.ball;
    for (const r of this.teams.far) figure(r.x, 1.05, r.color, r.swingT, -1);
    const bp = proj(b.x, b.z);
    const rad = W * 0.012 * bp.s;
    const ball = () => {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(bp.x, bp.y, rad, rad * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d4e157';
      g.beginPath(); g.arc(bp.x, bp.y - b.y * H * 0.6 * bp.s, rad, 0, Math.PI * 2); g.fill();
    };
    if (b.z > 0.5) ball();
    for (const r of this.teams.near) figure(r.x, -0.05, r.color, r.swingT, 1);
    if (b.z <= 0.5) ball();
  }
}

export function Tennis({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const teamOf = (remote: Wiimote): Team => {
    const idx = ctx.players.findIndex((p) => p.id === remote.id);
    return idx >= 0 && idx % 2 === 1 ? 'far' : 'near';
  };
  const lineup = () => ({
    near: ctx.players.filter((_, i) => i % 2 === 0).map((p) => p.id),
    far: ctx.players.filter((_, i) => i % 2 === 1).map((p) => p.id),
  });
  const [game] = useState(() => {
    const g = new TennisGame();
    const l = lineup();
    g.start(l.near.length ? l.near : ['local'], l.far);
    return g;
  });
  useInputEvent('swing', ({ remote, swing }) => game.swing(teamOf(remote), swing.strength, swing.direction.x));
  useInputEvent('buttondown', ({ remote, button }) => {
    if (button === 'a') {
      if (game.phase === 'over') {
        const l = lineup();
        game.start(l.near.length ? l.near : ['local'], l.far);
      } else game.swing(teamOf(remote), 0.65, 0);
    } else if (button === 'one') game.swing(teamOf(remote), 0.2, 0);
    else if (button === 'two') game.swing(teamOf(remote), 0.95, 0);
    else if (button === 'left') game.swing(teamOf(remote), 0.65, -1);
    else if (button === 'right') game.swing(teamOf(remote), 0.65, 1);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { hit: 'hit', smash: 'crash', opp: 'pop', whiff: 'whoosh', bounce: 'tick', won: 'success', lost: 'fail', game: 'strike', over: 'start' };
  const farName = game.cpuFar ? 'CPU' : 'Far side';
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Swing when the ball arrives · sideways swing = forehand / backhand · hard swing on a high ball = smash · soft swing = lob · keys: A drive, 1 lob, 2 smash"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">
                {POINTS[game.pts.near]} – {POINTS[game.pts.far]}
              </div>
              <div className="mg-label">
                Games {game.games.near} – {game.games.far} · Near side vs {farName} · first to 2
              </div>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard big="Ready…" keyId="ready" />}
          {game.phase === 'serve' && (game.server === 'near' || !game.cpuFar) && <CenterCard small={`${game.server === 'near' ? 'Near side' : 'Far side'}: swing to serve`} big="" keyId={`s${game.pts.near}${game.pts.far}${game.games.near}${game.games.far}`} />}
          {game.shot && !game.message && <div className="mg-msg" key={game.shot + game.pts.near + game.pts.far} style={{ fontSize: 'calc(56 * var(--px))', top: '30%' }}>{game.shot}</div>}
          {game.message && <div className="mg-msg" key={game.message + game.pts.near + game.pts.far}>{game.message}</div>}
          {game.phase === 'over' && (
            <Results title={game.games.near > game.games.far ? 'Near side wins!' : `${farName} wins!`} rows={[{ label: 'Near side', value: String(game.games.near), color: PLAYER_COLORS[0] }, { label: farName, value: String(game.games.far), color: game.cpuFar ? '#e53935' : PLAYER_COLORS[1] }]} onAgain={() => { const l = lineup(); game.start(l.near.length ? l.near : ['local'], l.far); }} />
          )}
        </>
      )}
    />
  );
}
