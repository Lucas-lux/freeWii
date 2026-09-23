import type { BannerProps } from '../../core';

export function PlayBanner({ active }: BannerProps) {
  return (
    <div className={`play-banner ${active ? 'play-banner--active' : ''}`}>
      <div className="play-banner-balloon play-banner-balloon--1" />
      <div className="play-banner-balloon play-banner-balloon--2" />
      <div className="play-banner-balloon play-banner-balloon--3" />
      <div className="play-banner-target" />
      <div className="play-banner-title">
        free<b>Play</b>
      </div>
      {active && <div className="play-banner-sub">Target Range · Ping Pong · Air Hockey · Tank Battle</div>}
    </div>
  );
}
