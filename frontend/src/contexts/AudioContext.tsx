import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

type SfxName = 'button' | 'battle' | 'win';

interface AudioContextValue {
  isMuted: boolean;
  toggleMute: () => void;
}

const AudioCtx = createContext<AudioContextValue>({ isMuted: false, toggleMute: () => {} });

export function useAudio() {
  return useContext(AudioCtx);
}

const SFX_SRCS: Record<SfxName, string> = {
  button: '/sounds/button-press.mp3',
  battle: '/sounds/battle-start.mp3',
  win:    '/sounds/win-cheer.mp3',
};

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('ff-muted') === 'true';
  });

  // Refs so event listeners always read current value
  const mutedRef = useRef(isMuted);
  mutedRef.current = isMuted;

  // Background music
  const bgRef = useRef<HTMLAudioElement | null>(null);
  // SFX pool
  const sfxRefs = useRef<Record<SfxName, HTMLAudioElement | null>>({
    button: null,
    battle: null,
    win: null,
  });

  // Create audio elements once
  useEffect(() => {
    const bg = new Audio('/sounds/bg-music.mp3');
    bg.loop = true;
    bg.volume = 0.35;
    bgRef.current = bg;

    sfxRefs.current.button = new Audio(SFX_SRCS.button);
    sfxRefs.current.battle = new Audio(SFX_SRCS.battle);
    sfxRefs.current.win    = new Audio(SFX_SRCS.win);
    sfxRefs.current.button!.volume = 0.6;
    sfxRefs.current.battle!.volume = 0.8;
    sfxRefs.current.win!.volume    = 0.75;

    return () => {
      bg.pause();
    };
  }, []);

  // Start background music after the splash video ends/is skipped.
  // The user's tap on the splash satisfies the browser's interaction requirement,
  // so playback is allowed by the time this fires.
  useEffect(() => {
    function startBg() {
      if (!mutedRef.current && bgRef.current) {
        bgRef.current.play().catch(() => {});
      }
    }
    window.addEventListener('feastfite:splash-done', startBg);
    return () => window.removeEventListener('feastfite:splash-done', startBg);
  }, []);

  // Mute/unmute bg music when isMuted changes
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    if (isMuted) {
      bg.pause();
    } else {
      bg.play().catch(() => {});
    }
  }, [isMuted]);

  // Global button-click SFX — plays on any button/link unless [data-no-sfx]
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mutedRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-sfx]')) return;
      if (target.closest('button, a')) {
        const sfx = sfxRefs.current.button;
        if (sfx) {
          sfx.currentTime = 0;
          sfx.play().catch(() => {});
        }
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Named SFX via window event — dispatch anywhere with:
  //   window.dispatchEvent(new CustomEvent('feastfite:sfx', { detail: 'battle' }))
  useEffect(() => {
    function handleSfx(e: Event) {
      if (mutedRef.current) return;
      const name = (e as CustomEvent<SfxName>).detail;
      const sfx = sfxRefs.current[name];
      if (sfx) {
        sfx.currentTime = 0;
        sfx.play().catch(() => {});
      }
    }
    window.addEventListener('feastfite:sfx', handleSfx);
    return () => window.removeEventListener('feastfite:sfx', handleSfx);
  }, []);

  function toggleMute() {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('ff-muted', String(next));
      return next;
    });
  }

  return (
    <AudioCtx.Provider value={{ isMuted, toggleMute }}>
      {children}
    </AudioCtx.Provider>
  );
}
