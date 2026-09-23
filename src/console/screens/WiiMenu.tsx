import { SLOTS_PER_PAGE, pageCountFor, visibleChannels } from '../../channels';
import { useAudioState, useButton, useHot, useRemotes } from '../../core/hooks';
import { messageBoard } from '../../core/messageBoard';
import { settings } from '../../core/settings';
import { useStore } from '../../core/store';
import { unlocks } from '../../core/unlocks';
import { consoleStore, wii } from '../../core/wii';
import { BottomBar } from '../components/BottomBar';
import { ChannelSlot } from '../components/ChannelSlot';

function ArrowSvg({ dir }: { dir: 'left' | 'right' }) {
  const d = dir === 'right' ? 'M10 8 L34 40 L10 72' : 'M34 8 L10 40 L34 72';
  return (
    <svg viewBox="0 0 44 80" aria-hidden="true">
      <defs>
        <linearGradient id={`fw-arrow-${dir}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6cc4ff" />
          <stop offset="1" stopColor="#1e88f0" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={`url(#fw-arrow-${dir})`} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WiiMenu() {
  const state = useStore(consoleStore);
  const board = useStore(messageBoard);
  const prefs = useStore(settings);
  const audioState = useAudioState();
  const remotes = useRemotes();
  const visible = visibleChannels(useStore(unlocks).unlocked);
  const pageCount = pageCountFor(visible);
  const unread = board.messages.filter((m) => !m.read).length;
  const interactive = state.screen === 'menu' && state.panel === 'none';

  const left = useHot<HTMLDivElement>({
    disabled: state.page === 0 || !interactive,
    clickSound: null,
    onClick: () => wii.setPage(state.page - 1, pageCount),
  });
  const right = useHot<HTMLDivElement>({
    disabled: state.page >= pageCount - 1 || !interactive,
    clickSound: null,
    onClick: () => wii.setPage(state.page + 1, pageCount),
  });

  useButton(['left', 'right', 'minus', 'plus'], (_, b) => {
    if (!interactive) return;
    const dir = b === 'left' || b === 'minus' ? -1 : 1;
    wii.setPage(consoleStore.get().page + dir, pageCount);
  });

  const phones = remotes.filter((r) => r.kind === 'phone').length;
  const hint = !audioState.unlocked
    ? 'Click the screen once to enable sound'
    : prefs.showHints && phones === 0
      ? 'Press the Wii button to connect your phone as a Wii Remote'
      : null;

  const pages = Array.from({ length: pageCount }, (_, p) => visible.slice(p * SLOTS_PER_PAGE, (p + 1) * SLOTS_PER_PAGE));

  return (
    <div className="fill menu">
      <div className="menu-pages">
        <div className="menu-track" style={{ transform: `translateX(-${state.page * 100}%)` }}>
          {pages.map((list, p) => (
            <div className="menu-page" key={p}>
              <div className="menu-grid">
                {Array.from({ length: SLOTS_PER_PAGE }, (_, i) => (
                  <ChannelSlot
                    key={i}
                    channel={list[i]}
                    disabled={!interactive}
                    onOpen={(c, rect) => wii.openPreview(c.id, rect)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div
        ref={left.ref}
        className={`arrow arrow--left ${state.page === 0 ? 'arrow--hidden' : ''} ${left.hovered ? 'arrow--hover' : ''}`}
      >
        <ArrowSvg dir="left" />
      </div>
      <div
        ref={right.ref}
        className={`arrow arrow--right ${state.page >= pageCount - 1 ? 'arrow--hidden' : ''} ${right.hovered ? 'arrow--hover' : ''}`}
      >
        <ArrowSvg dir="right" />
      </div>
      <BottomBar onWii={() => wii.openPanel('options')} onMail={() => wii.openPanel('mail')} unread={unread} hint={hint} />
    </div>
  );
}
