import type { CSSProperties, ReactNode } from 'react';
import { useHot } from '../../core/hooks';
import type { HotHandlers } from '../../core/hot';

interface PillProps extends HotHandlers {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  small?: boolean;
  wide?: boolean;
}

/** Wii-style rounded button, clickable with the hand cursor. */
export function Pill({ children, className = '', style, small, wide, ...handlers }: PillProps) {
  const { ref, hovered } = useHot<HTMLDivElement>(handlers);
  const classes = [
    'pill',
    small ? 'pill--small' : '',
    wide ? 'pill--wide' : '',
    hovered && !handlers.disabled ? 'pill--hover' : '',
    handlers.disabled ? 'pill--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div ref={ref} className={classes} style={style}>
      {children}
    </div>
  );
}
