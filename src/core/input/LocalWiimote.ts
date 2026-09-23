import { clamp } from './pointerMath';
import type { WiiButton } from './types';
import { Wiimote } from './Wiimote';

const KEYS: Record<string, WiiButton> = {
  Space: 'a',
  Enter: 'a',
  KeyA: 'a',
  ShiftLeft: 'b',
  ShiftRight: 'b',
  KeyB: 'b',
  Escape: 'home',
  KeyH: 'home',
  Equal: 'plus',
  NumpadAdd: 'plus',
  Minus: 'minus',
  NumpadSubtract: 'minus',
  Digit1: 'one',
  Digit2: 'two',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const SWING_KEY = 'KeyS';
const MOUSE_SWING_SPEED = 2.4; // normalized screen units per second
const MOUSE_SWING_COOLDOWN = 400;

/**
 * Mouse + keyboard fallback so the console can be used (and channels developed) without a phone.
 * Mouse = pointer, left click = A, right click = B, middle click = HOME.
 * Keys: Space/Enter = A, Shift = B, Esc/H = HOME, +/- , 1, 2, arrows = D-pad, S = swing.
 * Dragging the mouse quickly while holding B also produces a swing.
 */
export class LocalWiimote extends Wiimote {
  private stage: HTMLElement | null = null;
  private lastMove = { x: 0.5, y: 0.5, t: 0 };
  private lastSwing = 0;
  private onGesture: (() => void) | null = null;

  constructor() {
    super('local', 'local', 'Mouse & keyboard');
  }

  /** `onGesture` is called synchronously inside native user gestures (used to unlock audio). */
  attach(stage: HTMLElement, onGesture?: () => void): void {
    this.detach();
    this.stage = stage;
    this.onGesture = onGesture ?? null;
    window.addEventListener('pointermove', this.handleMove, { passive: true });
    window.addEventListener('pointerdown', this.handleDown);
    window.addEventListener('pointerup', this.handleUp);
    window.addEventListener('pointercancel', this.handleUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.releaseAll);
    stage.addEventListener('contextmenu', this.preventDefault);
  }

  detach(): void {
    window.removeEventListener('pointermove', this.handleMove);
    window.removeEventListener('pointerdown', this.handleDown);
    window.removeEventListener('pointerup', this.handleUp);
    window.removeEventListener('pointercancel', this.handleUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    this.stage?.removeEventListener('contextmenu', this.preventDefault);
    this.stage = null;
  }

  private preventDefault = (e: Event) => e.preventDefault();

  private releaseAll = () => {
    for (const b of this.heldButtons) this.setButton(b, false);
  };

  private toStage(e: PointerEvent): { x: number; y: number; inside: boolean } | null {
    if (!this.stage) return null;
    const r = this.stage.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
  }

  private handleMove = (e: PointerEvent) => {
    const p = this.toStage(e);
    if (!p) return;
    const now = performance.now();
    const dt = (now - this.lastMove.t) / 1000;
    if (dt > 0 && dt < 0.2 && this.buttons.b) {
      const vx = (p.x - this.lastMove.x) / dt;
      const vy = (p.y - this.lastMove.y) / dt;
      const speed = Math.hypot(vx, vy);
      if (speed > MOUSE_SWING_SPEED && now - this.lastSwing > MOUSE_SWING_COOLDOWN) {
        this.lastSwing = now;
        const peak = 6 + clamp(speed / 6, 0, 1) * 22;
        this.emitSwing(peak, { x: vx, y: 0, z: -vy });
      }
    }
    this.lastMove = { x: p.x, y: p.y, t: now };
    this.setPointer(clamp(p.x, -0.05, 1.05), clamp(p.y, -0.05, 1.05), p.inside, 0);
  };

  private handleDown = (e: PointerEvent) => {
    this.onGesture?.();
    const p = this.toStage(e);
    if (!p || !p.inside) return;
    if (e.pointerType === 'touch') this.setPointer(p.x, p.y, true, 0);
    const button: WiiButton | null = e.button === 0 ? 'a' : e.button === 2 ? 'b' : e.button === 1 ? 'home' : null;
    if (button) {
      if (e.button === 1) e.preventDefault();
      this.setButton(button, true);
    }
  };

  private handleUp = (e: PointerEvent) => {
    const button: WiiButton | null = e.button === 0 ? 'a' : e.button === 2 ? 'b' : e.button === 1 ? 'home' : null;
    if (button) this.setButton(button, false);
  };

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    this.onGesture?.();
    if (e.code === SWING_KEY && !e.repeat) {
      this.emitSwing(24, { x: 0, y: 0.2, z: -1 });
      return;
    }
    const button = KEYS[e.code];
    if (!button) return;
    e.preventDefault();
    if (!e.repeat) this.setButton(button, true);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const button = KEYS[e.code];
    if (button) this.setButton(button, false);
  };
}
