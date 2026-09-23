import { useEffect, useState } from 'react';
import { useButton, useHostState, useHot } from '../../core/hooks';
import { input } from '../../core/input/InputManager';
import { wii } from '../../core/wii';
import { QrCode } from '../components/QrCode';

/** The classic black warning screen. It doubles as the user gesture browsers need before playing audio. */
export function HealthSafety() {
  const host = useHostState();
  const [showPress, setShowPress] = useState(false);
  const { ref } = useHot<HTMLDivElement>({ onClick: () => wii.finishBoot(), hoverSound: null, clickSound: null });
  useButton('a', () => wii.finishBoot());

  useEffect(() => {
    const t = window.setTimeout(() => setShowPress(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const url = input.host.remoteUrl;

  return (
    <div ref={ref} className="fill boot">
      <div className="boot-title">⚠ WARNING – HEALTH AND SAFETY</div>
      <div className="boot-text">
        BEFORE PLAYING, MAKE SURE THE AREA AROUND YOU IS CLEAR.
        <br />
        Hold your phone firmly when swinging it and keep it away from people, pets and screens.
        <br />
        Take a 10 to 15 minute break every hour, even if you don't think you need it.
      </div>
      {showPress && (
        <div className="boot-press">
          Press <span className="a-btn">A</span> to continue.
        </div>
      )}
      {host.status === 'ready' && (
        <div className="boot-remote">
          <QrCode text={url} size={168} />
          <div>
            Phone remote
            <br />
            {url.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}
            <br />
            <strong>{host.code}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
