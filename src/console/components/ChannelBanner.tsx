import { useAssetExists } from '../../core/assets';
import type { ChannelDefinition } from '../../core/channel';

interface ChannelBannerProps {
  channel: ChannelDefinition;
  active: boolean;
}

/**
 * Picks the richest banner available: a looping video file, else an image file, else the
 * channel's React banner. Files are optional and live in public/assets/<channel>/.
 */
export function ChannelBanner({ channel, active }: ChannelBannerProps) {
  const hasVideo = useAssetExists(channel.bannerVideo, 'video');
  const hasImage = useAssetExists(channel.bannerImage, 'image');
  const Banner = channel.banner;
  if (hasVideo && channel.bannerVideo) {
    return <video className="banner-media" src={channel.bannerVideo} autoPlay muted loop playsInline disablePictureInPicture />;
  }
  if (hasImage && channel.bannerImage) {
    return <img className="banner-media" src={channel.bannerImage} alt={channel.title} draggable={false} />;
  }
  return <Banner active={active} />;
}
