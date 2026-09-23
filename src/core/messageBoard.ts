import { createStore } from './store';
import { isUnlocked } from './unlocks';

export interface BoardMessage {
  id: string;
  /** Unix ms */
  date: number;
  from: string;
  title: string;
  body: string;
  read: boolean;
}

export interface MessageBoardApi {
  /** Post a message to the Wii Message Board (persisted in localStorage). */
  post(msg: { from: string; title: string; body: string }): BoardMessage;
  list(): BoardMessage[];
}

interface BoardState {
  messages: BoardMessage[];
}

const KEY = 'freewii.messages';
const MAX_MESSAGES = 60;

const WELCOME: BoardMessage = {
  id: 'welcome',
  date: Date.now(),
  from: 'freeWii',
  title: 'Welcome to freeWii!',
  body:
    'Use your phone as a Wii Remote: press the Wii button (bottom-left), choose "Wii Remote" and scan the QR code. ' +
    'Point your phone at the screen and press the target button to centre the cursor. ' +
    'Without a phone, the mouse is the pointer, left click = A, right click = B, Esc = HOME.',
  read: false,
};

function load(): BoardState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BoardState;
      if (Array.isArray(parsed.messages)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { messages: [WELCOME] };
}

function save(state: BoardState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export const messageBoard = createStore<BoardState>(load());

/** The secret: a ticking red letter, like the LetterBomb of old. It unlocks this channel. */
export const LETTERBOMB_ID = 'letterbomb';
export const LETTERBOMB_CHANNEL = 'homebrew';
const LETTERBOMB: BoardMessage = {
  id: LETTERBOMB_ID,
  date: 0,
  from: 'LetterBomb',
  title: '💣 A strange red letter',
  body: 'Someone slipped a red envelope into your Message Board, and it is ticking. Rumour has it that opening it installs a channel that was never meant to ship… Light the fuse if you dare.',
  read: false,
};

/** Plants the letter until it has gone off (idempotent, survives "Clear board"). */
export function plantLetterBomb(): void {
  const state = messageBoard.get();
  if (isUnlocked(LETTERBOMB_CHANNEL) || state.messages.some((m) => m.id === LETTERBOMB_ID)) return;
  const next = { messages: [{ ...LETTERBOMB, date: Date.now() }, ...state.messages].slice(0, MAX_MESSAGES) };
  messageBoard.set(next);
  save(next);
}

/** The letter has exploded: keep it as a memento. */
export function detonateLetterBomb(): void {
  const state = messageBoard.get();
  const next = {
    messages: state.messages.map((m) =>
      m.id === LETTERBOMB_ID
        ? { ...m, title: '💥 Kaboom!', body: 'The letter went off and the Homebrew Channel appeared in your Wii Menu. Enjoy the secret game, and tell no one.', read: true }
        : m,
    ),
  };
  messageBoard.set(next);
  save(next);
}

export function unreadCount(): number {
  return messageBoard.get().messages.filter((m) => !m.read).length;
}

export function markAllRead(): void {
  const state = messageBoard.get();
  if (state.messages.every((m) => m.read)) return;
  const next = { messages: state.messages.map((m) => ({ ...m, read: true })) };
  messageBoard.set(next);
  save(next);
}

export function clearMessages(): void {
  const next = { messages: [] as BoardMessage[] };
  messageBoard.set(next);
  save(next);
}

export const messageBoardApi: MessageBoardApi = {
  post({ from, title, body }) {
    const msg: BoardMessage = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      date: Date.now(),
      from: String(from).slice(0, 32),
      title: String(title).slice(0, 80),
      body: String(body).slice(0, 1000),
      read: false,
    };
    const next = { messages: [msg, ...messageBoard.get().messages].slice(0, MAX_MESSAGES) };
    messageBoard.set(next);
    save(next);
    return msg;
  },
  list() {
    return messageBoard.get().messages;
  },
};
