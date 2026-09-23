import { useState } from 'react';
import { useButton, useInputEvent, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

type Outcome = 'strike' | 'foul' | 'out' | 'single' | 'double' | 'triple' | 'homer';

/** Batting against the CPU pitcher: time the swing, three outs end the game. */
class BaseballGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'windup' | 'pitch' | 'fly' | 'result' | 'over' = 'ready';
  countdown = 2;
  runs = 0;
  outs = 0;
  strikes = 0;
  bases = [false, false, false];
  hits = 0;
  message = '';
  ball = { x: 0, y: 0.5, z: 1, curve: 0, speed: 1 };
  swingT = 0;
  fly = { angle: 0, dist: 0, t: 0 };
  private timer = 0;

  start(): void {
    this.phase = 'ready';
    this.countdown = 2;
    this.runs = 0;
    this.outs = 0;
    this.strikes = 0;
    this.hits = 0;
    this.bases = [false, false, false];
    this.message = '';
    this.hudDirty = true;
  }

  private windup(): void {
    this.phase = 'windup';
    this.timer = rand(0.8, 1.4);
    this.ball = { x: rand(-0.25, 0.25), y: rand(0.35, 0.6), z: 1, curve: rand(-0.3, 0.3), speed: rand(0.95, 1.3) };
  }

  swing(strength: number): void {
    if (this.phase !== 'pitch') return;
    this.swingT = 0.35;
    const z = this.ball.z;
    if (z > 0.22 || z < 0) {
      this.strike('Swing and a miss');
      return;
    }
    const quality = 1 - Math.abs(z - 0.1) / 0.12;
    const angle = (0.1 - z) * 7 + rand(-0.15, 0.15); // early = pull to the left, late = opposite field
    const power = (0.35 + strength * 0.65) * (0.5 + quality * 0.5);
    if (Math.abs(angle) > 0.95) return this.hitBall('foul', angle, 0.3 + power * 0.3);
    const roll = Math.random();
    let outcome: Outcome;
    if (power > 0.82 && quality > 0.6) outcome = 'homer';
    else if (power > 0.6) outcome = roll < 0.35 ? 'out' : roll < 0.75 ? 'double' : 'triple';
    else if (power > 0.4) outcome = roll < 0.45 ? 'out' : 'single';
    else outcome = roll < 0.7 ? 'out' : 'single';
    this.hitBall(outcome, angle, 0.2 + power * 0.8);
  }

  private strike(why: string): void {
    this.strikes += 1;
    this.events.push('strike');
    if (this.strikes >= 3) {
      this.strikes = 0;
      this.out(`${why} · strike three!`);
    } else this.say(`${why} · strike ${this.strikes}`);
  }

  private out(why: string): void {
    this.outs += 1;
    this.strikes = 0;
    this.say(why);
    if (this.outs >= 3) {
      this.phase = 'over';
      this.events.push('over');
    }
    this.hudDirty = true;
  }

  private say(text: string): void {
    this.message = text;
    if (this.phase !== 'over') {
      this.phase = 'result';
      this.timer = 1.7;
    }
    this.hudDirty = true;
  }

  private hitBall(outcome: Outcome, angle: number, dist: number): void {
    this.fly = { angle, dist, t: 0 };
    this.phase = 'fly';
    this.events.push(outcome === 'homer' ? 'crack' : 'hit');
    this.timer = 1.4;
    this.pending = outcome;
  }
  private pending: Outcome = 'strike';

  private resolve(): void {
    const o = this.pending;
    if (o === 'foul') {
      if (this.strikes < 2) this.strikes += 1;
      this.say('Foul ball');
      return;
    }
    if (o === 'out') return this.out('Caught · out!');
    const n = o === 'single' ? 1 : o === 'double' ? 2 : o === 'triple' ? 3 : 4;
    let scored = 0;
    const runners = [true, ...this.bases];
    const next = [false, false, false];
    runners.forEach((r, i) => {
      if (!r) return;
      const to = i + n;
      if (to >= 4) scored += 1;
      else next[to - 1] = true;
    });
    this.bases = next;
    this.runs += scored;
    this.hits += 1;
    this.strikes = 0;
    this.events.push(o === 'homer' ? 'homer' : 'safe');
    this.say(`${o === 'homer' ? 'HOME RUN!' : o.charAt(0).toUpperCase() + o.slice(1) + '!'}${scored ? ` +${scored} run${scored > 1 ? 's' : ''}` : ''}`);
  }

  update(dt: number): void {
    this.swingT = Math.max(0, this.swingT - dt);
    switch (this.phase) {
      case 'ready':
        this.countdown -= dt;
        if (this.countdown <= 0) this.windup();
        break;
      case 'windup':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = 'pitch';
          this.events.push('pitch');
        }
        break;
      case 'pitch': {
        const b = this.ball;
        b.z -= dt * b.speed;
        b.x += b.curve * dt * 0.6;
        if (b.z < -0.1) this.strike('Called strike');
        break;
      }
      case 'fly':
        this.fly.t += dt;
        this.timer -= dt;
        if (this.timer <= 0) this.resolve();
        break;
      case 'result':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.message = '';
          this.windup();
          this.hudDirty = true;
        }
        break;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.4);
    sky.addColorStop(0, '#7ec8ff');
    sky.addColorStop(1, '#dff1ff');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#4caf50';
    g.fillRect(0, H * 0.36, W, H);
    g.fillStyle = '#c8a165';
    g.beginPath(); g.ellipse(W / 2, H * 0.47, W * 0.05, H * 0.02, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(W * 0.3, H); g.lineTo(W * 0.5, H * 0.45); g.lineTo(W * 0.7, H); g.closePath(); g.fill();
    // pitcher
    const px = W / 2, py = H * 0.46;
    g.fillStyle = '#e53935';
    g.beginPath(); g.roundRect(px - W * 0.014, py - H * 0.09, W * 0.028, H * 0.07, W * 0.006); g.fill();
    g.fillStyle = '#f1c27d';
    g.beginPath(); g.arc(px, py - H * 0.11, W * 0.011, 0, Math.PI * 2); g.fill();
    // strike zone
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(1, W * 0.002);
    g.strokeRect(W * 0.41, H * 0.5, W * 0.18, H * 0.25);
    // ball
    if (this.phase === 'pitch' || this.phase === 'windup') {
      const b = this.ball;
      const s = 1 / (1 + b.z * 6);
      const x = W / 2 + b.x * W * 0.18 * (1 - b.z), y = H * 0.46 + (1 - b.z) * H * 0.27 + (0.5 - b.y) * H * 0.2 * (1 - b.z);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x, y, W * 0.02 * s + W * 0.003, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d32f2f';
      g.lineWidth = Math.max(1, W * 0.002);
      g.beginPath(); g.arc(x, y, W * 0.012 * s, 0.3, 1.2); g.stroke();
    }
    if (this.phase === 'fly') {
      const f = this.fly;
      const k = Math.min(1, f.t / 1.4);
      const x = W / 2 + Math.sin(f.angle) * W * 0.5 * k * f.dist;
      const y = H * 0.8 - k * (H * 0.35 + f.dist * H * 0.25) - Math.sin(k * Math.PI) * H * 0.3 * f.dist;
      const s = 1 - k * 0.85 * f.dist;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x, y, W * 0.012 * s, 0, Math.PI * 2); g.fill();
    }
    // batter (bottom left) and bat
    const bx = W * 0.3, by = H * 0.95;
    g.fillStyle = '#37474f';
    g.fillRect(bx - W * 0.03, by - H * 0.28, W * 0.06, H * 0.28);
    g.fillStyle = '#3b82f6';
    g.beginPath(); g.roundRect(bx - W * 0.04, by - H * 0.52, W * 0.08, H * 0.26, W * 0.01); g.fill();
    g.fillStyle = '#f1c27d';
    g.beginPath(); g.arc(bx, by - H * 0.6, W * 0.025, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#a1887f';
    g.lineWidth = W * 0.012;
    g.lineCap = 'round';
    const a = this.swingT > 0 ? -0.5 + (0.35 - this.swingT) * 9 : -1.1;
    g.beginPath(); g.moveTo(bx + W * 0.04, by - H * 0.45); g.lineTo(bx + W * 0.04 + Math.cos(a) * W * 0.16, by - H * 0.45 + Math.sin(a) * W * 0.16); g.stroke();
    // bases
    const base = (x: number, y: number, on: boolean) => {
      g.fillStyle = on ? '#ffd740' : 'rgba(255,255,255,0.8)';
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-W * 0.008, -W * 0.008, W * 0.016, W * 0.016); g.restore();
    };
    base(W * 0.86, H * 0.16, this.bases[0]);
    base(W * 0.83, H * 0.1, this.bases[1]);
    base(W * 0.8, H * 0.16, this.bases[2]);
  }
}

export function Baseball({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new BaseballGame();
    g.start();
    return g;
  });
  useInputEvent('swing', ({ swing }) => game.swing(swing.strength));
  useButton('a', () => {
    if (game.phase === 'over') game.start();
    else game.swing(0.6);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { pitch: 'whoosh', strike: 'deny', hit: 'hit', crack: 'crash', safe: 'success', homer: 'strike', over: 'timeup' };
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Swing (or press A) when the pitch crosses the plate · early pulls left, late goes right · 3 outs"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-big">{game.runs}</div>
              <div className="mg-label">
                run{game.runs === 1 ? '' : 's'} · {game.hits} hit{game.hits === 1 ? '' : 's'}
              </div>
            </div>
            <div className="mg-score" style={{ borderColor: '#e53935' }}>
              {'●'.repeat(game.outs)}{'○'.repeat(3 - game.outs)}
              <small>outs · strikes {game.strikes}</small>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard big="Play ball!" keyId="ready" />}
          {game.message && <div className="mg-msg" key={game.message + game.outs + game.strikes + game.hits}>{game.message}</div>}
          {game.phase === 'over' && <Results title="Three outs" rating={game.runs >= 6 ? 'Slugger!' : game.runs >= 3 ? 'Solid inning' : 'Swing harder'} rows={[{ label: 'Runs', value: String(game.runs) }, { label: 'Hits', value: String(game.hits) }]} onAgain={() => game.start()} />}
        </>
      )}
    />
  );
}
