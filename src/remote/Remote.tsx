import { useEffect, useRef, useState } from 'react';
import { CODE_LENGTH, normalizeCode } from '../core/input/messages';
import { BUTTON_BIT, type WiiButton } from '../core/input/types';
import { RemoteClient, type ClientState } from './RemoteClient';
import { RemotePad } from './RemotePad';
import { Sensors, requestSensorPermission, type SensorPermission } from './sensors';
import '../styles/remote.css';

type WakeLockNavigator = Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };

/** The phone page: connect with the code, then the Wii Remote pad. */
export default function Remote() {
  const [client] = useState(() => new RemoteClient());
  const [sensors] = useState(() => new Sensors());
  const [code, setCode] = useState(() =>
    normalizeCode(new URLSearchParams(window.location.search).get('c') ?? sessionStorage.getItem('freewii.remote.code') ?? ''),
  );
  const [name, setName] = useState(() => localStorage.getItem('freewii.remote.name') ?? '');
  const [state, setState] = useState<ClientState>({ status: 'idle' });
  const [player, setPlayer] = useState(0);
  const [perm, setPerm] = useState<SensorPermission | 'pending'>('pending');
  const mask = useRef(0);

  useEffect(() => {
    document.title = 'freeWii Remote';
    const offs = [
      client.on('status', setState),
      client.on('player', ({ player }) => setPlayer(player)),
      client.on('rumble', ({ ms }) => navigator.vibrate?.(ms)),
    ];
    return () => {
      offs.forEach((off) => off());
      client.disconnect();
    };
  }, [client]);

  useEffect(() => {
    if (state.status !== 'connected') return;
    sensors.start();
    const timer = window.setInterval(() => client.sendState(mask.current, sensors), 20);
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as WakeLockNavigator;
    const acquire = () => {
      nav.wakeLock
        ?.request('screen')
        .then((l) => {
          lock = l;
        })
        .catch(() => {});
    };
    acquire();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      sensors.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release().catch(() => {});
    };
  }, [state.status, client, sensors]);

  const connect = async () => {
    const c = normalizeCode(code);
    if (c.length !== CODE_LENGTH) {
      setState({ status: 'error', message: `Enter the ${CODE_LENGTH}-character code shown on the console.` });
      return;
    }
    // Must run inside the tap handler for iOS to show the motion permission prompt.
    setPerm(await requestSensorPermission());
    localStorage.setItem('freewii.remote.name', name);
    sessionStorage.setItem('freewii.remote.code', c);
    mask.current = 0;
    client.connect(c, name.trim() || 'Wii Remote');
  };

  const press = (k: WiiButton, down: boolean) => {
    const bit = BUTTON_BIT[k];
    mask.current = down ? mask.current | bit : mask.current & ~bit;
    client.sendButton(k, down);
    if (down) navigator.vibrate?.(10);
  };

  if (state.status === 'connected') {
    return (
      <RemotePad
        player={player}
        name={name}
        sensors={sensors}
        perm={perm}
        onPress={press}
        onRecenter={() => client.recenter()}
        onDisconnect={() => client.disconnect()}
      />
    );
  }

  const busy = state.status === 'connecting';
  return (
    <div className="rc-connect">
      <h1>
        freeWii <span>Remote</span>
      </h1>
      <p>Enter the code shown on the console (bottom-right of the warning screen, or Wii button › Wii Remote).</p>
      <input
        className="rc-code"
        value={code}
        onChange={(e) => setCode(normalizeCode(e.target.value))}
        maxLength={CODE_LENGTH}
        placeholder="ABCD"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        disabled={busy}
      />
      <input
        className="rc-name"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 16))}
        placeholder="Your name (optional)"
        autoComplete="nickname"
        disabled={busy}
      />
      <button className="rc-connect-btn" onClick={connect} disabled={busy}>
        {busy ? 'Connecting…' : 'Connect'}
      </button>
      {state.message && <p className={`rc-msg ${state.status === 'error' ? 'rc-msg--error' : ''}`}>{state.message}</p>}
      <p className="rc-help">
        Keep the phone and the computer on the same Wi-Fi. On iPhone, tap “Allow” when asked for motion access.
        Hold the phone like a Wii Remote, top edge towards the screen.
      </p>
    </div>
  );
}
