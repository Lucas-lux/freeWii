import type { BannerProps } from '../../core';

/** Confetti and bouncing party icons. */
export function PartyBanner({ active }: BannerProps) {
  return (
    <div className={`party-banner ${active ? 'party-banner--active' : ''}`}>
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} className="party-confetti" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-(i * 0.43) % 3}s`, background: ['#ffd740', '#ff5252', '#69f0ae', '#40c4ff', '#ea80fc'][i % 5] }} />
      ))}
      <div className="party-banner-icons">
        <span style={{ animationDelay: '0s' }}>🎉</span>
        <span style={{ animationDelay: '0.2s' }}>🔨</span>
        <span style={{ animationDelay: '0.4s' }}>🎈</span>
        <span style={{ animationDelay: '0.6s' }}>⚡</span>
      </div>
      <div className="party-banner-title">
        free<b>Party</b>
      </div>
      {active && <div className="party-banner-sub">Shake It! · Whack-a-Mole · Reflex · Balloon · Simon</div>}
    </div>
  );
}
