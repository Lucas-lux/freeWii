import type { ReactNode } from 'react';
import { audio } from '../../core/audio/AudioEngine';
import { useAudioState, useHostState, useRemotes } from '../../core/hooks';
import { input } from '../../core/input/InputManager';
import { settings, updateSettings, type Settings } from '../../core/settings';
import { useStore } from '../../core/store';
import { Pill } from '../components/Pill';
import { QrCode } from '../components/QrCode';

export function RemotePage() {
  const host = useHostState();
  const remotes = useRemotes();
  const url = input.host.remoteUrl;
  return (
    <div className="pairing">
      <div className="card pairing-qr">
        <QrCode text={url} size={420} />
        <div className="pairing-code">{host.code}</div>
        <div className="pairing-url">{url}</div>
      </div>
      <div className="card" style={{ flex: 1 }}>
        <h3>How to connect your phone</h3>
        <p>1. Scan the QR code, or open the address on your phone. Same Wi-Fi network works best.</p>
        <p>2. Enter the code, tap Connect, and allow motion sensors when the phone asks.</p>
        <p>3. Point the phone at the screen and tap the target button to centre the cursor. Tap it again whenever the cursor drifts.</p>
        <h3>Connected remotes</h3>
        <ul className="remote-list">
          {remotes.map((r) => {
            const isLocal = r.kind !== 'phone';
            const spectator = isLocal && !input.isLocalAsPlayer;
            return (
              <li key={r.id} className={spectator ? 'remote-row--off' : ''}>
                <span className="leds">
                  {[1, 2, 3, 4].map((i) => (
                    <i key={i} className={`led ${!spectator && i === r.player ? 'led--on' : ''}`} />
                  ))}
                </span>
                {spectator ? '—' : `P${r.player}`} · {r.name}
                <span className="muted">
                  {r.kind === 'phone'
                    ? `phone · ${'latencyMs' in r ? (r as { latencyMs: number }).latencyMs : 0} ms`
                    : spectator
                      ? 'mouse & keyboard · not a player'
                      : 'mouse & keyboard'}
                </span>
                <span className="remote-row-actions">
                  {spectator ? (
                    <Pill small clickSound="connect" onClick={() => updateSettings({ localAsPlayer: true })}>
                      Add player
                    </Pill>
                  ) : (
                    <Pill
                      small
                      clickSound="disconnect"
                      onClick={() => {
                        if (isLocal) updateSettings({ localAsPlayer: false });
                        else input.remove(r);
                      }}
                    >
                      ✕ Remove
                    </Pill>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {host.status !== 'ready' && (
          <p style={{ marginTop: '1em', color: '#b5602c' }}>
            Signaling: {host.status}
            {host.error ? ` (${host.error})` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <span className="setting-controls">{children}</span>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pill small onClick={() => onChange(!value)} style={{ minWidth: 'calc(110 * var(--px))' }}>
      {value ? 'On' : 'Off'}
    </Pill>
  );
}

function Stepper({
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 100) / 100);
  return (
    <>
      <Pill small onClick={() => set(value - step)} disabled={value <= min}>
        –
      </Pill>
      <span className="setting-value">{format(value)}</span>
      <Pill small onClick={() => set(value + step)} disabled={value >= max}>
        +
      </Pill>
    </>
  );
}

export function SettingsPage() {
  const s = useStore(settings);
  const a = useAudioState();
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  return (
    <div className="card" style={{ flex: 1 }}>
      <Row label="Menu music">
        <Toggle value={s.musicEnabled} onChange={(v) => set({ musicEnabled: v })} />
      </Row>
      <Row label="Sound effects">
        <Toggle value={s.sfxEnabled} onChange={(v) => set({ sfxEnabled: v })} />
      </Row>
      <Row label="Volume">
        <Stepper value={s.volume} min={0} max={1} step={0.1} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ volume: v })} />
      </Row>
      <Row label="Pointer sensitivity">
        <Stepper value={s.sensitivity} min={0.5} max={2} step={0.1} format={(v) => `×${v.toFixed(1)}`} onChange={(v) => set({ sensitivity: v })} />
      </Row>
      <Row label="Mouse & keyboard count as a player">
        <Toggle value={s.localAsPlayer} onChange={(v) => set({ localAsPlayer: v })} />
      </Row>
      <Row label="Show tips">
        <Toggle value={s.showHints} onChange={(v) => set({ showHints: v })} />
      </Row>
      <p style={{ marginTop: '1em' }}>
        Menu theme: {a.themeSource === 'file' ? 'public/assets/system/music/menu-theme.mp3' : 'built-in synthesized theme'}
        {!audio.unlocked ? ' (click the screen once to enable audio)' : ''}. Drop your own file in public/assets/system/music/ to replace it.
      </p>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="card" style={{ flex: 1 }}>
      <h3>freeWii</h3>
      <p>An open-source, browser-based console inspired by the Wii Menu. Your phone is the remote, every game runs locally in the browser.</p>
      <p>Add your own channel: create a folder in src/channels/ with a channel.tsx that default-exports defineChannel(...). It shows up in the menu automatically.</p>
      <p>freeWii is a fan project and is not affiliated with or endorsed by Nintendo. No Nintendo assets are included: music and sound effects are synthesized live.</p>
      <p>Keyboard fallback: mouse = pointer, left click = A, right click = B, Esc = HOME, arrows = D-pad, S = swing.</p>
    </div>
  );
}
