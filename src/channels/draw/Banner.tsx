import type { BannerProps } from '../../core';

/** A sheet of paper with crayon strokes that draw themselves. */
export function DrawBanner({ active }: BannerProps) {
  return (
    <div className={`draw-banner ${active ? 'draw-banner--active' : ''}`}>
      <svg className="draw-banner-art" viewBox="0 0 160 90" aria-hidden="true">
        <path className="draw-stroke draw-stroke--1" d="M14 62 C 30 20, 50 20, 62 58 S 92 90, 104 40" />
        <path className="draw-stroke draw-stroke--2" d="M96 28 c 12 -14, 34 -10, 36 8 s -18 26, -34 12 s 2 -30, 26 -22" />
        <path className="draw-stroke draw-stroke--3" d="M20 24 l 14 0 M27 17 l 0 14" />
        <circle className="draw-stroke draw-stroke--4" cx="130" cy="66" r="9" />
      </svg>
      <div className="draw-banner-crayon" />
      <div className="draw-banner-title">
        free<b>Draw</b>
      </div>
      {active && <div className="draw-banner-sub">Hold A to draw · B to erase · every remote is a crayon</div>}
    </div>
  );
}
