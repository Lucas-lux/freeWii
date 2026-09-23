import { useEffect, useRef, useState } from 'react';
import { Pill, useButton, useHot, type ChannelContext, type MusicRequest, type Wiimote } from '../../core';
import { drawMii } from './miiDraw';
import { CATEGORIES, COLORS, COUNTS, DEFAULT_MII, loadPlaza, randomMii, savePlaza, type CategoryKey, type ColorKey, type Mii, type PartKey } from './parts';

const MUSIC: MusicRequest = { url: '/assets/mii/music/plaza.mp3', synth: 'menu', fade: 0.8 };
const isColor = (k: CategoryKey): k is ColorKey => k in COLORS;

/** A face rendered into a canvas; redrawn whenever the Mii changes. */
function MiiThumb({ mii, px }: { mii: Mii; px: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    c.width = px;
    c.height = px;
    g.clearRect(0, 0, px, px);
    drawMii(g, mii, px);
  }, [mii, px]);
  return <canvas ref={ref} />;
}

function Category({ cat, active, onPick }: { cat: (typeof CATEGORIES)[number]; active: boolean; onPick(r: Wiimote): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, clickSound: 'tick' });
  return (
    <div ref={ref} className={`mii-cat ${hovered ? 'mii-cat--hover' : ''} ${active ? 'mii-cat--active' : ''}`}>
      <span>{cat.icon}</span>
      {cat.name}
    </div>
  );
}

function PartOption({ mii, active, onPick }: { mii: Mii; active: boolean; onPick(r: Wiimote): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, hoverSound: null, clickSound: 'tick' });
  return (
    <div ref={ref} className={`mii-option ${hovered ? 'mii-option--hover' : ''} ${active ? 'mii-option--active' : ''}`}>
      <MiiThumb mii={mii} px={160} />
    </div>
  );
}

function SwatchOption({ color, active, onPick }: { color: string; active: boolean; onPick(r: Wiimote): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, hoverSound: null, clickSound: 'tick' });
  return <div ref={ref} className={`mii-option mii-option--swatch ${hovered ? 'mii-option--hover' : ''} ${active ? 'mii-option--active' : ''}`} style={{ background: color }} />;
}

function PlazaItem({ mii, active, onPick }: { mii: Mii; active: boolean; onPick(r: Wiimote): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, clickSound: 'select' });
  return (
    <div ref={ref} className={`mii-plaza-item ${hovered ? 'mii-plaza-item--hover' : ''} ${active ? 'mii-plaza-item--active' : ''}`}>
      <MiiThumb mii={mii} px={120} />
    </div>
  );
}

/** The editor: categories on the left, the face in the middle, options on the right, Plaza below. */
export function MiiApp({ ctx }: { ctx: ChannelContext }) {
  const [mii, setMii] = useState<Mii>(() => ({ ...DEFAULT_MII }));
  const [cat, setCat] = useState<CategoryKey>('hair');
  const [plaza, setPlaza] = useState<Mii[]>(() => loadPlaza());
  const [loaded, setLoaded] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    ctx.audio.playMusic(MUSIC);
    return () => window.clearTimeout(toastTimer.current);
  }, [ctx]);

  useEffect(() => {
    const c = previewRef.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    c.width = 512;
    c.height = 512;
    g.clearRect(0, 0, 512, 512);
    drawMii(g, mii, 512);
  }, [mii]);

  const say = (text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1600);
  };

  const set = (key: CategoryKey, value: number) => {
    setMii((m) => ({ ...m, [key]: value }));
  };

  const save = () => {
    const next = [...plaza];
    const entry = { ...mii, name: mii.name || `Mii ${next.length + 1}` };
    if (loaded !== null && next[loaded]) next[loaded] = entry;
    else {
      next.unshift(entry);
      setLoaded(0);
    }
    setPlaza(next);
    savePlaza(next);
    ctx.audio.play('success');
    say(loaded !== null ? 'Mii updated' : 'Saved to the Plaza');
    ctx.messageBoard.post({ from: 'freeMii', title: 'A new face in the Plaza', body: `${entry.name} joined the Mii Plaza.` });
  };

  const remove = () => {
    if (loaded === null) return;
    const next = plaza.filter((_, i) => i !== loaded);
    setPlaza(next);
    savePlaza(next);
    setLoaded(null);
    ctx.audio.play('back');
    say('Removed from the Plaza');
  };

  const exportPng = () => {
    const c = previewRef.current;
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = `${mii.name || 'mii'}.png`;
    a.click();
    ctx.audio.play('success');
    say('PNG saved to your downloads');
  };

  const shuffle = () => {
    setMii((m) => ({ ...randomMii(), name: m.name }));
    setLoaded(null);
    ctx.audio.play('sweep');
  };

  useButton(['left', 'right'], (_, b) => {
    const max = isColor(cat) ? COLORS[cat].length : COUNTS[cat as PartKey];
    const cur = mii[cat] as number;
    set(cat, (cur + (b === 'right' ? 1 : max - 1)) % max);
    ctx.audio.play('tick');
  });
  useButton(['up', 'down'], (_, b) => {
    const i = CATEGORIES.findIndex((c) => c.id === cat);
    setCat(CATEGORIES[(i + (b === 'down' ? 1 : CATEGORIES.length - 1)) % CATEGORIES.length].id);
    ctx.audio.play('tick');
  });

  const catDef = CATEGORIES.find((c) => c.id === cat)!;
  return (
    <div className="mii">
      <div className="mii-cats">
        {CATEGORIES.map((c) => (
          <Category key={c.id} cat={c} active={c.id === cat} onPick={() => setCat(c.id)} />
        ))}
      </div>
      <div className="mii-preview">
        <canvas ref={previewRef} />
        <div className="mii-preview-name">{loaded !== null ? plaza[loaded]?.name ?? mii.name : 'New Mii'}</div>
      </div>
      <div className="mii-options">
        <h3>
          {catDef.icon} {catDef.name}
        </h3>
        {isColor(cat)
          ? COLORS[cat].map((color, i) => <SwatchOption key={color} color={color} active={mii[cat] === i} onPick={() => set(cat, i)} />)
          : Array.from({ length: COUNTS[cat] }, (_, i) => <PartOption key={i} mii={{ ...mii, [cat]: i }} active={mii[cat] === i} onPick={() => set(cat, i)} />)}
      </div>
      <div className="mii-plaza">
        <div className="mii-plaza-title">PLAZA</div>
        <div className="mii-plaza-list">
          {plaza.length === 0 && <span className="mii-plaza-empty">Your saved faces will live here. Make one and press Save!</span>}
          {plaza.map((m, i) => (
            <PlazaItem
              key={i}
              mii={m}
              active={i === loaded}
              onPick={() => {
                setMii({ ...m });
                setLoaded(i);
              }}
            />
          ))}
        </div>
        <div className="mii-actions">
          <Pill small onClick={shuffle} clickSound={null}>
            🎲 Random
          </Pill>
          <Pill small onClick={save} clickSound={null}>
            💾 {loaded !== null ? 'Update' : 'Save to Plaza'}
          </Pill>
          <Pill small onClick={exportPng} clickSound={null}>
            🖼 Export PNG
          </Pill>
        </div>
        <div className="mii-actions">
          <Pill
            small
            onClick={() => {
              setMii({ ...DEFAULT_MII });
              setLoaded(null);
            }}
            clickSound="tick"
          >
            ✨ New
          </Pill>
          <Pill small disabled={loaded === null} onClick={remove} clickSound={null}>
            🗑 Delete
          </Pill>
          <Pill small onClick={() => ctx.exit()} clickSound="back">
            Wii Menu
          </Pill>
        </div>
      </div>
      {toast && <div className="mii-toast">{toast}</div>}
    </div>
  );
}
