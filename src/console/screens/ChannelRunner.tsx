import { useEffect, useRef, useState } from 'react';
import { getChannel } from '../../channels';
import { MENU_MUSIC, audio } from '../../core/audio/AudioEngine';
import type { ChannelContext, ChannelInstance } from '../../core/channel';
import { useButton } from '../../core/hooks';
import { input } from '../../core/input/InputManager';
import { messageBoardApi } from '../../core/messageBoard';
import { useStore } from '../../core/store';
import { consoleStore, wii } from '../../core/wii';
import { Pill } from '../components/Pill';
import { HomeMenu } from './HomeMenu';

/** Mounts the selected channel into a full-screen container and handles the HOME button. */
export function ChannelRunner() {
  const state = useStore(consoleStore);
  const channel = getChannel(state.channelId);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ChannelInstance | null>(null);
  const pausedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !channel) return;
    let cancelled = false;
    const resizeCbs = new Set<(w: number, h: number) => void>();
    const ro = new ResizeObserver(() => {
      for (const cb of resizeCbs) cb(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    const ctx: ChannelContext = {
      container,
      input,
      audio,
      get players() {
        return input.players;
      },
      exit: () => wii.exitChannel(),
      setCursorVisible: (v) => wii.setCursorVisible(v),
      get paused() {
        return pausedRef.current;
      },
      onResize: (cb) => {
        resizeCbs.add(cb);
        cb(container.clientWidth, container.clientHeight);
        return () => {
          resizeCbs.delete(cb);
        };
      },
      messageBoard: messageBoardApi,
    };

    Promise.resolve()
      .then(() => channel.mount(ctx))
      .then((inst) => {
        if (cancelled) inst.unmount();
        else instanceRef.current = inst;
      })
      .catch((err: unknown) => {
        console.error(`[freeWii] channel "${channel.id}" failed to start`, err);
        setError(err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err));
      });

    return () => {
      cancelled = true;
      ro.disconnect();
      const inst = instanceRef.current;
      instanceRef.current = null;
      // Deferred: unmounting a nested React root synchronously inside another root's commit is not allowed.
      window.setTimeout(() => {
        try {
          inst?.unmount();
        } catch (err) {
          console.error('[freeWii] channel unmount failed', err);
        }
        // Whatever the channel did with the audio on its way out, the menu gets its theme back.
        if (consoleStore.get().screen === 'menu') audio.playMusic(MENU_MUSIC);
      }, 0);
    };
  }, [channel]);

  useButton('home', () => wii.toggleHomeMenu());

  useEffect(() => {
    pausedRef.current = state.homeMenu;
    const inst = instanceRef.current;
    if (state.homeMenu) inst?.pause?.();
    else inst?.resume?.();
  }, [state.homeMenu]);

  if (!channel) {
    return (
      <div className="runner">
        <div className="runner-error">
          <div>
            Channel not found.
            <br />
            <br />
            <Pill onClick={() => wii.exitChannel()}>Wii Menu</Pill>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="runner">
      <div className="runner-container" ref={containerRef} />
      {error && (
        <div className="runner-error">
          <div>
            This channel crashed.
            <code>{error}</code>
            <br />
            <Pill onClick={() => wii.exitChannel()}>Wii Menu</Pill>
          </div>
        </div>
      )}
      {state.homeMenu && <HomeMenu />}
    </div>
  );
}
