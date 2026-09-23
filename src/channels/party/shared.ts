import { PLAYER_COLORS, type Wiimote } from '../../core';

/** A player as the party games see them. */
export interface Contestant {
  id: string;
  name: string;
  color: string;
  player: number;
}

export function contestants(players: Wiimote[]): Contestant[] {
  return players.map((r) => ({
    id: r.id,
    name: r.kind === 'phone' ? r.name : `Player ${r.player}`,
    color: PLAYER_COLORS[(r.player - 1 + 4) % 4],
    player: r.player,
  }));
}

export function ranked<T extends { score: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => b.score - a.score);
}

/** Draws a little round-headed character (the party "Mii") facing the camera. */
export function drawGuy(g: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, opts: { wobble?: number; face?: 'smile' | 'shout' | 'sad' | 'wow'; arms?: number } = {}): void {
  const { wobble = 0, face = 'smile', arms = 0 } = opts;
  g.save();
  g.translate(x, y);
  g.rotate(wobble);
  // body
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(-size * 0.42, -size * 0.1, size * 0.84, size * 0.95, size * 0.25);
  g.fill();
  // arms
  g.strokeStyle = color;
  g.lineWidth = size * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-size * 0.4, size * 0.1);
  g.lineTo(-size * 0.75, size * 0.1 - arms * size * 0.6);
  g.moveTo(size * 0.4, size * 0.1);
  g.lineTo(size * 0.75, size * 0.1 - arms * size * 0.6);
  g.stroke();
  // head
  g.fillStyle = '#f5cba7';
  g.beginPath();
  g.arc(0, -size * 0.5, size * 0.42, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4e342e';
  g.beginPath();
  g.arc(0, -size * 0.62, size * 0.42, Math.PI, Math.PI * 2);
  g.fill();
  // eyes
  g.fillStyle = '#222';
  const ey = -size * 0.52;
  if (face === 'wow' || face === 'shout') {
    g.beginPath();
    g.arc(-size * 0.15, ey, size * 0.07, 0, Math.PI * 2);
    g.arc(size * 0.15, ey, size * 0.07, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillRect(-size * 0.19, ey - size * 0.04, size * 0.08, size * 0.1);
    g.fillRect(size * 0.11, ey - size * 0.04, size * 0.08, size * 0.1);
  }
  // mouth
  g.strokeStyle = '#222';
  g.lineWidth = Math.max(1, size * 0.04);
  g.beginPath();
  const my = -size * 0.36;
  if (face === 'smile') g.arc(0, my - size * 0.04, size * 0.12, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (face === 'sad') g.arc(0, my + size * 0.08, size * 0.12, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (face === 'shout') {
    g.fillStyle = '#b71c1c';
    g.ellipse(0, my, size * 0.1, size * 0.13, 0, 0, Math.PI * 2);
    g.fill();
  } else g.ellipse(0, my, size * 0.06, size * 0.08, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}
