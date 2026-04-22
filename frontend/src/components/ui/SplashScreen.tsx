import { useCallback, useRef, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    sessionStorage.setItem('splashSeen', '1');
    setFading(true);
    setTimeout(onDone, 300);
  }, [onDone]);

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        cursor: 'pointer',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.3s ease',
      }}
    >
      <video
        src="/videos/opener.mp4"
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
}
