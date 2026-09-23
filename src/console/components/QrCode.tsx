import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeProps {
  text: string;
  size?: number;
  className?: string;
}

export function QrCode({ text, size = 256, className }: QrCodeProps) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: size, color: { dark: '#2f4c6b', light: '#ffffff' } })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => setSrc(''));
    return () => {
      alive = false;
    };
  }, [text, size]);
  return src ? <img src={src} alt="QR code" className={className} draggable={false} /> : <div className={className} />;
}
