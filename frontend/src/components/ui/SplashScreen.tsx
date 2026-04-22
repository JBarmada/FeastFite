import { useCallback, useRef, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [started, setStarted] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    sessionStorage.setItem('splashSeen', '1');
    setFading(true);
    setTimeout(onDone, 700);
  }, [onDone]);

  const start = useCallback(() => {
    setStarted(true);
    videoRef.current?.play();
  }, []);

  return (
    <div
      onClick={started ? dismiss : start}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        cursor: 'pointer',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.7s ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      <video
        ref={videoRef}
        src="/videos/opener.mp4"
        playsInline
        onEnded={dismiss}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          opacity: started ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}
      />

      {!started && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/images/tap-to-play.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
    </div>
  );
}
