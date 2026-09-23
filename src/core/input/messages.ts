import type { WiiButton } from './types';

export const PROTOCOL_VERSION = 1;
export const PEER_PREFIX = 'freewii-';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1').slice(0, CODE_LENGTH);
}

export type Triple = [number, number, number];

/** Phone → console */
export type RemoteToConsole =
  | { t: 'hello'; v: number; name: string; ua?: string }
  | { t: 's'; b: number; o: Triple | null; a: Triple | null; g: Triple | null; r: Triple | null; ts: number }
  | { t: 'btn'; k: WiiButton; d: 0 | 1 }
  | { t: 'center' }
  | { t: 'pong'; ts: number };

/** Console → phone */
export type ConsoleToRemote =
  | { t: 'welcome'; v: number; player: number; console: string }
  | { t: 'player'; player: number }
  | { t: 'rumble'; ms: number }
  | { t: 'ping'; ts: number }
  | { t: 'bye' };
