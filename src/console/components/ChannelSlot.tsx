import type { ChannelDefinition } from '../../core/channel';
import { useHot } from '../../core/hooks';
import { ChannelBanner } from './ChannelBanner';
import type { Rect } from '../../core/wii';

/** Bounding box of an element as fractions of the stage. */
export function rectInStage(el: HTMLElement): Rect {
  const stage = el.closest<HTMLElement>('.stage');
  const s = stage?.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!s || s.width === 0) return { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
  return { x: (r.left - s.left) / s.width, y: (r.top - s.top) / s.height, w: r.width / s.width, h: r.height / s.height };
}

interface ChannelSlotProps {
  channel?: ChannelDefinition;
  onOpen?(channel: ChannelDefinition, from: Rect): void;
  /** Keeps the banner visible but not clickable (e.g. while a preview is open). */
  disabled?: boolean;
}

/** One tile of the Wii Menu grid. Empty when no channel is given. */
export function ChannelSlot({ channel, onOpen, disabled }: ChannelSlotProps) {
  const { ref, hovered } = useHot<HTMLDivElement>({
    disabled: !channel || !!disabled,
    clickSound: null,
    onClick: () => {
      if (channel && ref.current) onOpen?.(channel, rectInStage(ref.current));
    },
  });
  const classes = ['slot', channel ? 'slot--filled' : '', hovered && channel ? 'slot--hover' : ''].filter(Boolean).join(' ');
  return (
    <div ref={ref} className={classes} title={channel?.title}>
      {channel && (
        <div className="banner-box">
          <ChannelBanner channel={channel} active={false} />
        </div>
      )}
    </div>
  );
}
