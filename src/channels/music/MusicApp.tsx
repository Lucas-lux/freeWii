import { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS, Pill, useHot, useInputEvent, type ChannelContext, type Wiimote } from '../../core';
import { BEAT, DRUMS, INSTRUMENTS, SONGS, playDrum, playNote, type DrumId, type InstrumentId } from './instruments';

const LOW = 60; // C4
const BLACK = new Set([1, 3, 6, 8, 10]);
const KEYS = Array.from({ length: 24 }, (_, i) => LOW + i);
const WHITE_KEYS = KEYS.filter((m) => !BLACK.has(m % 12));
const BPM = 100;

/** Left edge of a black key as a fraction of the keyboard width (it straddles two white keys). */
function blackLeft(midi: number): number {
  const whiteBefore = WHITE_KEYS.filter((w) => w < midi).length;
  return whiteBefore / WHITE_KEYS.length - 0.31 / WHITE_KEYS.length;
}

const colorOf = (r: Wiimote) => PLAYER_COLORS[(r.player - 1 + 4) % 4];

function flash(el: HTMLElement | null, color: string): void {
  if (!el) return;
  el.style.background = color;
  window.setTimeout(() => {
    el.style.background = '';
  }, 160);
}

function Key({ midi, next, onPlay }: { midi: number; next: boolean; onPlay(midi: number, r: Wiimote, el: HTMLElement): void }) {
  const black = BLACK.has(midi % 12);
  const { ref, hovered } = useHot<HTMLDivElement>({
    onClick: (r) => ref.current && onPlay(midi, r, ref.current),
    onEnter: (r) => {
      if (r.buttons.a && ref.current) onPlay(midi, r, ref.current);
    },
    hoverSound: null,
    clickSound: null,
  });
  const cls = ['music-key', black ? 'music-key--black' : '', hovered ? 'music-key--hover' : '', next ? 'music-key--next' : ''].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={cls} style={black ? { left: `${blackLeft(midi) * 100}%` } : undefined}>
      {!black && midi % 12 === 0 ? `C${midi / 12 - 1}` : ''}
    </div>
  );
}

function Pad({
  drum,
  hover,
  onHit,
  register,
}: {
  drum: (typeof DRUMS)[number];
  hover: Map<string, DrumId>;
  onHit(id: DrumId, r: Wiimote): void;
  register(el: HTMLDivElement | null): void;
}) {
  const { ref, hovered } = useHot<HTMLDivElement>({
    onClick: (r) => onHit(drum.id, r),
    onEnter: (r) => {
      hover.set(r.id, drum.id);
      if (r.buttons.a) onHit(drum.id, r);
    },
    onLeave: (r) => {
      if (hover.get(r.id) === drum.id) hover.delete(r.id);
    },
    hoverSound: null,
    clickSound: null,
  });
  return (
    <div
      ref={(el) => {
        (ref as { current: HTMLDivElement | null }).current = el;
        register(el);
      }}
      className={`music-pad ${hovered ? 'music-pad--hover' : ''}`}
      style={{ background: drum.color }}
    >
      <span>{drum.icon}</span>
      {drum.name}
    </div>
  );
}

/** Keyboard + drum pads: every remote plays at once. */
export function MusicApp({ ctx }: { ctx: ChannelContext }) {
  const [inst, setInst] = useState<InstrumentId>('piano');
  const [beat, setBeat] = useState(false);
  const [song, setSong] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [toast, setToast] = useState('');
  const posRef = useRef(0);
  posRef.current = pos;
  const songRef = useRef(song);
  songRef.current = song;
  const instRef = useRef(inst);
  instRef.current = inst;
  const hover = useRef(new Map<string, DrumId>());
  const padEls = useRef(new Map<DrumId, HTMLDivElement>());

  // the instrument is the music here
  useEffect(() => ctx.audio.stopMusic(0.6), [ctx]);

  useEffect(() => {
    if (!beat) return;
    let step = 0;
    const id = window.setInterval(() => {
      for (const d of DRUMS) {
        if (!BEAT[d.id].includes(step)) continue;
        playDrum(ctx.audio, d.id);
        const el = padEls.current.get(d.id);
        if (el) {
          el.classList.add('music-pad--hit');
          window.setTimeout(() => el.classList.remove('music-pad--hit'), 90);
        }
      }
      step = (step + 1) % 16;
    }, 60000 / BPM / 4);
    return () => window.clearInterval(id);
  }, [beat, ctx]);

  const play = (midi: number, r: Wiimote, el: HTMLElement) => {
    playNote(ctx.audio, instRef.current, midi);
    flash(el, colorOf(r));
    const s = SONGS.find((x) => x.id === songRef.current);
    if (!s || s.notes[posRef.current] !== midi) return;
    const n = posRef.current + 1;
    if (n >= s.notes.length) {
      setPos(0);
      setToast('🎉 Bravo!');
      ctx.audio.play('cheer');
      window.setTimeout(() => setToast(''), 2200);
    } else setPos(n);
  };

  const hit = (id: DrumId, r: Wiimote) => {
    playDrum(ctx.audio, id);
    const el = padEls.current.get(id);
    if (!el) return;
    el.style.borderColor = colorOf(r);
    el.classList.add('music-pad--hit');
    window.setTimeout(() => {
      el.classList.remove('music-pad--hit');
      el.style.borderColor = '';
    }, 120);
  };

  useInputEvent('swing', ({ remote, swing }) => hit(hover.current.get(remote.id) ?? (swing.strength > 0.5 ? 'kick' : 'snare'), remote));

  const current = SONGS.find((x) => x.id === song);
  const nextMidi = current?.notes[pos];
  return (
    <div className="music">
      <div className="music-bar">
        <span className="music-bar-title">
          free<b>Music</b>
        </span>
        {INSTRUMENTS.map((i) => (
          <Pill key={i.id} small className={inst === i.id ? 'pill--on' : ''} onClick={() => setInst(i.id)} clickSound="tick">
            {i.icon} {i.name}
          </Pill>
        ))}
        <span className="music-bar-gap" />
        <Pill small className={beat ? 'pill--on' : ''} onClick={() => setBeat((b) => !b)} clickSound="tick">
          🥁 Beat {beat ? 'on' : 'off'}
        </Pill>
        <Pill small onClick={() => ctx.exit()} clickSound="back">
          Wii Menu
        </Pill>
      </div>
      <div className="music-bar">
        <span>Follow the lights:</span>
        <Pill
          small
          className={!song ? 'pill--on' : ''}
          onClick={() => {
            setSong(null);
            setPos(0);
          }}
          clickSound="tick"
        >
          Free play
        </Pill>
        {SONGS.map((s) => (
          <Pill
            key={s.id}
            small
            className={song === s.id ? 'pill--on' : ''}
            onClick={() => {
              setSong(s.id);
              setPos(0);
            }}
            clickSound="tick"
          >
            {s.name}
          </Pill>
        ))}
        {current && (
          <span>
            note {pos + 1} / {current.notes.length}
          </span>
        )}
      </div>
      <div className="music-pads">
        {DRUMS.map((d) => (
          <Pad
            key={d.id}
            drum={d}
            hover={hover.current}
            onHit={hit}
            register={(el) => {
              if (el) padEls.current.set(d.id, el);
              else padEls.current.delete(d.id);
            }}
          />
        ))}
      </div>
      <div className="music-keys">
        {KEYS.map((m) => (
          <Key key={m} midi={m} next={m === nextMidi} onPlay={play} />
        ))}
      </div>
      {toast && <div className="music-toast">{toast}</div>}
      <div className="music-hint">Point at a key and press A · hold A and slide for a glissando · swing over a pad, or anywhere: hard swing = kick, soft = snare</div>
    </div>
  );
}
