import { useEffect, useRef, useState } from 'react';
import { getChannel } from '../../channels';
import { audio } from '../../core/audio/AudioEngine';
import { useButton } from '../../core/hooks';
import { useStore } from '../../core/store';
import { consoleStore, wii } from '../../core/wii';
import { BarShape } from '../components/BottomBar';
import { ChannelBanner } from '../components/ChannelBanner';
import { Pill } from '../components/Pill';

/** The tile zooms to full screen, then "Wii Menu" / "Start" appear, like the original. */
export function ChannelPreview() {
  const state = useStore(consoleStore);
  const channel = getChannel(state.channelId);
  const [full, setFull] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const closing = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setFull(true)));
    const t = window.setTimeout(() => setShowBar(true), 620);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    audio.play('back');
    setShowBar(false);
    setFull(false);
    window.setTimeout(() => wii.closePreview(), 520);
  };

  const start = () => {
    if (closing.current) return;
    closing.current = true;
    wii.startChannel();
  };

  useButton('b', close);

  if (!channel) return null;
  const from = state.zoomFrom ?? { x: 0.3, y: 0.3, w: 0.4, h: 0.4 };
  const style = full
    ? { left: 0, top: 0, width: '100%', height: '100%' }
    : { left: `${from.x * 100}%`, top: `${from.y * 100}%`, width: `${from.w * 100}%`, height: `${from.h * 100}%` };

  return (
    <div className={`preview ${full ? 'preview--full' : ''}`} style={style}>
      <div className="preview-banner">
        <ChannelBanner channel={channel} active={full} />
      </div>
      {showBar && (
        <div className="preview-bar">
          <BarShape />
          <div className="preview-title">
            {channel.title}
            {channel.author ? ` · ${channel.author}` : ''}
          </div>
          <Pill className="pill--left" onClick={close} clickSound={null}>
            Wii Menu
          </Pill>
          <Pill className="pill--right" onClick={start} clickSound={null}>
            Start
          </Pill>
        </div>
      )}
    </div>
  );
}
