import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import type { AudioEngine } from './audio/AudioEngine';
import type { InputManager } from './input/InputManager';
import type { Wiimote } from './input/Wiimote';
import type { MessageBoardApi } from './messageBoard';

/** Props received by a channel banner (the animated tile in the Wii Menu and in the preview screen). */
export interface BannerProps {
  /** True in the full-screen preview (after the tile has been clicked), false inside the menu grid. */
  active: boolean;
}

/** Everything a running channel gets from the console. */
export interface ChannelContext {
  /** Full-screen element to render into (real pixel size, 16:9). */
  container: HTMLElement;
  input: InputManager;
  audio: AudioEngine;
  /** Remotes that count as players, in player order. Re-read it after `input.on('remotes')`. */
  readonly players: Wiimote[];
  /** Leave the channel and go back to the Wii Menu. */
  exit(): void;
  /** Show or hide the hand cursor(s) drawn by the console. */
  setCursorVisible(visible: boolean): void;
  /** True while the HOME Menu is open. */
  readonly paused: boolean;
  /** Called whenever the container size changes. Returns an unsubscribe function. */
  onResize(cb: (width: number, height: number) => void): () => void;
  messageBoard: MessageBoardApi;
}

export interface ChannelInstance {
  unmount(): void;
  /** Called when the HOME Menu opens. */
  pause?(): void;
  /** Called when the HOME Menu closes. */
  resume?(): void;
}

export interface ChannelDefinition {
  /** Unique slug, e.g. "sports". Used in URLs and storage keys. */
  id: string;
  title: string;
  description?: string;
  author?: string;
  version?: string;
  /** Position in the menu (lower first). Defaults to 100. */
  order?: number;
  /** Animated tile (React). Size with `cqw` / `cqh` units, 1cqw = 1% of the banner width. */
  banner: ComponentType<BannerProps>;
  /** Optional image shown instead of the React banner when the file exists (e.g. /assets/<id>/banner.png). */
  bannerImage?: string;
  /** Optional looping video (webm/mp4, muted) shown instead of the banner when the file exists. */
  bannerVideo?: string;
  /** Music played while the channel preview is open (e.g. /assets/<id>/banner-music.mp3). Falls back to the menu theme. */
  bannerMusic?: string;
  /** Boot the channel. Return an instance whose `unmount` tears everything down. */
  mount(ctx: ChannelContext): ChannelInstance | Promise<ChannelInstance>;
  players?: { min?: number; max?: number };
  /** Hidden from the Wii Menu until `window.freewii.unlockChannel(id)` is called (e.g. by an easter egg). */
  secret?: boolean;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;

/** Validates and returns a channel definition; use it as the default export of `channel.tsx`. */
export function defineChannel(def: ChannelDefinition): ChannelDefinition {
  if (!ID_RE.test(def.id)) throw new Error(`[freeWii] channel id "${def.id}" must match ${ID_RE}`);
  if (!def.title) throw new Error(`[freeWii] channel "${def.id}" needs a title`);
  if (!def.banner) throw new Error(`[freeWii] channel "${def.id}" needs a banner component`);
  if (typeof def.mount !== 'function') throw new Error(`[freeWii] channel "${def.id}" needs a mount() function`);
  return def;
}

/** Mount helper for channels written in React: `mount: reactMount(MyApp)`. */
export function reactMount(Component: ComponentType<{ ctx: ChannelContext }>): ChannelDefinition['mount'] {
  return (ctx) => {
    const root = createRoot(ctx.container);
    root.render(createElement(Component, { ctx }));
    return {
      unmount: () => root.unmount(),
    };
  };
}
