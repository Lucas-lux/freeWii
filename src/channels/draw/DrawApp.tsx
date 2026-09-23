import { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS, useAnimationFrame, useHot, useInputEvent, useRemotes, type ChannelContext, type MusicRequest, type Wiimote } from '../../core';

/** Share of the screen width taken by the toolbar; the paper fills the rest. */
const TOOLBAR = 0.13;
const CANVAS_H = 1080;
const CANVAS_W = Math.round(CANVAS_H * (16 / 9) * (1 - TOOLBAR));
const PALETTE = ['#1a1a1a', '#ffffff', '#e53935', '#ff8f00', '#ffeb3b', '#43a047', '#26c6da', '#1e88e5', '#8e24aa', '#f06292', '#8d6e63', '#9e9e9e'];
const SIZES = [4, 10, 22, 44];
const MAX_UNDO = 24;
const STORAGE_KEY = 'freewii.draw';
const MUSIC: MusicRequest = { url: '/assets/draw/music/draw.mp3', synth: 'menu', fade: 0.8 };

type Tool = 'brush' | 'eraser';
interface Crayon {
  color: string;
  size: number;
  tool: Tool;
}
interface Stroke {
  tool: Tool;
  color: string;
  size: number;
  /** Last raw point and last drawn point (midpoint smoothing). */
  prev: { x: number; y: number };
  last: { x: number; y: number };
}

/** The shared sheet of paper: an offscreen-sized canvas every remote draws on. */
class Board {
  readonly canvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private undo: ImageData[] = [];
  private strokes = new Map<string, Stroke>();
  private saveTimer: number | undefined;

  constructor() {
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.canvas.className = 'draw-canvas';
    this.g = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.wipe();
    this.restore();
  }

  get canUndo(): boolean {
    return this.undo.length > 0;
  }

  isDrawing(id: string): boolean {
    return this.strokes.has(id);
  }

  private wipe(): void {
    this.g.globalCompositeOperation = 'source-over';
    this.g.fillStyle = '#fff';
    this.g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  private snapshot(): void {
    this.undo.push(this.g.getImageData(0, 0, CANVAS_W, CANVAS_H));
    if (this.undo.length > MAX_UNDO) this.undo.shift();
  }

  private setup(s: Stroke): void {
    const g = this.g;
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = g.fillStyle = s.tool === 'eraser' ? '#fff' : s.color;
    g.lineWidth = s.size;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  }

  begin(id: string, x: number, y: number, crayon: Crayon, tool: Tool): void {
    if (this.strokes.has(id)) return;
    this.snapshot();
    const s: Stroke = { tool, color: crayon.color, size: tool === 'eraser' ? Math.max(crayon.size, 18) : crayon.size, prev: { x, y }, last: { x, y } };
    this.strokes.set(id, s);
    this.setup(s);
    this.g.beginPath();
    this.g.arc(x, y, s.size / 2, 0, Math.PI * 2);
    this.g.fill();
  }

  move(id: string, x: number, y: number): void {
    const s = this.strokes.get(id);
    if (!s) return;
    const mx = (s.prev.x + x) / 2, my = (s.prev.y + y) / 2;
    this.setup(s);
    this.g.beginPath();
    this.g.moveTo(s.last.x, s.last.y);
    this.g.quadraticCurveTo(s.prev.x, s.prev.y, mx, my);
    this.g.stroke();
    s.last = { x: mx, y: my };
    s.prev = { x, y };
  }

  end(id: string): void {
    const s = this.strokes.get(id);
    if (!s) return;
    this.setup(s);
    this.g.beginPath();
    this.g.moveTo(s.last.x, s.last.y);
    this.g.lineTo(s.prev.x, s.prev.y);
    this.g.stroke();
    this.strokes.delete(id);
    this.scheduleSave();
  }

  /** Ends every stroke whose remote is gone. */
  endMissing(ids: Set<string>): void {
    for (const id of Array.from(this.strokes.keys())) if (!ids.has(id)) this.end(id);
  }

  undoLast(): boolean {
    const img = this.undo.pop();
    if (!img) return false;
    this.strokes.clear();
    this.g.putImageData(img, 0, 0);
    this.scheduleSave();
    return true;
  }

  clear(): void {
    this.snapshot();
    this.strokes.clear();
    this.wipe();
    this.scheduleSave();
  }

  toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
  }

  /** The sheet survives leaving the channel (localStorage, best effort). */
  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persist(), 1500);
  }

  persist(): void {
    window.clearTimeout(this.saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, this.canvas.toDataURL('image/png'));
    } catch {
      /* storage full or unavailable: the drawing just is not kept */
    }
  }

  private restore(): void {
    let url: string | null = null;
    try {
      url = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      this.g.globalCompositeOperation = 'source-over';
      this.g.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
    };
    img.src = url;
  }
}

function defaultCrayon(r: Wiimote): Crayon {
  return { color: PLAYER_COLORS[(r.player - 1 + 4) % 4], size: SIZES[1], tool: 'brush' };
}

/** Stage pointer (0..1) → paper pixels. Returns null when the pointer is over the toolbar. */
function toPaper(p: { x: number; y: number }, force = false): { x: number; y: number } | null {
  const fx = (p.x - TOOLBAR) / (1 - TOOLBAR);
  if (!force && fx < 0) return null;
  return { x: Math.max(0, Math.min(1, fx)) * CANVAS_W, y: Math.max(0, Math.min(1, p.y)) * CANVAS_H };
}

function Badges({ players }: { players: number[] }) {
  if (players.length === 0) return null;
  return (
    <span className="draw-badges">
      {players.map((p) => (
        <i key={p} style={{ background: PLAYER_COLORS[(p - 1 + 4) % 4] }}>
          {p}
        </i>
      ))}
    </span>
  );
}

function Swatch({ color, players, onPick }: { color: string; players: number[]; onPick(r: Wiimote): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, hoverSound: null, clickSound: 'tick' });
  return (
    <div ref={ref} className={`draw-swatch ${hovered ? 'draw-swatch--hover' : ''}`} style={{ background: color }}>
      <Badges players={players} />
    </div>
  );
}

function SizeDot({ size, players, onPick }: { size: number; players: number[]; onPick(r: Wiimote): void }) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, hoverSound: null, clickSound: 'tick' });
  return (
    <div ref={ref} className={`draw-size ${hovered ? 'draw-size--hover' : ''}`}>
      <i style={{ width: `calc(${Math.min(size + 6, 30)} * var(--px))`, height: `calc(${Math.min(size + 6, 30)} * var(--px))` }} />
      <Badges players={players} />
    </div>
  );
}

function Tool({
  icon,
  label,
  players,
  disabled,
  danger,
  onPick,
}: {
  icon: string;
  label: string;
  players?: number[];
  disabled?: boolean;
  danger?: boolean;
  onPick(r: Wiimote): void;
}) {
  const { ref, hovered } = useHot<HTMLDivElement>({ onClick: onPick, disabled });
  const cls = ['draw-tool', hovered && !disabled ? 'draw-tool--hover' : '', disabled ? 'draw-tool--disabled' : '', danger ? 'draw-tool--danger' : ''].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={cls}>
      <span className="draw-tool-icon">{icon}</span>
      <span>{label}</span>
      {players && <Badges players={players} />}
    </div>
  );
}

/** The whiteboard: toolbar on the left, paper on the right, one crayon per remote. */
export function DrawApp({ ctx }: { ctx: ChannelContext }) {
  const boardRef = useRef<Board | null>(null);
  if (!boardRef.current) boardRef.current = new Board();
  const board = boardRef.current;
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const remotes = useRemotes();
  const [crayons, setCrayons] = useState<Record<string, Crayon>>({});
  const crayonsRef = useRef(crayons);
  crayonsRef.current = crayons;
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();
  const [confirmClear, setConfirmClear] = useState(false);
  const [, bump] = useState(0);

  const crayonFor = (r: Wiimote): Crayon => crayonsRef.current[r.id] ?? defaultCrayon(r);
  const setCrayon = (r: Wiimote, patch: Partial<Crayon>) => setCrayons((c) => ({ ...c, [r.id]: { ...(c[r.id] ?? defaultCrayon(r)), ...patch } }));
  const say = (text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1800);
  };

  useEffect(() => {
    ctx.audio.playMusic(MUSIC);
    const sheet = sheetRef.current;
    sheet?.appendChild(board.canvas);
    return () => {
      board.persist();
      board.canvas.remove();
      window.clearTimeout(toastTimer.current);
    };
  }, [ctx, board]);

  const undo = () => {
    if (board.undoLast()) {
      ctx.audio.play('back');
      say('Undo');
    } else ctx.audio.play('deny');
    bump((n) => n + 1);
  };

  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    board.clear();
    setConfirmClear(false);
    ctx.audio.play('whoosh');
    say('Cleared');
    bump((n) => n + 1);
  };

  const save = async (r: Wiimote) => {
    const blob = await board.toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freewii-drawing-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    ctx.audio.play('success');
    say('Saved to your downloads');
    ctx.messageBoard.post({ from: 'freeDraw', title: 'Drawing saved', body: `P${r.player} saved a drawing as ${a.download}.` });
  };

  useInputEvent('buttondown', ({ remote, button }) => {
    if (ctx.paused) return;
    const c = crayonFor(remote);
    if (button === 'a' || button === 'b') {
      if (!remote.pointer.onScreen) return;
      const pt = toPaper(remote.pointer);
      if (!pt) return; // toolbar click, handled by the hot elements
      board.begin(remote.id, pt.x, pt.y, c, button === 'b' ? 'eraser' : c.tool);
      ctx.audio.play('tick');
    } else if (button === 'left' || button === 'right') {
      const i = PALETTE.indexOf(c.color);
      const n = (Math.max(0, i) + (button === 'right' ? 1 : PALETTE.length - 1)) % PALETTE.length;
      setCrayon(remote, { color: PALETTE[n], tool: 'brush' });
      ctx.audio.play('tick');
    } else if (button === 'up' || button === 'plus' || button === 'down' || button === 'minus') {
      const i = Math.max(0, SIZES.indexOf(c.size));
      const n = Math.max(0, Math.min(SIZES.length - 1, i + (button === 'up' || button === 'plus' ? 1 : -1)));
      setCrayon(remote, { size: SIZES[n] });
      ctx.audio.play('tick');
    } else if (button === 'one') undo();
    else if (button === 'two') {
      setCrayon(remote, { tool: c.tool === 'brush' ? 'eraser' : 'brush' });
      ctx.audio.play('select');
    }
  });
  useInputEvent('buttonup', ({ remote, button }) => {
    if ((button === 'a' || button === 'b') && board.isDrawing(remote.id)) {
      board.end(remote.id);
      bump((n) => n + 1);
    }
  });
  useInputEvent('pointer', ({ remote, pointer }) => {
    if (!board.isDrawing(remote.id) || ctx.paused) return;
    const pt = toPaper(pointer, true)!;
    board.move(remote.id, pt.x, pt.y);
  });
  useEffect(() => board.endMissing(new Set(remotes.map((r) => r.id))), [remotes, board]);

  // brush preview rings, one per remote, drawn over the paper at input rate
  useAnimationFrame(() => {
    const cv = overlayRef.current;
    const sheet = sheetRef.current;
    if (!cv || !sheet) return;
    const w = sheet.clientWidth, h = sheet.clientHeight;
    if (w === 0 || h === 0) return;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    const k = w / CANVAS_W;
    for (const r of remotes) {
      const p = r.pointer;
      if (!p.onScreen) continue;
      const pt = toPaper(p);
      if (!pt) continue;
      const c = crayonFor(r);
      const eraser = r.buttons.b || c.tool === 'eraser';
      const rad = Math.max(3, ((eraser ? Math.max(c.size, 18) : c.size) * k) / 2);
      g.beginPath();
      g.arc(pt.x * k, pt.y * k, rad, 0, Math.PI * 2);
      g.lineWidth = 2;
      g.setLineDash(eraser ? [4, 4] : []);
      g.strokeStyle = eraser ? '#555' : c.color === '#ffffff' ? '#999' : c.color;
      g.stroke();
      g.setLineDash([]);
      if (!board.isDrawing(r.id)) {
        g.fillStyle = eraser ? 'rgba(0,0,0,0.08)' : `${c.color}33`;
        g.fill();
      }
    }
  });

  const users = (pred: (c: Crayon) => boolean) => remotes.filter((r) => pred(crayonFor(r))).map((r) => r.player);

  return (
    <div className="draw">
      <div className="draw-toolbar">
        <div className="draw-logo">
          free<b>Draw</b>
        </div>
        <div className="draw-palette">
          {PALETTE.map((col) => (
            <Swatch key={col} color={col} players={users((c) => c.color === col && c.tool === 'brush')} onPick={(r) => setCrayon(r, { color: col, tool: 'brush' })} />
          ))}
        </div>
        <div className="draw-sizes">
          {SIZES.map((s) => (
            <SizeDot key={s} size={s} players={users((c) => c.size === s)} onPick={(r) => setCrayon(r, { size: s })} />
          ))}
        </div>
        <Tool icon="🧽" label="Eraser" players={users((c) => c.tool === 'eraser')} onPick={(r) => setCrayon(r, { tool: crayonFor(r).tool === 'eraser' ? 'brush' : 'eraser' })} />
        <Tool icon="↶" label="Undo" disabled={!board.canUndo} onPick={undo} />
        <Tool icon="🗑" label={confirmClear ? 'Sure?' : 'Clear'} danger={confirmClear} onPick={clear} />
        <Tool icon="💾" label="Save PNG" onPick={save} />
        <Tool icon="⌂" label="Wii Menu" onPick={() => ctx.exit()} />
      </div>
      <div className="draw-paper">
        <div className="draw-sheet" ref={sheetRef} />
        <canvas ref={overlayRef} className="draw-overlay" />
        {toast && <div className="draw-toast">{toast}</div>}
        <div className="draw-hint">Hold A to draw · hold B to erase · ◀ ▶ colour · ▲ ▼ size · 1 undo · 2 eraser · everyone draws at once</div>
      </div>
    </div>
  );
}
