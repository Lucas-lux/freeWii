import type { BannerProps } from '../../core';

/** Piano keys with notes bouncing out of them. */
export function MusicBanner({ active }: BannerProps) {
  return (
    <div className={`music-banner ${active ? 'music-banner--active' : ''}`}>
      <div className="music-banner-notes">
        {['♪', '♫', '♪', '♬', '♪'].map((n, i) => (
          <span key={i} style={{ left: `${10 + i * 18}%`, animationDelay: `${-i * 0.5}s` }}>
            {n}
          </span>
        ))}
      </div>
      <div className="music-banner-keys">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={[1, 2, 4, 5, 6].includes(i % 7) ? 'music-banner-key music-banner-key--sharp' : 'music-banner-key'} style={{ animationDelay: `${(i * 0.37) % 2}s` }} />
        ))}
      </div>
      <div className="music-banner-title">
        free<b>Music</b>
      </div>
      {active && <div className="music-banner-sub">Piano · Synth · Drums · follow the lights</div>}
    </div>
  );
}
