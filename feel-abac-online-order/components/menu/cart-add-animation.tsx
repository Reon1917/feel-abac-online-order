"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type FloatingParticle = {
  id: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
};

let particleIdCounter = 0;

export function useCartAddAnimation() {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const cleanupTimers = useRef<Record<number, NodeJS.Timeout>>({});

  useEffect(() => {
    const timers = cleanupTimers.current;
    return () => {
      for (const id of Object.keys(timers)) {
        const numericId = Number(id);
        clearTimeout(timers[numericId]);
        delete timers[numericId];
      }
    };
  }, []);

  const launch = useCallback((rect?: DOMRect | null) => {
    if (!rect) {
      return;
    }

    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = window.innerWidth / 2;
    const endY = window.innerHeight - 72;
    const id = particleIdCounter++;

    const particle: FloatingParticle = {
      id,
      startX,
      startY,
      deltaX: endX - startX,
      deltaY: endY - startY,
    };

    setParticles((prev) => [...prev, particle]);

    const timeout = setTimeout(() => {
      setParticles((prev) => prev.filter((entry) => entry.id !== id));
      cleanupTimers.current[id]?.unref?.();
      delete cleanupTimers.current[id];
    }, 600);

    cleanupTimers.current[id] = timeout;
  }, []);

  const Overlay = useCallback(() => {
    if (particles.length === 0) {
      return null;
    }

    return <FloatingParticles particles={particles} />;
  }, [particles]);

  return useMemo(
    () => ({
      launch,
      Overlay,
    }),
    [launch, Overlay]
  );
}

function FloatingParticles({ particles }: { particles: FloatingParticle[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <style jsx global>{`
        @keyframes fly-to-cart {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          60% {
            opacity: 1;
            transform: translate3d(calc(var(--dx) * 0.7), calc(var(--dy) * 0.7), 0)
              scale(1.05);
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--dx), var(--dy), 0) scale(0.4);
          }
        }
      `}</style>
      {particles.map((particle) => {
        const style: CSSProperties & Record<"--dx" | "--dy", string> = {
          left: particle.startX,
          top: particle.startY,
          animation: "fly-to-cart 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards",
          "--dx": `${particle.deltaX}px`,
          "--dy": `${particle.deltaY}px`,
        };
        return (
          <span
            key={particle.id}
            className="absolute -ml-4 -mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow-lg"
            style={style}
          >
            +1
          </span>
        );
      })}
    </div>
  );
}
