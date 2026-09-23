/** A face, as a set of part indices and colours. */
export interface Mii {
  face: number;
  skin: number;
  hair: number;
  hairColor: number;
  eyes: number;
  eyeColor: number;
  brows: number;
  nose: number;
  mouth: number;
  glasses: number;
  extra: number;
  shirt: number;
  name: string;
}

export const SKIN = ['#ffe0bd', '#f5cba7', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
export const HAIR_COLORS = ['#2b2118', '#5d4037', '#8d6e63', '#d7b377', '#f7e7a0', '#b71c1c', '#e65100', '#9e9e9e'];
export const EYE_COLORS = ['#3e2723', '#1565c0', '#2e7d32', '#6d4c41', '#616161'];
export const SHIRTS = ['#e53935', '#ff8f00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#f06292', '#ffffff', '#212121'];

export type PartKey = 'face' | 'hair' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'glasses' | 'extra';
export type ColorKey = 'skin' | 'hairColor' | 'eyeColor' | 'shirt';
export type CategoryKey = PartKey | ColorKey;

export const COUNTS: Record<PartKey, number> = { face: 4, hair: 8, eyes: 6, brows: 4, nose: 4, mouth: 6, glasses: 4, extra: 5 };
export const COLORS: Record<ColorKey, string[]> = { skin: SKIN, hairColor: HAIR_COLORS, eyeColor: EYE_COLORS, shirt: SHIRTS };

export const CATEGORIES: { id: CategoryKey; name: string; icon: string }[] = [
  { id: 'face', name: 'Face', icon: '🙂' },
  { id: 'skin', name: 'Skin', icon: '🎨' },
  { id: 'hair', name: 'Hair', icon: '💇' },
  { id: 'hairColor', name: 'Hair colour', icon: '🖌️' },
  { id: 'eyes', name: 'Eyes', icon: '👀' },
  { id: 'eyeColor', name: 'Eye colour', icon: '🔵' },
  { id: 'brows', name: 'Eyebrows', icon: '🤨' },
  { id: 'nose', name: 'Nose', icon: '👃' },
  { id: 'mouth', name: 'Mouth', icon: '👄' },
  { id: 'glasses', name: 'Glasses', icon: '👓' },
  { id: 'extra', name: 'Extras', icon: '🧔' },
  { id: 'shirt', name: 'Shirt', icon: '👕' },
];

export const DEFAULT_MII: Mii = { face: 0, skin: 1, hair: 1, hairColor: 0, eyes: 1, eyeColor: 0, brows: 0, nose: 0, mouth: 0, glasses: 0, extra: 0, shirt: 4, name: 'Mii' };

const r = (n: number) => Math.floor(Math.random() * n);

export function randomMii(): Mii {
  return {
    face: r(COUNTS.face),
    skin: r(SKIN.length),
    hair: r(COUNTS.hair),
    hairColor: r(HAIR_COLORS.length),
    eyes: r(COUNTS.eyes),
    eyeColor: r(EYE_COLORS.length),
    brows: r(COUNTS.brows),
    nose: r(COUNTS.nose),
    mouth: r(COUNTS.mouth),
    glasses: Math.random() < 0.65 ? 0 : 1 + r(COUNTS.glasses - 1),
    extra: Math.random() < 0.6 ? 0 : 1 + r(COUNTS.extra - 1),
    shirt: r(SHIRTS.length),
    name: 'Mii',
  };
}

export const PLAZA_KEY = 'freewii.miis';

export function loadPlaza(): Mii[] {
  try {
    const raw = localStorage.getItem(PLAZA_KEY);
    const list = raw ? (JSON.parse(raw) as Mii[]) : [];
    return Array.isArray(list) ? list.map((m) => ({ ...DEFAULT_MII, ...m })) : [];
  } catch {
    return [];
  }
}

export function savePlaza(list: Mii[]): void {
  try {
    localStorage.setItem(PLAZA_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* storage unavailable */
  }
}
