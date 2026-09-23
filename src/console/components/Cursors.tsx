import { useEffect, useRef } from 'react';
import { useAssetExists } from '../../core/assets';
import { useRemotes } from '../../core/hooks';
import { input } from '../../core/input/InputManager';
import type { Wiimote } from '../../core/input/Wiimote';
import { useStore } from '../../core/store';
import { consoleStore } from '../../core/wii';

export const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'];

/** Optional hand images (public/assets/system/): fingertip at 40% / 4% of the image, like the SVG. */
const CURSOR_IMAGE = '/assets/system/cursor.png';
const CURSOR_GRAB_IMAGE = '/assets/system/cursor-grab.png';

function HandSvg() {
  return (
    <svg viewBox="0 0 58 68" aria-hidden="true">
      <g fill="#fff" stroke="#3d4f6e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <rect x="12" y="30" width="44" height="34" rx="12" />
        <path d="M17 38 V10 a6.5 6.5 0 0 1 13 0 V38" />
        <path d="M12 42 c-8 -2 -11 6 -8 11 s5 7 9 9" />
        <path d="M32 31 v11 M42 31 v11" fill="none" />
      </g>
    </svg>
  );
}

/** Draws one hand cursor per remote, updated imperatively at input rate (no React re-render). */
export function Cursors() {
  const remotes = useRemotes();
  const visible = useStore(consoleStore).cursorVisible;
  const hasImage = useAssetExists(CURSOR_IMAGE, 'image');
  const hasGrab = useAssetExists(CURSOR_GRAB_IMAGE, 'image');
  const els = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const apply = (r: Wiimote) => {
      const el = els.current.get(r.id);
      if (!el) return;
      const p = r.pointer;
      const grabbing = r.buttons.a;
      el.style.display = p.onScreen ? 'block' : 'none';
      const scale = grabbing && !hasGrab ? 0.9 : 1;
      el.style.transform = `translate(${(p.x * 100).toFixed(3)}cqw, ${(p.y * 100).toFixed(3)}cqh) translate(-40%, -4%) rotate(${p.roll.toFixed(3)}rad) scale(${scale})`;
      const point = el.querySelector<HTMLElement>('.cursor-point');
      const grab = el.querySelector<HTMLElement>('.cursor-grab');
      if (point && grab) {
        point.style.display = grabbing ? 'none' : 'block';
        grab.style.display = grabbing ? 'block' : 'none';
      }
    };
    const offs = [
      input.on('pointer', ({ remote }) => apply(remote)),
      input.on('buttondown', ({ remote }) => apply(remote)),
      input.on('buttonup', ({ remote }) => apply(remote)),
    ];
    for (const r of input.remotes) apply(r);
    return () => offs.forEach((off) => off());
  }, [remotes, hasGrab]);

  if (!visible) return null;

  return (
    <div className="cursors">
      {remotes.map((r) => (
        <div
          key={r.id}
          className="cursor"
          style={{ display: r.pointer.onScreen ? 'block' : 'none', transformOrigin: '40% 4%' }}
          ref={(el) => {
            if (el) els.current.set(r.id, el);
            else els.current.delete(r.id);
          }}
        >
          {hasImage ? (
            <>
              <img className="cursor-img cursor-point" src={CURSOR_IMAGE} alt="" draggable={false} />
              {hasGrab && <img className="cursor-img cursor-grab" src={CURSOR_GRAB_IMAGE} alt="" draggable={false} style={{ display: 'none' }} />}
            </>
          ) : (
            <HandSvg />
          )}
          <span className="cursor-badge" style={{ background: PLAYER_COLORS[(r.player - 1) % 4] ?? '#3b82f6' }}>
            {r.player || ''}
          </span>
        </div>
      ))}
    </div>
  );
}
