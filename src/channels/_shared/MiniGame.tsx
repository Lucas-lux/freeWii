import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { Pill, useAnimationFrame, type ChannelContext } from '../../core';
import './shared.css';

/** What every canvas mini-game exposes to the shell. */
export interface CanvasGame {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, W: number, H: number): void;
  /** Sound cues produced since the last frame, drained by the shell. */
  events: string[];
  /** Set when the React HUD must re-render. */
  hudDirty: boolean;
}

interface MiniGameProps {
  ctx: ChannelContext;
  game: CanvasGame;
  onQuit(): void;
  onEvent(event: string): void;
  /** React HUD drawn over the canvas; re-rendered when `game.hudDirty` is set. */
  hud: (tick: number) => ReactNode;
  hint?: string;
  hideCursor?: boolean;
  className?: string;
}

/**
 * Shell shared by the mini-games: full-screen canvas sized to the container, requestAnimationFrame
 * loop (paused with the HOME Menu), event draining, HUD re-render on demand and the Quit button.
 */
export function MiniGame({ ctx, game, onQuit, onEvent, hud, hint, hideCursor, className = '' }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tick, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!hideCursor) return;
    ctx.setCursorVisible(false);
    return () => ctx.setCursorVisible(true);
  }, [ctx, hideCursor]);

  useEffect(
    () =>
      ctx.onResize((w, h) => {
        const c = canvasRef.current;
        if (!c) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }),
    [ctx],
  );

  useAnimationFrame((dt) => {
    if (!ctx.paused) game.update(dt);
    for (const ev of game.events.splice(0)) onEvent(ev);
    if (game.hudDirty) {
      game.hudDirty = false;
      refresh();
    }
    const c = canvasRef.current;
    const g2 = c?.getContext('2d');
    if (!c || !g2) return;
    g2.setTransform(1, 0, 0, 1, 0, 0);
    game.render(g2, c.width, c.height);
  });

  return (
    <div className={`mg ${className}`}>
      <canvas ref={canvasRef} className="mg-canvas" />
      {hud(tick)}
      {hint && <div className="mg-hint">{hint}</div>}
      <Pill small className="mg-quit" onClick={onQuit} clickSound="back">
        Quit
      </Pill>
    </div>
  );
}

/** Results overlay used by every mini-game. */
export function Results({ title, rating, rows, onAgain }: { title: string; rating?: string; rows: { label: string; value: string; color?: string }[]; onAgain(): void }) {
  return (
    <div className="mg-over">
      <h2>{title}</h2>
      {rating && <div className="mg-rating">{rating}</div>}
      <table>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ color: r.color }}>{r.label}</td>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pill onClick={onAgain} clickSound="start">
        Play again (A)
      </Pill>
    </div>
  );
}

/** Big centred card (round titles, countdowns, "Player 1"). */
export function CenterCard({ small, big, keyId }: { small?: string; big: string; keyId: string | number }) {
  return (
    <div className="mg-center" key={keyId}>
      {small && <div className="mg-center-small">{small}</div>}
      <div className="mg-center-big">{big}</div>
    </div>
  );
}

/** Helpers shared by the game classes. */
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
