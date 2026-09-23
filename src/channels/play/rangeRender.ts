import { drawCover, drawSprite, type ImageMap } from '../../core';
import { H, SHELF_Y, type RangeGame, type Target } from './range';

export type RangeImageKey =
  | 'background'
  | 'shelf'
  | 'balloon1'
  | 'balloon2'
  | 'balloon3'
  | 'clay'
  | 'can'
  | 'canDented'
  | 'duck1'
  | 'duck2'
  | 'duck3'
  | 'ufo'
  | 'crosshair'
  | 'grass';

export type RangeImages = ImageMap<RangeImageKey>;

export interface PointerInfo {
  x: number;
  y: number;
  onScreen: boolean;
  color: string;
  player: number;
  /** 0..1, kicks the crosshair after a shot. */
  recoil: number;
}

/** Canvas renderer for the target range. Everything is expressed in game units (x 0..1) times the canvas width. */
export function renderRange(ctx: CanvasRenderingContext2D, g: RangeGame, W: number, Hpx: number, pointers: PointerInfo[], images: RangeImages | null): void {
  const u = W; // 1 game unit = canvas width
  if (images?.background) {
    drawCover(ctx, images.background, 0, 0, W, Hpx);
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, Hpx);
    sky.addColorStop(0, '#5fb8ff');
    sky.addColorStop(0.6, '#bfe7ff');
    sky.addColorStop(0.61, '#7cc96b');
    sky.addColorStop(1, '#3e9a3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, Hpx);
    ctx.fillStyle = 'rgba(255, 244, 180, 0.9)';
    ctx.beginPath();
    ctx.arc(u * 0.86, u * 0.08, u * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fb75e';
    for (const [cx, r] of [
      [0.15, 0.22],
      [0.55, 0.3],
      [0.9, 0.2],
    ]) {
      ctx.beginPath();
      ctx.arc(cx * u, H * 0.61 * u + r * u * 0.6, r * u, Math.PI, 0);
      ctx.fill();
    }
  }
  // shelf for the cans (always drawn during the can round, faint otherwise)
  const shelfAlpha = g.stage.kind === 'can' || g.targets.some((t) => t.kind === 'can') ? 1 : 0.35;
  ctx.globalAlpha = shelfAlpha;
  if (images?.shelf) {
    const sh = u * 0.03;
    ctx.drawImage(images.shelf, u * 0.1, SHELF_Y * u - sh * 0.3, u * 0.8, sh);
  } else {
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(u * 0.1, SHELF_Y * u, u * 0.8, u * 0.012);
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(u * 0.1, SHELF_Y * u + u * 0.012, u * 0.8, u * 0.006);
  }
  ctx.globalAlpha = 1;

  for (const t of g.targets) drawTarget(ctx, t, u, images);
  if (images?.grass) {
    const gh = (images.grass.naturalHeight / images.grass.naturalWidth) * W * 0.55;
    ctx.drawImage(images.grass, 0, Hpx - gh * 0.75, W, gh);
  }

  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * u, p.y * u, p.size * u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // floating score popups
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of g.popups) {
    const k = p.t / 0.9;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.font = `900 ${u * 0.026 * (1 + k * 0.3)}px Nunito, sans-serif`;
    ctx.lineWidth = u * 0.004;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = p.color;
    const y = (p.y - k * 0.05) * u;
    ctx.strokeText(p.text, p.x * u, y);
    ctx.fillText(p.text, p.x * u, y);
  }
  ctx.globalAlpha = 1;

  // muzzle flashes
  for (const s of g.shooters) {
    if (s.flashT <= 0) continue;
    const k = s.flashT / 0.12;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = u * 0.004;
    ctx.globalAlpha = k;
    ctx.beginPath();
    ctx.arc(s.flashX * u, s.flashY * u, u * 0.018 * (1.6 - k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 240, 160, 0.9)';
    ctx.beginPath();
    ctx.arc(s.flashX * u, s.flashY * u, u * 0.008 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // crosshairs
  for (const p of pointers) {
    if (!p.onScreen) continue;
    const x = p.x * u;
    const y = p.y * Hpx;
    const r = u * 0.022 * (1 + p.recoil * 0.4);
    if (images?.crosshair) {
      ctx.globalAlpha = 0.95;
      ctx.drawImage(images.crosshair, x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = u * 0.003;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x - r * 1.5, y);
      ctx.lineTo(x - r * 0.5, y);
      ctx.moveTo(x + r * 0.5, y);
      ctx.lineTo(x + r * 1.5, y);
      ctx.moveTo(x, y - r * 1.5);
      ctx.lineTo(x, y - r * 0.5);
      ctx.moveTo(x, y + r * 0.5);
      ctx.lineTo(x, y + r * 1.5);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, u * 0.003, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = p.color;
    ctx.textAlign = 'left';
    ctx.font = `700 ${u * 0.014}px Nunito, sans-serif`;
    ctx.fillText(`P${p.player}`, x + r * 1.1, y - r * 1.1);
  }
}

function pick(images: RangeImages | null, keys: RangeImageKey[], index: number): HTMLImageElement | null {
  if (!images) return null;
  const available = keys.map((k) => images[k]).filter((i): i is HTMLImageElement => !!i);
  if (available.length === 0) return null;
  return available[index % available.length];
}

function drawTarget(ctx: CanvasRenderingContext2D, t: Target, u: number, images: RangeImages | null): void {
  const x = t.x * u;
  const y = t.y * u;
  const r = t.r * u;
  if (t.dead) {
    if (t.deadT > 0.5) return;
    ctx.globalAlpha = 1 - t.deadT * 2;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 + t.deadT * 3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  switch (t.kind) {
    case 'balloon': {
      const img = pick(images, ['balloon1', 'balloon2', 'balloon3'], t.id);
      if (img) {
        drawSprite(ctx, img, x, y + r * 3.2, r * 4.4);
        return;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(x, y + r * 1.2);
      ctx.quadraticCurveTo(x + r * 0.4, y + r * 2.2, x, y + r * 3.2);
      ctx.stroke();
      const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, t.color);
      grad.addColorStop(1, t.color);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.15, y + r * 1.15);
      ctx.lineTo(x + r * 0.15, y + r * 1.15);
      ctx.lineTo(x, y + r * 1.35);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'clay': {
      if (images?.clay) {
        drawSprite(ctx, images.clay, x, y + r * 0.6, r * 1.2, t.vx > 0 ? 0.25 : -0.25);
        return;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.vx > 0 ? 0.25 : -0.25);
      ctx.fillStyle = '#bf360c';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.15, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffab91';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.05, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'can': {
      const img = t.hp < t.maxHp ? (images?.canDented ?? images?.can ?? null) : (images?.can ?? null);
      if (img) {
        drawSprite(ctx, img, x, y + r * 1.1, r * 2.2);
        return;
      }
      const w = r * 1.3;
      const h = r * 2.2;
      const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      grad.addColorStop(0, '#78909c');
      grad.addColorStop(0.4, '#eceff1');
      grad.addColorStop(1, '#78909c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, r * 0.15);
      ctx.fill();
      ctx.fillStyle = t.hp > 1 ? '#e53935' : '#8e24aa';
      ctx.fillRect(x - w / 2, y - h * 0.15, w, h * 0.3);
      ctx.fillStyle = '#546e7a';
      ctx.beginPath();
      ctx.ellipse(x, y - h / 2, w / 2, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'duck': {
      const d = t.dir;
      // duck-1/2/3 are colour variants, chosen per duck (wing flapping stays procedural without sprites)
      const img = pick(images, ['duck1', 'duck2', 'duck3'], t.id);
      if (img) {
        ctx.save();
        ctx.translate(x, y);
        if (d < 0) ctx.scale(-1, 1);
        drawSprite(ctx, img, 0, r * 1.1, r * 2.2);
        ctx.restore();
        return;
      }
      const flap = Math.sin(t.t * 14) * r * 0.5;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.2, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6d4c41';
      ctx.beginPath();
      ctx.moveTo(x - d * r * 0.2, y - r * 0.2);
      ctx.lineTo(x - d * r * 1.1, y - r * 0.6 - flap);
      ctx.lineTo(x - d * r * 0.9, y + r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(x + d * r * 1.0, y - r * 0.65, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.moveTo(x + d * r * 1.4, y - r * 0.75);
      ctx.lineTo(x + d * r * 2.0, y - r * 0.55);
      ctx.lineTo(x + d * r * 1.4, y - r * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x + d * r * 1.15, y - r * 0.75, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ufo': {
      const bob = Math.sin(t.t * 6) * r * 0.1;
      if (images?.ufo) {
        drawSprite(ctx, images.ufo, x, y + r * 0.9 + bob, r * 1.8);
        return;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 1.3, r * 1.2, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      const dome = ctx.createRadialGradient(x - r * 0.2, y - r * 0.6, r * 0.1, x, y - r * 0.3, r * 0.8);
      dome.addColorStop(0, 'rgba(200, 245, 255, 0.95)');
      dome.addColorStop(1, 'rgba(79, 195, 247, 0.6)');
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2 + bob, r * 0.7, Math.PI, 0);
      ctx.fill();
      const body = ctx.createLinearGradient(0, y - r * 0.5, 0, y + r * 0.5);
      body.addColorStop(0, '#eceff1');
      body.addColorStop(1, '#78909c');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(x, y + bob, r * 1.6, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = -2; i <= 2; i++) {
        const on = Math.floor(t.t * 8 + i) % 3 === 0;
        ctx.fillStyle = on ? '#ffeb3b' : '#f44336';
        ctx.beginPath();
        ctx.arc(x + i * r * 0.55, y + r * 0.2 + bob, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      // hit points
      for (let i = 0; i < t.maxHp; i++) {
        ctx.fillStyle = i < t.hp ? '#69f0ae' : 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(x + (i - (t.maxHp - 1) / 2) * r * 0.35, y - r * 1.15 + bob, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}
