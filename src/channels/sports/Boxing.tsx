import { useState } from 'react';
import { useInputEvent, type ChannelContext } from '../../core';
import { CenterCard, MiniGame, Results, rand, type CanvasGame } from '../_shared/MiniGame';

type Side = 'left' | 'right';
const ROUND_SECONDS = 45;

/** First-person boxing: swing to punch (direction picks the hand), D-pad to dodge, hold B to guard. */
class BoxingGame implements CanvasGame {
  events: string[] = [];
  hudDirty = true;
  phase: 'ready' | 'fight' | 'ko' | 'break' | 'over' = 'ready';
  round = 1;
  time = ROUND_SECONDS;
  countdown = 2;
  player = { hp: 100, guard: false, dodge: 0, punchT: 0, punchSide: 'left' as Side, hurtT: 0 };
  opp = { hp: 100, state: 'idle' as 'idle' | 'wind' | 'punch' | 'stun' | 'down', t: 0, side: 'left' as Side, hurtT: 0, hitsTaken: 0 };
  winner: 'player' | 'cpu' | null = null;
  message = '';
  private alt: Side = 'left';
  private lastTick = -1;

  start(): void {
    this.phase = 'ready';
    this.round = 1;
    this.countdown = 2;
    this.time = ROUND_SECONDS;
    this.player = { hp: 100, guard: false, dodge: 0, punchT: 0, punchSide: 'left', hurtT: 0 };
    this.opp = { hp: 100, state: 'idle', t: rand(0.8, 1.5), side: 'left', hurtT: 0, hitsTaken: 0 };
    this.winner = null;
    this.message = '';
    this.hudDirty = true;
  }

  punch(strength: number, lateral: number): void {
    if (this.phase !== 'fight' || this.player.punchT > 0 || this.player.hurtT > 0.2) return;
    const side: Side = lateral < -0.3 ? 'left' : lateral > 0.3 ? 'right' : this.alt;
    this.alt = side === 'left' ? 'right' : 'left';
    this.player.punchT = 0.28;
    this.player.punchSide = side;
    const o = this.opp;
    if (o.state === 'down') return;
    const counter = o.state === 'wind';
    const blocked = o.state === 'idle' && Math.random() < 0.3;
    if (blocked) {
      this.events.push('block');
      return;
    }
    const dmg = Math.round((7 + strength * 8) * (counter ? 1.8 : 1) * (o.state === 'stun' ? 1.4 : 1));
    o.hp = Math.max(0, o.hp - dmg);
    o.hurtT = 0.25;
    o.hitsTaken += 1;
    this.events.push(counter ? 'counter' : 'hit');
    if (o.hitsTaken >= 4 && o.state !== 'stun') {
      o.state = 'stun';
      o.t = 1.6;
      o.hitsTaken = 0;
      this.events.push('stun');
    }
    if (o.hp <= 0) this.knockout('player');
    this.hudDirty = true;
  }

  setGuard(on: boolean): void {
    this.player.guard = on;
  }

  setDodge(dir: number): void {
    this.player.dodge = dir;
  }

  private knockout(winner: 'player' | 'cpu'): void {
    this.opp.state = winner === 'player' ? 'down' : 'idle';
    this.winner = winner;
    this.phase = 'ko';
    this.countdown = 2.5;
    this.message = winner === 'player' ? 'K.O.!' : 'You are down!';
    this.events.push(winner === 'player' ? 'ko' : 'lost');
    this.hudDirty = true;
  }

  update(dt: number): void {
    const p = this.player, o = this.opp;
    p.punchT = Math.max(0, p.punchT - dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    o.hurtT = Math.max(0, o.hurtT - dt);
    if (this.phase === 'ready' || this.phase === 'break') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'fight';
        this.message = '';
        this.events.push('bell');
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase === 'ko') {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = 'over';
        this.events.push('over');
        this.hudDirty = true;
      }
      return;
    }
    if (this.phase !== 'fight') return;
    this.time -= dt;
    if (Math.ceil(this.time) !== this.lastTick) {
      this.lastTick = Math.ceil(this.time);
      this.hudDirty = true;
    }
    if (this.time <= 0) {
      if (this.round >= 3) {
        this.winner = p.hp >= o.hp ? 'player' : 'cpu';
        this.phase = 'over';
        this.message = 'Decision';
        this.events.push('bell', 'over');
      } else {
        this.round += 1;
        this.time = ROUND_SECONDS;
        this.phase = 'break';
        this.countdown = 2.5;
        this.message = `Round ${this.round}`;
        p.hp = Math.min(100, p.hp + 15);
        o.hp = Math.min(100, o.hp + 15);
        this.events.push('bell');
      }
      this.hudDirty = true;
      return;
    }
    o.t -= dt;
    switch (o.state) {
      case 'idle':
        if (o.t <= 0) {
          o.state = 'wind';
          o.side = Math.random() < 0.5 ? 'left' : 'right';
          o.t = 0.55;
        }
        break;
      case 'wind':
        if (o.t <= 0) {
          o.state = 'punch';
          o.t = 0.22;
          const dodged = (o.side === 'left' && p.dodge > 0) || (o.side === 'right' && p.dodge < 0);
          if (dodged) this.events.push('dodge');
          else if (p.guard) {
            p.hp = Math.max(0, p.hp - 3);
            this.events.push('block');
          } else {
            p.hp = Math.max(0, p.hp - 11);
            p.hurtT = 0.4;
            this.events.push('hurt');
            if (p.hp <= 0) this.knockout('cpu');
          }
          this.hudDirty = true;
        }
        break;
      case 'punch':
        if (o.t <= 0) {
          o.state = 'idle';
          o.t = rand(0.7, 1.6) - this.round * 0.12;
        }
        break;
      case 'stun':
        if (o.t <= 0) {
          o.state = 'idle';
          o.t = 0.8;
        }
        break;
    }
  }

  render(g: CanvasRenderingContext2D, W: number, H: number): void {
    const p = this.player, o = this.opp;
    const shake = p.hurtT > 0 ? Math.sin(p.hurtT * 60) * W * 0.01 : 0;
    const dodgeX = p.dodge * W * 0.08;
    g.fillStyle = '#1a1a2e';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e8e0d0';
    g.fillRect(0, H * 0.45, W, H);
    for (const y of [0.3, 0.38, 0.46]) {
      g.strokeStyle = y === 0.38 ? '#e53935' : '#f5f5f5';
      g.lineWidth = H * 0.012;
      g.beginPath(); g.moveTo(0, H * y + shake); g.lineTo(W, H * y + shake); g.stroke();
    }
    // opponent
    const ox = W / 2 - dodgeX + shake, oy = H * 0.55 + (o.state === 'down' ? H * 0.3 : 0);
    const lean = o.state === 'punch' ? H * 0.05 : o.state === 'stun' ? Math.sin(Date.now() / 90) * W * 0.01 : 0;
    const s = H * 0.5;
    g.fillStyle = '#263238';
    g.beginPath(); g.roundRect(ox - s * 0.28, oy - s * 0.28 + lean, s * 0.56, s * 0.68, s * 0.1); g.fill();
    g.fillStyle = o.hurtT > 0 ? '#ffab91' : '#f1c27d';
    g.beginPath(); g.arc(ox, oy - s * 0.4 + lean, s * 0.19, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#222';
    g.beginPath(); g.arc(ox - s * 0.07, oy - s * 0.46 + lean, s * 0.02, 0, Math.PI * 2); g.arc(ox + s * 0.07, oy - s * 0.46 + lean, s * 0.02, 0, Math.PI * 2); g.fill();
    const glove = (x: number, y: number, r: number, color: string) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    const wind = o.state === 'wind' ? s * 0.18 : 0;
    const punch = o.state === 'punch' ? s * 0.5 : 0;
    const leftGlove = o.side === 'left' ? wind + punch : 0;
    const rightGlove = o.side === 'right' ? wind + punch : 0;
    glove(ox - s * 0.36 - leftGlove * 0.2, oy - s * 0.05 - (o.side === 'left' ? wind : 0) + punch * (o.side === 'left' ? 0.6 : 0), s * 0.13 + leftGlove * 0.25, '#c62828');
    glove(ox + s * 0.36 + rightGlove * 0.2, oy - s * 0.05 - (o.side === 'right' ? wind : 0) + punch * (o.side === 'right' ? 0.6 : 0), s * 0.13 + rightGlove * 0.25, '#c62828');
    if (o.state === 'stun') {
      g.fillStyle = '#ffd740';
      g.font = `900 ${s * 0.12}px Nunito, sans-serif`;
      g.textAlign = 'center';
      g.fillText('★ ★ ★', ox, oy - s * 0.7);
    }
    // player gloves
    const pl = p.punchT > 0 && p.punchSide === 'left' ? (0.28 - p.punchT) / 0.28 : 0;
    const pr = p.punchT > 0 && p.punchSide === 'right' ? (0.28 - p.punchT) / 0.28 : 0;
    const guardY = p.guard ? -H * 0.18 : 0;
    glove(W * 0.22 + Math.sin(pl * Math.PI) * W * 0.18 - dodgeX, H * 0.95 - Math.sin(pl * Math.PI) * H * 0.45 + guardY, W * 0.075 * (1 - Math.sin(pl * Math.PI) * 0.35), '#1565c0');
    glove(W * 0.78 - Math.sin(pr * Math.PI) * W * 0.18 - dodgeX, H * 0.95 - Math.sin(pr * Math.PI) * H * 0.45 + guardY, W * 0.075 * (1 - Math.sin(pr * Math.PI) * 0.35), '#1565c0');
    if (p.hurtT > 0) {
      g.fillStyle = `rgba(255,0,0,${p.hurtT * 0.6})`;
      g.fillRect(0, 0, W, H);
    }
  }
}

export function Boxing({ ctx, onQuit }: { ctx: ChannelContext; onQuit(): void }) {
  const [game] = useState(() => {
    const g = new BoxingGame();
    g.start();
    return g;
  });
  useInputEvent('swing', ({ swing }) => game.punch(swing.strength, swing.direction.x));
  useInputEvent('buttondown', ({ button }) => {
    if (button === 'a') {
      if (game.phase === 'over') game.start();
      else game.punch(0.6, 0);
    } else if (button === 'b') game.setGuard(true);
    else if (button === 'left') game.setDodge(-1);
    else if (button === 'right') game.setDodge(1);
    else if (button === 'one') game.punch(0.6, -1);
    else if (button === 'two') game.punch(0.6, 1);
  });
  useInputEvent('buttonup', ({ button }) => {
    if (button === 'b') game.setGuard(false);
    else if (button === 'left' || button === 'right') game.setDodge(0);
  });
  const sounds: Record<string, Parameters<typeof ctx.audio.play>[0]> = { hit: 'hit', counter: 'crash', block: 'tick', dodge: 'whoosh', hurt: 'deny', stun: 'ping', bell: 'go', ko: 'strike', lost: 'fail', over: 'start' };
  return (
    <MiniGame
      ctx={ctx}
      game={game}
      onQuit={onQuit}
      onEvent={(ev) => ctx.audio.play(sounds[ev])}
      hint="Swing to punch (swing sideways for hooks, 1/2 on keyboard) · ◀ ▶ dodge when a glove winds up · hold B to guard"
      hud={() => (
        <>
          <div className="mg-hud">
            <div>
              <div className="mg-label">You</div>
              <div className="mg-bar"><i style={{ width: `${game.player.hp}%` }} /></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="mg-big">{Math.max(0, Math.ceil(game.time))}</div>
              <div className="mg-label">Round {game.round}/3</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mg-label">CPU</div>
              <div className="mg-bar"><i style={{ width: `${game.opp.hp}%` }} /></div>
            </div>
          </div>
          {game.phase === 'ready' && <CenterCard small="Round 1" big="Fight!" keyId="ready" />}
          {game.message && game.phase !== 'over' && <CenterCard big={game.message} keyId={game.message + game.round} />}
          {game.phase === 'over' && <Results title={game.winner === 'player' ? 'You win!' : 'You lose'} rating={game.message === 'K.O.!' ? 'Knockout!' : game.winner === 'player' ? 'On points' : 'Get back up'} rows={[{ label: 'Your health', value: String(game.player.hp) }, { label: 'CPU health', value: String(game.opp.hp) }]} onAgain={() => game.start()} />}
        </>
      )}
    />
  );
}
