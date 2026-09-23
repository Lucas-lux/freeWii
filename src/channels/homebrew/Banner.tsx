import type { BannerProps } from '../../core';

/** Dark water and rising bubbles, the way the old homebrew launcher looked. */
export function Bubbles() {
  return (
    <div className="hb-bubbles" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 61) % 100}%`, width: `${2 + (i % 4) * 1.4}cqw`, height: `${2 + (i % 4) * 1.4}cqw`, animationDuration: `${6 + (i % 5) * 1.7}s`, animationDelay: `${-(i * 1.3) % 8}s` }} />
      ))}
    </div>
  );
}

export function HomebrewBanner({ active }: BannerProps) {
  return (
    <div className={`hb-banner ${active ? 'hb-banner--active' : ''}`}>
      <Bubbles />
      <div className="hb-banner-title">
        Homebrew <b>Channel</b>
      </div>
      {active && <div className="hb-banner-sub">Unlocked by LetterBomb · Brick Breaker inside</div>}
    </div>
  );
}
