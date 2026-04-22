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
      onClick={started ? dismiss : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        cursor: started ? 'pointer' : 'default',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.7s ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
    >
      {/* Video — hidden until started */}
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

      {/* Title screen — visible until started */}
      {!started && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/images/tap-to-play.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Transparent clickable button overlaid on the image's TAP TO PLAY area */}
          <button
            onClick={start}
            aria-label="Tap to Play"
            style={{
              position: 'absolute',
              left: '50%',
              top: '71%',
              transform: 'translateX(-50%)',
              width: '38%',
              height: '12%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '9999px',
            }}
          />
        </div>
      )}
    </div>
  );
}
