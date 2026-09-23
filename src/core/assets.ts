import { useEffect, useState } from 'react';

/**
 * Optional image assets: files dropped in public/assets/... override the procedural drawings.
 * Everything resolves to `null` when a file is missing, so callers always have a fallback path.
 */

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = imageCache.get(url);
  if (p) return p;
  p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
  imageCache.set(url, p);
  return p;
}

export type ImageMap<K extends string> = Record<K, HTMLImageElement | null>;

/** Load several images at once; missing ones are `null`. */
export async function loadImages<K extends string>(map: Record<K, string>): Promise<ImageMap<K>> {
  const entries = await Promise.all(
    (Object.entries(map) as [K, string][]).map(async ([key, url]) => [key, await loadImage(url)] as const),
  );
  return Object.fromEntries(entries) as ImageMap<K>;
}

/** Build `{ key: base + file }` maps quickly. */
export function assetMap<K extends string>(base: string, files: Record<K, string>): Record<K, string> {
  return Object.fromEntries((Object.entries(files) as [K, string][]).map(([k, f]) => [k, `${base}/${f}`])) as Record<K, string>;
}

/** Numbered frames: `frames('/assets/x/duck', 3)` → ['/assets/x/duck-1.png', ...]. */
export function frames(base: string, count: number, ext = 'png'): string[] {
  return Array.from({ length: count }, (_, i) => `${base}-${i + 1}.${ext}`);
}

/**
 * Draw an image scaled to `height` pixels (aspect preserved), centred horizontally at `cx`,
 * with its bottom edge at `bottomY`. Optional rotation around that anchor, in radians.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  bottomY: number,
  height: number,
  rotation = 0,
  alpha = 1,
): void {
  const w = (img.naturalWidth / img.naturalHeight) * height;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, bottomY);
  if (rotation) ctx.rotate(rotation);
  ctx.drawImage(img, -w / 2, -height, w, height);
  ctx.restore();
}

/** Draw an image to cover a rectangle (like CSS `object-fit: cover`). */
export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** React hook: loads a map of images once; `null` entries mean "use the procedural fallback". */
export function useImages<K extends string>(map: Record<K, string>): ImageMap<K> | null {
  const [images, setImages] = useState<ImageMap<K> | null>(null);
  const key = JSON.stringify(map);
  useEffect(() => {
    let alive = true;
    loadImages(map).then((res) => {
      if (alive) setImages(res);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return images;
}

/** Does a file exist under public/? (dev servers answer index.html for missing files, hence the type check) */
export async function assetExists(url: string, kind: 'image' | 'audio' | 'video' | 'any' = 'any'): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || type.includes('text/html')) return false;
    return kind === 'any' || type.startsWith(kind);
  } catch {
    return false;
  }
}

export function useAssetExists(url: string | undefined, kind: 'image' | 'audio' | 'video' | 'any' = 'any'): boolean {
  const [exists, setExists] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!url) {
      setExists(false);
      return;
    }
    assetExists(url, kind).then((v) => {
      if (alive) setExists(v);
    });
    return () => {
      alive = false;
    };
  }, [url, kind]);
  return exists;
}
