import { useEffect, useRef, useState } from 'react';
import { audio } from '../../core/audio/AudioEngine';
import { useButton } from '../../core/hooks';
import { LETTERBOMB_CHANNEL, LETTERBOMB_ID, clearMessages, detonateLetterBomb, markAllRead, messageBoard, type BoardMessage } from '../../core/messageBoard';
import { useStore } from '../../core/store';
import { isUnlocked } from '../../core/unlocks';
import { wii } from '../../core/wii';
import { Pill } from '../components/Pill';

const FUSE_SECONDS = 2.4;

/** The red letter: a ticking envelope with a fuse to light. */
function BombLetter({ msg }: { msg: BoardMessage }) {
  const exploded = isUnlocked(LETTERBOMB_CHANNEL);
  const [fuse, setFuse] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const light = () => {
    if (fuse || exploded) return;
    setFuse(true);
    for (let i = 0; i < 6; i++) timers.current.push(window.setTimeout(() => audio.play('tick'), i * 380));
    timers.current.push(
      window.setTimeout(() => {
        audio.play('crash');
        wii.input.rumbleAll(400);
        detonateLetterBomb();
        wii.unlockChannel(LETTERBOMB_CHANNEL);
        wii.openPanel('none');
        // not tracked: this component unmounts with the panel, the preview must still open
        window.setTimeout(() => wii.openPreview(LETTERBOMB_CHANNEL, null), 700);
      }, FUSE_SECONDS * 1000),
    );
  };

  return (
    <li className={`mail-item mail-item--bomb ${fuse ? 'mail-item--lit' : ''} ${exploded ? 'mail-item--exploded' : ''}`}>
      <h4>
        {msg.title}
        <span>
          {msg.from} · {new Date(msg.date).toLocaleDateString()}
        </span>
      </h4>
      <p>{msg.body}</p>
      {!exploded && (
        <div className="mail-bomb-row">
          <div className="mail-fuse">
            <i style={{ animationDuration: `${FUSE_SECONDS}s` }} />
          </div>
          <Pill small onClick={light} disabled={fuse} clickSound={null}>
            {fuse ? 'Ssssss…' : '🔥 Light the fuse'}
          </Pill>
        </div>
      )}
    </li>
  );
}

/** The envelope button: a simple board where the console and channels leave notes. */
export function MessageBoardPanel() {
  const board = useStore(messageBoard);
  const close = () => wii.openPanel('none');
  useButton('b', close);

  useEffect(() => {
    const t = window.setTimeout(markAllRead, 800);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="panel panel--mail">
      <div className="panel-head">
        Wii Message Board <small>{board.messages.length} message{board.messages.length === 1 ? '' : 's'}</small>
      </div>
      <div className="panel-body">
        {board.messages.length === 0 ? (
          <div className="mail-empty">No messages yet. Channels can post here with ctx.messageBoard.post().</div>
        ) : (
          <ul className="mail-list">
            {board.messages.slice(0, 6).map((m) =>
              m.id === LETTERBOMB_ID ? (
                <BombLetter key={m.id} msg={m} />
              ) : (
                <li key={m.id} className="mail-item">
                  <h4>
                    {m.title}
                    <span>
                      {m.from} · {new Date(m.date).toLocaleDateString()}
                    </span>
                  </h4>
                  <p>{m.body}</p>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
      <div className="panel-foot">
        <Pill onClick={close} clickSound="back">
          Back
        </Pill>
        <Pill small onClick={() => clearMessages()} disabled={board.messages.length === 0}>
          Clear board
        </Pill>
      </div>
    </div>
  );
}
