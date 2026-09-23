import type { BannerProps } from '../../core';

/** Animated tile: CSS only, sized with container query units (1cqw = 1% of the banner width). */
export function SportsBanner({ active }: BannerProps) {
  return (
    <div className={`sports-banner ${active ? 'sports-banner--active' : ''}`}>
      <div className="sports-banner-sun" />
      <div className="sports-banner-shadow" />
      <div className="sports-banner-ball" />
      <div className="sports-banner-title">
        free<b>Sports</b>
      </div>
      {active && <div className="sports-banner-sub">Bowling · Tennis · Golf · Baseball · Boxing</div>}
    </div>
  );
}
