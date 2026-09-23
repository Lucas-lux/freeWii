import { EYE_COLORS, HAIR_COLORS, SHIRTS, SKIN, type Mii } from './parts';

interface Geo {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  square: boolean;
}

function geo(m: Mii, u: number): Geo {
  switch (m.face) {
    case 1:
      return { cx: 50 * u, cy: 48 * u, rx: 27 * u, ry: 36 * u, square: false };
    case 2:
      return { cx: 50 * u, cy: 48 * u, rx: 30 * u, ry: 34 * u, square: true };
    case 3:
      return { cx: 50 * u, cy: 50 * u, rx: 26 * u, ry: 40 * u, square: false };
    default:
      return { cx: 50 * u, cy: 48 * u, rx: 30 * u, ry: 33 * u, square: false };
  }
}

function headPath(g: CanvasRenderingContext2D, h: Geo): void {
  g.beginPath();
  if (h.square) g.roundRect(h.cx - h.rx, h.cy - h.ry, h.rx * 2, h.ry * 2, h.rx * 0.55);
  else g.ellipse(h.cx, h.cy, h.rx, h.ry, 0, 0, Math.PI * 2);
}

/** Fills a region clipped to the head (used for hair caps and beards). */
function inHead(g: CanvasRenderingContext2D, h: Geo, color: string, x: number, y: number, w: number, hh: number): void {
  g.save();
  headPath(g, h);
  g.clip();
  g.fillStyle = color;
  g.fillRect(x, y, w, hh);
  g.restore();
}

function hairBack(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const c = HAIR_COLORS[m.hairColor];
  g.fillStyle = c;
  const top = h.cy - h.ry;
  if (m.hair === 3) {
    // bob: curtains down to the jaw
    g.beginPath();
    g.roundRect(h.cx - h.rx - 4 * u, top + 6 * u, h.rx * 2 + 8 * u, h.ry * 1.55, 10 * u);
    g.fill();
  } else if (m.hair === 4) {
    // long hair down to the shoulders
    g.beginPath();
    g.roundRect(h.cx - h.rx - 6 * u, top + 4 * u, h.rx * 2 + 12 * u, h.ry * 2 + 22 * u, 14 * u);
    g.fill();
  } else if (m.hair === 5) {
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.beginPath();
      g.arc(h.cx + Math.cos(a) * h.rx * 0.95, h.cy + Math.sin(a) * h.ry * 0.95, 9 * u, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function hairFront(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const c = HAIR_COLORS[m.hairColor];
  const top = h.cy - h.ry;
  g.fillStyle = c;
  switch (m.hair) {
    case 0:
      return;
    case 2: {
      inHead(g, h, c, 0, 0, 100 * u, h.cy - h.ry * 0.45);
      for (let i = 0; i < 6; i++) {
        const x = h.cx - h.rx * 0.8 + (i / 5) * h.rx * 1.6;
        g.beginPath();
        g.moveTo(x - 5 * u, top + 8 * u);
        g.lineTo(x + (i % 2 ? 3 : -2) * u, top - 12 * u);
        g.lineTo(x + 6 * u, top + 8 * u);
        g.closePath();
        g.fill();
      }
      return;
    }
    case 6:
      inHead(g, h, c, 0, 0, 100 * u, h.cy - h.ry * 0.5);
      g.beginPath();
      g.arc(h.cx, top - 3 * u, 9 * u, 0, Math.PI * 2);
      g.fill();
      return;
    case 7:
      g.beginPath();
      g.roundRect(h.cx - 6 * u, top - 16 * u, 12 * u, 20 * u, 4 * u);
      g.fill();
      inHead(g, h, c, h.cx - 6 * u, 0, 12 * u, h.cy - h.ry * 0.4);
      return;
    default:
      inHead(g, h, c, 0, 0, 100 * u, h.cy - h.ry * (m.hair === 4 || m.hair === 3 ? 0.55 : 0.45));
  }
}

function shirtAndNeck(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  g.fillStyle = SHIRTS[m.shirt];
  g.beginPath();
  g.roundRect(h.cx - 30 * u, h.cy + h.ry * 0.75 + 6 * u, 60 * u, 40 * u, 14 * u);
  g.fill();
  g.fillStyle = SKIN[m.skin];
  g.fillRect(h.cx - 8 * u, h.cy + h.ry * 0.7, 16 * u, 14 * u);
}

function ears(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  g.fillStyle = SKIN[m.skin];
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(h.cx + s * h.rx * 0.98, h.cy + h.ry * 0.02, 5.5 * u, 7 * u, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function eyes(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const y = h.cy - h.ry * 0.08, dx = h.rx * 0.4, iris = EYE_COLORS[m.eyeColor];
  const w = h.rx * 0.16, hh = h.rx * 0.19;
  for (const s of [-1, 1]) {
    const x = h.cx + s * dx;
    g.strokeStyle = '#222';
    g.lineWidth = 2.2 * u;
    g.lineCap = 'round';
    if (m.eyes === 2 || (m.eyes === 5 && s === 1)) {
      g.beginPath();
      g.arc(x, y + 2 * u, w, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      continue;
    }
    const big = m.eyes === 4 ? 1.35 : 1;
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(x, y, w * big, hh * big, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (m.eyes === 0) {
      g.fillStyle = '#222';
      g.beginPath();
      g.arc(x, y, 3.2 * u, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = iris;
      g.beginPath();
      g.arc(x, y + u, w * 0.55 * big, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(x, y + u, w * 0.28 * big, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x - w * 0.2, y - w * 0.15, w * 0.14, 0, Math.PI * 2);
      g.fill();
    }
    if (m.eyes === 3) {
      g.fillStyle = SKIN[m.skin];
      g.fillRect(x - w * 1.3, y - hh * 1.3, w * 2.6, hh * 1.1);
      g.beginPath();
      g.moveTo(x - w, y - hh * 0.2);
      g.lineTo(x + w, y - hh * 0.2);
      g.stroke();
    }
  }
}

function brows(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const y = h.cy - h.ry * 0.32, dx = h.rx * 0.4, w = h.rx * 0.2;
  g.strokeStyle = HAIR_COLORS[m.hairColor];
  g.lineCap = 'round';
  g.lineWidth = (m.brows === 3 ? 5.5 : 3) * u;
  for (const s of [-1, 1]) {
    const x = h.cx + s * dx;
    g.beginPath();
    if (m.brows === 1) {
      g.moveTo(x - s * w, y - 3 * u);
      g.lineTo(x + s * w, y + 3 * u);
    } else if (m.brows === 2) {
      g.moveTo(x - w, y + 2 * u);
      g.quadraticCurveTo(x, y - 6 * u, x + w, y + 2 * u);
    } else {
      g.moveTo(x - w, y);
      g.lineTo(x + w, y);
    }
    g.stroke();
  }
}

function nose(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const x = h.cx, y = h.cy + h.ry * 0.2;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2 * u;
  g.lineCap = 'round';
  g.beginPath();
  if (m.nose === 0) {
    g.arc(x, y, 2.5 * u, 0, Math.PI * 2);
    g.fill();
  } else if (m.nose === 1) {
    g.moveTo(x, y - 8 * u);
    g.lineTo(x - 5 * u, y + 3 * u);
    g.lineTo(x + 5 * u, y + 3 * u);
    g.closePath();
    g.fill();
  } else if (m.nose === 2) {
    g.arc(x, y, 5 * u, 0, Math.PI * 2);
    g.fill();
  } else {
    g.moveTo(x, y - 12 * u);
    g.lineTo(x + 2 * u, y + 2 * u);
    g.lineTo(x - 4 * u, y + 3 * u);
    g.stroke();
  }
}

function mouth(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const x = h.cx, y = h.cy + h.ry * 0.52, w = h.rx * 0.3;
  g.strokeStyle = '#7a1f1f';
  g.lineWidth = 2.6 * u;
  g.lineCap = 'round';
  g.beginPath();
  if (m.mouth === 0) g.arc(x, y - 4 * u, w, Math.PI * 0.15, Math.PI * 0.85);
  else if (m.mouth === 1) {
    g.fillStyle = '#7a1f1f';
    g.ellipse(x, y, w, w * 0.55, 0, 0, Math.PI);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(x - w * 0.7, y, w * 1.4, w * 0.22);
    return;
  } else if (m.mouth === 2) {
    g.moveTo(x - w * 0.7, y);
    g.lineTo(x + w * 0.7, y);
  } else if (m.mouth === 3) g.arc(x, y + 6 * u, w, Math.PI * 1.15, Math.PI * 1.85);
  else if (m.mouth === 4) {
    g.fillStyle = '#7a1f1f';
    g.ellipse(x, y, w * 0.4, w * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    return;
  } else {
    g.arc(x, y - 4 * u, w, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    g.fillStyle = '#f48fb1';
    g.beginPath();
    g.ellipse(x + w * 0.2, y + w * 0.45, w * 0.32, w * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  g.stroke();
}

function glasses(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  if (!m.glasses) return;
  const y = h.cy - h.ry * 0.08, dx = h.rx * 0.4, r = h.rx * 0.27;
  g.strokeStyle = '#37474f';
  g.lineWidth = 2.6 * u;
  g.fillStyle = m.glasses === 3 ? 'rgba(20,20,30,0.85)' : 'rgba(180,220,255,0.18)';
  for (const s of [-1, 1]) {
    const x = h.cx + s * dx;
    g.beginPath();
    if (m.glasses === 1) g.arc(x, y, r, 0, Math.PI * 2);
    else g.roundRect(x - r, y - r * 0.8, r * 2, r * 1.6, r * 0.3);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.moveTo(h.cx - dx + r, y);
  g.lineTo(h.cx + dx - r, y);
  g.moveTo(h.cx - dx - r, y);
  g.lineTo(h.cx - h.rx, y - 2 * u);
  g.moveTo(h.cx + dx + r, y);
  g.lineTo(h.cx + h.rx, y - 2 * u);
  g.stroke();
}

function extras(g: CanvasRenderingContext2D, m: Mii, h: Geo, u: number): void {
  const hc = HAIR_COLORS[m.hairColor];
  if (m.extra === 1) {
    g.fillStyle = hc;
    g.beginPath();
    g.ellipse(h.cx - h.rx * 0.2, h.cy + h.ry * 0.36, h.rx * 0.24, 4 * u, -0.25, 0, Math.PI * 2);
    g.ellipse(h.cx + h.rx * 0.2, h.cy + h.ry * 0.36, h.rx * 0.24, 4 * u, 0.25, 0, Math.PI * 2);
    g.fill();
  } else if (m.extra === 2) {
    inHead(g, h, hc, 0, h.cy + h.ry * 0.62, 100 * u, h.ry);
  } else if (m.extra === 3) {
    g.fillStyle = 'rgba(255,105,135,0.45)';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(h.cx + s * h.rx * 0.6, h.cy + h.ry * 0.25, 7 * u, 4 * u, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (m.extra === 4) {
    g.fillStyle = 'rgba(120,70,30,0.6)';
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(h.cx + s * (h.rx * 0.45 + (i % 3) * 5 * u), h.cy + h.ry * (0.2 + Math.floor(i / 3) * 0.08) + (i % 2) * 2 * u, 1.3 * u, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** Draws a Mii into a `size`×`size` square whose top-left is the current origin. */
export function drawMii(g: CanvasRenderingContext2D, m: Mii, size: number): void {
  const u = size / 100;
  const h = geo(m, u);
  g.save();
  shirtAndNeck(g, m, h, u);
  hairBack(g, m, h, u);
  ears(g, m, h, u);
  g.fillStyle = SKIN[m.skin];
  headPath(g, h);
  g.fill();
  extras(g, m, h, u);
  brows(g, m, h, u);
  eyes(g, m, h, u);
  nose(g, m, h, u);
  mouth(g, m, h, u);
  hairFront(g, m, h, u);
  glasses(g, m, h, u);
  g.restore();
}
