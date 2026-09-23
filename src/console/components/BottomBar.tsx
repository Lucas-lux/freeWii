import { useEffect, useState } from 'react';
import { useHot } from '../../core/hooks';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now);
  const date = `${DAYS[now.getDay()]} ${now.getMonth() + 1}/${now.getDate()}`;
  return { time, date };
}

/** The curved light bar at the bottom of the Wii Menu. */
export function BarShape() {
  return (
    <svg className="bar-shape" viewBox="0 0 1280 150" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fw-bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="1" stopColor="#e2e2e2" />
        </linearGradient>
      </defs>
      <path d="M0 30 Q640 -6 1280 30 L1280 150 L0 150 Z" fill="url(#fw-bar-grad)" stroke="#cdcdcd" strokeWidth="3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="#6c6c6c" strokeWidth="4" strokeLinejoin="round">
        <rect x="6" y="14" width="52" height="36" rx="6" fill="#fafafa" />
        <path d="M8 18 L32 36 L56 18" />
      </g>
    </svg>
  );
}

interface BottomBarProps {
  onWii(): void;
  onMail(): void;
  unread: number;
  hint?: string | null;
}

export function BottomBar({ onWii, onMail, unread, hint }: BottomBarProps) {
  const wiiHot = useHot<HTMLDivElement>({ onClick: onWii, clickSound: 'open' });
  const mailHot = useHot<HTMLDivElement>({ onClick: onMail, clickSound: 'open' });
  const { time, date } = useClock();
  return (
    <div className="bar">
      <BarShape />
      <div ref={wiiHot.ref} className={`bar-btn bar-btn--wii ${wiiHot.hovered ? 'bar-btn--hover' : ''}`}>
        Wii
      </div>
      <div className="bar-clock">
        <div className="bar-clock-time">{time}</div>
        <div className="bar-clock-date">{date}</div>
      </div>
      <div ref={mailHot.ref} className={`bar-btn bar-btn--mail ${mailHot.hovered ? 'bar-btn--hover' : ''}`}>
        <MailIcon />
        {unread > 0 && <span className="bar-badge">{unread}</span>}
      </div>
      {hint && <div className="bar-hint">{hint}</div>}
    </div>
  );
}
