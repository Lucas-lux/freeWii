import { drawCover, drawSprite, type ImageMap } from '../../core';
import { BALL_R, CAM_MAX, CAM_REST, LANE_END, LANE_HALF, LANE_LENGTH, PIN_H, PIN_R, type BowlerPose, type BowlingGame } from './bowlingGame';

/** Focal length as a fraction of the canvas width (≈ 41° horizontal field of view, like a TV camera). */
const FOCAL = 1.5;
/** Camera height above the lane (metres): high behind the bowler, low next to the pins. */
const CAM_H_REST = 2.2;
const CAM_H_PINS = 1.0;
/** The camera stands to the right of the bowler at rest so the lane and pins stay visible. */
const CAM_X_REST = 0.9;
/** Distance between neighbouring lanes (metres). */
const LANE_PITCH = 1.9;
/** Fraction of the background image height where the pin deck / scoreboards line sits. */
const BACKGROUND_DECK_Y = 0.475;

export type BowlingImageKey =
  | 'background'
  | 'ball'
  | 'pin'
  | 'pinFallen'
  | 'bowlerIdle'
  | 'bowlerHold'
  | 'bowlerBack'
  | 'bowlerSwing'
  | 'bowlerRelease'
  | 'bowlerCheer'
  | 'bowlerSad';

export type BowlingImages = ImageMap<BowlingImageKey>;

const POSE_IMAGE: Record<BowlerPose, BowlingImageKey> = {
  idle: 'bowlerIdle',
  hold: 'bowlerHold',
  back: 'bowlerBack',
  swing: 'bowlerSwing',
  release: 'bowlerRelease',
  cheer: 'bowlerCheer',
  sad: 'bowlerSad',
};

/** Screen position of a point on the lane floor; `s` is the pixel size of one metre at that depth. */
interface Proj {
  x: number;
  y: number;
  s: number;
}

export interface BowlingStyle {
  ballColor: string;
  shirtColor: string;
}

/**
 * Pinhole-perspective canvas renderer for the lane. The camera sits at `game.camZ` metres from the
 * foul line (negative = on the approach) and follows the ball down the lane.
 * Every element has a procedural drawing and an optional sprite from public/assets.
 */
export function renderBowling(
  ctx: CanvasRenderingContext2D,
  g: BowlingGame,
  W: number,
  H: number,
  style: BowlingStyle,
  images: BowlingImages | null,
): void {
  const horizonY = H * 0.28;
  const cam = g.camZ;
  const travel = Math.max(0, Math.min(1, (cam - CAM_REST) / (CAM_MAX - CAM_REST)));
  const camH = CAM_H_REST + (CAM_H_PINS - CAM_H_REST) * travel;
  const camX = CAM_X_REST * (1 - travel);
  const proj = (x: number, z: number): Proj => {
    const s = (FOCAL * W) / Math.max(0.5, z - cam);
    return { x: W / 2 + (x - camX) * s, y: horizonY + camH * s, s };
  };
  const px = (metres: number, s: number) => metres * s;
  const quad = (a: Proj, b: Proj, c: Proj, d: Proj, fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const zNear = cam + 0.6;
  const zFar = LANE_END + 0.6;

  // ---- background: alley wall, pit, pinsetter housing
  const far = proj(0, zFar);
  if (images?.background) {
    // The photo shows the far wall; everything below the pin deck line is redrawn by the game so the
    // lanes always match the camera. BACKGROUND_DECK_Y is where the deck sits in the image.
    drawCover(ctx, images.background, 0, 0, W, H);
    const deckY = H * BACKGROUND_DECK_Y;
    ctx.fillStyle = '#2a2520';
    ctx.fillRect(0, Math.min(deckY, far.y), W, H);
    if (far.y > deckY) {
      // camera close to the pins: the machine housing grows to hide the image lanes
      ctx.fillStyle = '#0b0d12';
      ctx.fillRect(0, deckY - 2, W, far.y - deckY + 2);
    }
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, '#171b26');
    sky.addColorStop(1, '#3c4b6e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizonY + 2);
    ctx.fillStyle = '#262b36';
    ctx.fillRect(0, horizonY, W, H - horizonY);
  }
  const housingH = px(0.6, far.s);
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, far.y - housingH, W, housingH);
  ctx.fillStyle = '#c62828';
  ctx.fillRect(0, far.y - housingH, W, Math.max(2, housingH * 0.08));

  // ---- approach (behind the foul line), gutters and lane
  if (zNear < 0) {
    const a0 = proj(-LANE_HALF - 0.9, zNear);
    const a1 = proj(-LANE_HALF - 0.9, 0);
    const a2 = proj(LANE_HALF + 0.9, 0);
    const a3 = proj(LANE_HALF + 0.9, zNear);
    quad(a0, a1, a2, a3, '#8d6e4b');
  }
  const laneStart = Math.max(zNear, 0);
  const gw = LANE_HALF + 0.14;
  for (const side of [-3, -2, -1, 1, 2, 3]) {
    const ox = side * LANE_PITCH;
    quad(proj(ox - gw, laneStart), proj(ox - gw, zFar), proj(ox + gw, zFar), proj(ox + gw, laneStart), '#3f4453');
    quad(proj(ox - LANE_HALF, laneStart), proj(ox - LANE_HALF, zFar), proj(ox + LANE_HALF, zFar), proj(ox + LANE_HALF, laneStart), '#b48a58');
    quad(proj(ox - LANE_HALF, Math.max(laneStart, LANE_LENGTH - 0.7)), proj(ox - LANE_HALF, zFar), proj(ox + LANE_HALF, zFar), proj(ox + LANE_HALF, Math.max(laneStart, LANE_LENGTH - 0.7)), 'rgba(0,0,0,0.18)');
  }
  quad(proj(-gw, laneStart), proj(-gw, zFar), proj(gw, zFar), proj(gw, laneStart), '#4b5162');
  const l0 = proj(-LANE_HALF, laneStart);
  const r0 = proj(LANE_HALF, laneStart);
  const lF = proj(-LANE_HALF, zFar);
  const rF = proj(LANE_HALF, zFar);
  const wood = ctx.createLinearGradient(0, lF.y, 0, l0.y);
  wood.addColorStop(0, '#b3844c');
  wood.addColorStop(1, '#ecc48c');
  quad(l0, lF, rF, r0, wood);
  ctx.strokeStyle = 'rgba(110, 70, 25, 0.28)';
  ctx.lineWidth = Math.max(1, W * 0.001);
  for (let i = 1; i < 12; i++) {
    const x = -LANE_HALF + (i / 12) * LANE_HALF * 2;
    const a = proj(x, laneStart);
    const b = proj(x, zFar);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  quad(proj(-LANE_HALF, Math.max(laneStart, LANE_LENGTH - 0.7)), lF, rF, proj(LANE_HALF, Math.max(laneStart, LANE_LENGTH - 0.7)), 'rgba(0,0,0,0.14)');
  if (zNear < 0) {
    const fl = proj(-LANE_HALF - 0.14, 0);
    const fr = proj(LANE_HALF + 0.14, 0);
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = Math.max(2, px(0.03, fl.s));
    ctx.beginPath();
    ctx.moveTo(fl.x, fl.y);
    ctx.lineTo(fr.x, fr.y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(60, 35, 10, 0.5)';
  for (let i = -3; i <= 3; i++) {
    const z = 4.6 - Math.abs(i) * 0.35;
    if (z < zNear) continue;
    const p = proj(i * 0.13, z);
    const h = px(0.18, p.s);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - h * 0.35, p.y);
    ctx.lineTo(p.x + h * 0.35, p.y);
    ctx.closePath();
    ctx.fill();
  }

  // ---- aim guide
  if (g.phase === 'aim' || g.phase === 'hold') {
    const a = (g.aimAngle * Math.PI) / 180;
    const from = proj(g.aimX, 0.3);
    const to = proj(g.aimX + Math.sin(a) * 18, Math.cos(a) * 18);
    ctx.setLineDash([W * 0.01, W * 0.012]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- pins and ball, far to near
  const items: { z: number; draw: () => void }[] = [];
  for (const p of g.pins) {
    if (p.gone || p.z < zNear) continue;
    items.push({ z: p.z, draw: () => drawPin(ctx, proj(p.x, p.z), px, p.tilt, p.tiltDir, images) });
  }
  const b = g.ball;
  if ((b.active || g.phase === 'settle') && b.z >= zNear && b.z < LANE_END + 0.3) {
    items.push({
      z: b.z,
      draw: () => {
        const pr = proj(b.x, b.z);
        const r = px(BALL_R, pr.s);
        drawShadow(ctx, pr.x, pr.y, r);
        drawBall(ctx, pr.x, pr.y - r * 0.85, r, style.ballColor, images?.ball ?? null);
      },
    });
  }
  items.sort((a, c) => c.z - a.z);
  for (const it of items) it.draw();

  // ---- pinsetter sweep bar (in front of the pins)
  if (g.phase === 'sweep') {
    const t = g.sweepT;
    const down = t < 0.3 ? t / 0.3 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    const a = proj(-LANE_HALF - 0.06, LANE_LENGTH - 0.45);
    const c = proj(LANE_HALF + 0.06, LANE_LENGTH - 0.45);
    const pinH = px(PIN_H, a.s);
    const barH = pinH * 0.4;
    const lift = (1 - down) * pinH * 2.2;
    const y = a.y - lift;
    ctx.fillStyle = '#37474f';
    ctx.fillRect(a.x, y - barH, c.x - a.x, barH);
    ctx.fillStyle = '#546e7a';
    ctx.fillRect(a.x, y - barH, c.x - a.x, barH * 0.25);
    ctx.fillStyle = '#263238';
    for (const rx of [a.x + (c.x - a.x) * 0.2, a.x + (c.x - a.x) * 0.8]) {
      ctx.fillRect(rx - barH * 0.15, far.y - housingH, barH * 0.3, y - barH - (far.y - housingH));
    }
  }

  drawBowler(ctx, g, proj, px, style, images);
  drawConfetti(ctx, g, W, H);
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, cy: number, r: number, color: string, img: HTMLImageElement | null): void {
  if (img) {
    ctx.drawImage(img, x - r, cy - r, r * 2, r * 2);
    return;
  }
  const grad = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.35, r * 0.1, x, cy, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, '#101010');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (const [dx, dy] of [
    [-0.28, -0.2],
    [0.05, -0.32],
    [0.3, -0.1],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, cy + dy * r, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  p: Proj,
  px: (m: number, s: number) => number,
  tilt: number,
  dir: number,
  images: BowlingImages | null,
): void {
  const h = px(PIN_H, p.s);
  const w = px(PIN_R * 2, p.s);
  if (images?.pin) {
    if (tilt >= 1 && images.pinFallen) {
      drawSprite(ctx, images.pinFallen, p.x, p.y, w * 1.2);
      return;
    }
    drawSprite(ctx, images.pin, p.x, p.y, h, tilt * dir * Math.PI * 0.48);
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt * dir * Math.PI * 0.48);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w * 0.62, -h * 0.35, -w * 0.28, -h * 0.62);
  ctx.quadraticCurveTo(-w * 0.45, -h * 0.85, 0, -h);
  ctx.quadraticCurveTo(w * 0.45, -h * 0.85, w * 0.28, -h * 0.62);
  ctx.quadraticCurveTo(w * 0.62, -h * 0.35, w / 2, 0);
  ctx.closePath();
  ctx.fillStyle = '#fbfbfb';
  ctx.fill();
  ctx.strokeStyle = '#8f8f8f';
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.stroke();
  ctx.strokeStyle = '#d32f2f';
  ctx.lineWidth = Math.max(1, h * 0.045);
  for (const y of [0.66, 0.74]) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * y);
    ctx.lineTo(w * 0.3, -h * y);
    ctx.stroke();
  }
  ctx.restore();
}

/** The bowler seen from behind at the foul line: sprite when provided, simple procedural figure otherwise. */
function drawBowler(
  ctx: CanvasRenderingContext2D,
  g: BowlingGame,
  proj: (x: number, z: number) => Proj,
  px: (m: number, s: number) => number,
  style: BowlingStyle,
  images: BowlingImages | null,
): void {
  const travelled = g.camZ - CAM_REST;
  if (travelled > 2.6) return;
  const alpha = Math.max(0, Math.min(1, 1 - travelled / 2.6));
  const base = proj(g.aimX, -0.6);
  const s = base.s;
  const h = px(1.5, s);
  const pose = g.pose;
  const ballInHand = g.phase === 'intro' || g.phase === 'aim' || g.phase === 'hold' || g.phase === 'throw';
  const sprite = images?.[POSE_IMAGE[pose]] ?? images?.bowlerIdle ?? null;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (sprite) {
    drawSprite(ctx, sprite, base.x, base.y, h);
    ctx.restore();
    return;
  }
  const w = h * 0.34;
  const legH = h * 0.42;
  const torsoH = h * 0.36;
  const headR = h * 0.11;
  const cx = base.x;
  const feetY = base.y;
  const skin = '#f1c27d';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, feetY, w * 0.9, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs
  ctx.fillStyle = '#37474f';
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.44, feetY - legH, w * 0.36, legH, w * 0.12);
  ctx.roundRect(cx + w * 0.08, feetY - legH, w * 0.36, legH, w * 0.12);
  ctx.fill();
  // torso
  const torsoTop = feetY - legH - torsoH;
  ctx.fillStyle = style.shirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, torsoTop, w, torsoH + h * 0.04, w * 0.25);
  ctx.fill();
  // head + hair
  const headY = torsoTop - headR * 0.9;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.arc(cx, headY - headR * 0.1, headR * 1.02, Math.PI, 0);
  ctx.fill();
  // left arm hanging
  const shY = torsoTop + h * 0.05;
  ctx.strokeStyle = skin;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, shY);
  ctx.lineTo(cx - w * 0.62, shY + h * 0.3);
  ctx.stroke();
  // right arm with the ball, swinging around the shoulder
  const armLen = h * 0.36;
  const theta = g.arm * 1.9;
  const sx = cx + w * 0.5;
  let hx: number;
  let hy: number;
  let ballScale: number;
  let ballInFront: boolean;
  if (theta <= 0) {
    const a = -theta;
    hx = sx + armLen * Math.sin(a) * 0.7;
    hy = shY + armLen * Math.cos(a);
    ballScale = 1 + (a / 1.9) * 0.35;
    ballInFront = true;
  } else {
    hx = sx - armLen * Math.sin(theta) * 0.18;
    hy = shY + armLen * Math.cos(theta) * 0.95;
    ballScale = 1 - (theta / 1.9) * 0.3;
    ballInFront = theta < 0.5;
  }
  const br = px(BALL_R, s) * ballScale;
  if (ballInHand && !ballInFront) drawBall(ctx, hx, hy + br * 0.3, br, style.ballColor, images?.ball ?? null);
  ctx.strokeStyle = skin;
  ctx.lineWidth = w * 0.22;
  ctx.beginPath();
  ctx.moveTo(sx, shY);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  if (ballInHand && ballInFront) drawBall(ctx, hx, hy + br * 0.3, br, style.ballColor, images?.ball ?? null);
  // cheer / sad hints
  if (pose === 'cheer') {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, shY);
    ctx.lineTo(cx - w * 0.9, shY - h * 0.25);
    ctx.moveTo(sx, shY);
    ctx.lineTo(sx + w * 0.4, shY - h * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

function drawConfetti(ctx: CanvasRenderingContext2D, g: BowlingGame, W: number, H: number): void {
  if (g.confetti.length === 0) return;
  const size = W * 0.008;
  for (const c of g.confetti) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, c.life);
    ctx.translate(c.x * W, c.y * H);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-size, -size / 2, size * 2, size);
    ctx.restore();
  }
}
