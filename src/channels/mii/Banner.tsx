import { useEffect, useRef } from 'react';
import type { BannerProps } from '../../core';
import { drawMii } from './miiDraw';
import { DEFAULT_MII, randomMii, type Mii } from './parts';

/** A crowd of random faces looking at you. */
export function MiiBanner({ active }: BannerProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const crowd = useRef<Mii[] | null>(null);
  if (!crowd.current) crowd.current = [DEFAULT_MII, ...Array.from({ length: 5 }, randomMii)];

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    c.width = 960;
    c.height = 540;
    g.clearRect(0, 0, c.width, c.height);
    crowd.current!.forEach((m, i) => {
      g.save();
      g.translate(60 + i * 150, i % 2 ? 40 : 110);
      drawMii(g, m, 240);
      g.restore();
    });
  }, []);

  return (
    <div className={`mii-banner ${active ? 'mii-banner--active' : ''}`}>
      <canvas ref={ref} className="mii-banner-crowd" />
      <div className="mii-banner-title">
        free<b>Mii</b>
      </div>
      {active && <div className="mii-banner-sub">Make faces · keep them in your Plaza</div>}
    </div>
  );
}
