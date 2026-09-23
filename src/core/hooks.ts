import { useEffect, useRef, useState, type DependencyList, type RefObject } from 'react';
import { audio } from './audio/AudioEngine';
import { hot, type HotHandlers } from './hot';
import { input, type InputEvents } from './input/InputManager';
import type { HostState } from './input/RemoteHost';
import type { WiiButton } from './input/types';
import type { Wiimote } from './input/Wiimote';

/**
 * Makes an element clickable with the Wii cursor (any remote).
 * Usage: `const { ref, hovered } = useHot({ onClick: () => ... }); <div ref={ref} className={hovered ? 'hot' : ''}/>`
 */
export function useHot<T extends HTMLElement = HTMLDivElement>(handlers: HotHandlers): { ref: RefObject<T>; hovered: boolean } {
  const ref = useRef<T>(null);
  const [hovered, setHovered] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return hot.register(el, () => handlersRef.current, setHovered);
  }, []);
  return { ref, hovered };
}

/** Every connected remote (phones first, local mouse/keyboard last). Re-renders on join / leave / renumber. */
export function useRemotes(): Wiimote[] {
  const [remotes, setRemotes] = useState<Wiimote[]>(() => input.remotes);
  useEffect(() => input.on('remotes', ({ remotes }) => setRemotes([...remotes])), []);
  return remotes;
}

export function usePlayers(): Wiimote[] {
  const [players, setPlayers] = useState<Wiimote[]>(() => input.players);
  useEffect(() => input.on('remotes', () => setPlayers([...input.players])), []);
  return players;
}

export function useHostState(): HostState {
  const [state, setState] = useState<HostState>(() => input.hostState);
  useEffect(() => input.on('host', setState), []);
  return state;
}

/** Subscribe to an InputManager event for the lifetime of the component. */
export function useInputEvent<K extends keyof InputEvents>(
  event: K,
  handler: (payload: InputEvents[K]) => void,
  deps: DependencyList = [],
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => input.on(event, (p) => handlerRef.current(p)), [event, ...deps]);
}

/** Runs `handler` when any remote presses `button`. */
export function useButton(button: WiiButton | WiiButton[], handler: (remote: Wiimote, button: WiiButton) => void): void {
  const buttons = Array.isArray(button) ? button : [button];
  useInputEvent(
    'buttondown',
    ({ remote, button: b }) => {
      if (buttons.includes(b)) handler(remote, b);
    },
    [buttons.join(',')],
  );
}

export function useAudioState(): { unlocked: boolean; musicPlaying: boolean; themeSource: 'file' | 'synth' | null } {
  const [state, setState] = useState({ unlocked: audio.unlocked, musicPlaying: audio.musicPlaying, themeSource: audio.themeSource });
  useEffect(() => audio.on('change', setState), []);
  return state;
}

/** Element size in CSS pixels, updated through a ResizeObserver. */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** requestAnimationFrame loop with delta time in seconds. */
export function useAnimationFrame(callback: (dt: number, time: number) => void, active = true): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cbRef.current(dt, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
