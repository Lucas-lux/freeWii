import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { WiiButton } from '../core/input/types';
import type { SensorPermission, Sensors } from './sensors';

interface PadButtonProps {
  k: WiiButton;
  label: string;
  className?: string;
  onPress(k: WiiButton, down: boolean): void;
}

/** Multi-touch friendly button: each pointer is captured, so several buttons can be held at once. */
function PadButton({ k, label, className = '', onPress }: PadButtonProps) {
  const [down, setDown] = useState(false);
  const held = useRef(false);
  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!held.current) {
      held.current = true;
      setDown(true);
      onPress(k, true);
    }
  };
  const end = () => {
    if (held.current) {
      held.current = false;
      setDown(false);
      onPress(k, false);
    }
  };
  return (
    <div
      className={`rc-btn ${className} ${down ? 'rc-btn--down' : ''}`}
      onPointerDown={start}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </div>
  );
}

interface RemotePadProps {
  player: number;
  name: string;
  sensors: Sensors;
  perm: SensorPermission | 'pending';
  onPress(k: WiiButton, down: boolean): void;
  onRecenter(): void;
  onDisconnect(): void;
}

export function RemotePad({ player, name, sensors, perm, onPress, onRecenter, onDisconnect }: RemotePadProps) {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      if (sensors.orientationCount > 0) {
        setWarning(null);
        return;
      }
      if (perm === 'denied') {
        setWarning('Motion access was denied. Reload and tap “Allow”, or enable Settings › Safari › Motion & Orientation Access.');
      } else if (!window.isSecureContext) {
        setWarning('Motion sensors need HTTPS. Open the console over https:// (in development: npm run dev:https).');
      } else {
        setWarning('No gyroscope data yet: the pointer will not move. Buttons still work. Try another browser if it persists.');
      }
    };
    const first = window.setTimeout(check, 2500);
    const poll = window.setInterval(check, 1500);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
    };
  }, [sensors, perm]);

  const fullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  return (
    <div className="rc">
      <div className="rc-body">
        <div className="rc-head">
          <span className="rc-power" />
          <span>{name || 'Wii Remote'}</span>
          <span className="rc-player">P{player || '?'}</span>
        </div>
        <div className="rc-dpad">
          <PadButton k="up" label="▲" className="rc-up" onPress={onPress} />
          <PadButton k="left" label="◀" className="rc-left" onPress={onPress} />
          <div className="rc-btn rc-dpad-center" />
          <PadButton k="right" label="▶" className="rc-right" onPress={onPress} />
          <PadButton k="down" label="▼" className="rc-down" onPress={onPress} />
        </div>
        <PadButton k="a" label="A" className="rc-a" onPress={onPress} />
        <div className="rc-row">
          <PadButton k="minus" label="–" className="rc-small" onPress={onPress} />
          <PadButton k="home" label="⌂" className="rc-small rc-home" onPress={onPress} />
          <PadButton k="plus" label="+" className="rc-small" onPress={onPress} />
        </div>
        <PadButton k="b" label="B" className="rc-b" onPress={onPress} />
        <div className="rc-row">
          <PadButton k="one" label="1" className="rc-small" onPress={onPress} />
          <PadButton k="two" label="2" className="rc-small" onPress={onPress} />
        </div>
        <div className="rc-leds">
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={`rc-led ${i === player ? 'rc-led--on' : ''}`} />
          ))}
        </div>
      </div>
      <div className="rc-tools">
        <button onClick={onRecenter}>⌖ Centre pointer</button>
        <button onClick={fullscreen} aria-label="Full screen">
          ⛶
        </button>
        <button onClick={onDisconnect} aria-label="Disconnect">
          ✕
        </button>
      </div>
      {warning && <div className="rc-warn">{warning}</div>}
    </div>
  );
}
