import type { ChannelDefinition } from '../core/channel';

/**
 * Channel registry. Every `src/channels/<folder>/channel.tsx` (or .ts) whose default export is a
 * `defineChannel(...)` result is picked up automatically: drop a folder, it shows up in the Wii Menu.
 */
const modules = import.meta.glob<{ default: ChannelDefinition }>('./*/channel.{ts,tsx}', { eager: true });

const seen = new Set<string>();
export const channels: ChannelDefinition[] = Object.entries(modules)
  .map(([path, mod]) => {
    const def = mod.default;
    if (!def || !def.id) throw new Error(`[freeWii] ${path} must default-export defineChannel({...})`);
    if (seen.has(def.id)) throw new Error(`[freeWii] duplicate channel id "${def.id}" (${path})`);
    seen.add(def.id);
    return def;
  })
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));

export const SLOTS_PER_PAGE = 12;

/** Channels shown in the menu: everything except the secret ones that are still locked. */
export function visibleChannels(unlocked: readonly string[]): ChannelDefinition[] {
  return channels.filter((c) => !c.secret || unlocked.includes(c.id));
}

/** The Wii Menu always offers at least two pages, so the page arrows have something to do. */
export function pageCountFor(list: readonly ChannelDefinition[]): number {
  return Math.max(2, Math.ceil(list.length / SLOTS_PER_PAGE));
}

export const PAGE_COUNT = pageCountFor(channels);

export function getChannel(id: string | null | undefined): ChannelDefinition | undefined {
  return id ? channels.find((c) => c.id === id) : undefined;
}
