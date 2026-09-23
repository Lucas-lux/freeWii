import type { BannerProps } from '../../core';

/** Two ballot bars racing each other. */
export function VoteBanner({ active }: BannerProps) {
  return (
    <div className={`vote-banner ${active ? 'vote-banner--active' : ''}`}>
      <div className="vote-banner-bars">
        <div className="vote-banner-bar vote-banner-bar--a">
          <span>Cats</span>
        </div>
        <div className="vote-banner-bar vote-banner-bar--b">
          <span>Dogs</span>
        </div>
      </div>
      <div className="vote-banner-check">✓</div>
      <div className="vote-banner-title">
        free<b>Vote</b>
      </div>
      {active && <div className="vote-banner-sub">Everybody votes · then predict the crowd</div>}
    </div>
  );
}
