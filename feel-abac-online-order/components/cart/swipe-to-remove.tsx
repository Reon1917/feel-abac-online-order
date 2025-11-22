"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 100;
const MAX_SWIPE_DISTANCE = 160;

type SwipeToRemoveProps = {
  children: ReactNode;
  onRemove: () => Promise<boolean> | boolean;
  disabled?: boolean;
  removeLabel: string;
  className?: string;
};

export function SwipeToRemove({
  children,
  onRemove,
  disabled = false,
  removeLabel,
  className,
}: SwipeToRemoveProps) {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const startXRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const setOffsetValue = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const triggerRemove = useCallback(async () => {
    if (disabled || isRemoving) {
      return false;
    }
    setIsRemoving(true);
    try {
      const result = await onRemove();
      return result !== false;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setIsRemoving(false);
    }
  }, [disabled, isRemoving, onRemove]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || disabled || isRemoving) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea")) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    setIsSwiping(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !isSwiping ||
      pointerIdRef.current === null ||
      event.pointerId !== pointerIdRef.current
    ) {
      return;
    }

    const delta = event.clientX - startXRef.current;

    if (delta > 0) {
      setOffsetValue(Math.min(delta, 24));
      return;
    }

    event.preventDefault();
    const limited = Math.max(delta, -MAX_SWIPE_DISTANCE);
    setOffsetValue(limited);
  };

  const finishSwipe = useCallback(
    async (
      event: React.PointerEvent<HTMLDivElement> | null,
      cancelled?: boolean
    ) => {
      if (!isSwiping) {
        return;
      }

      if (
        event &&
        pointerIdRef.current !== null &&
        event.pointerId === pointerIdRef.current
      ) {
        try {
          event.currentTarget.releasePointerCapture(pointerIdRef.current);
        } catch {
          // Ignore capture release issues.
        }
      }

      pointerIdRef.current = null;
      setIsSwiping(false);

      if (cancelled) {
        setOffsetValue(0);
        return;
      }

      if (offsetRef.current <= -SWIPE_THRESHOLD) {
        setOffsetValue(-MAX_SWIPE_DISTANCE);
        const success = await triggerRemove();
        if (!success) {
          setOffsetValue(0);
        }
      } else {
        setOffsetValue(0);
      }
    },
    [isSwiping, triggerRemove, setOffsetValue]
  );

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    void finishSwipe(event);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    void finishSwipe(event, true);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSwiping) {
      return;
    }
    void finishSwipe(event, true);
  };

  const handleDeleteClick = async () => {
    if (disabled || isRemoving) {
      return;
    }
    setOffsetValue(-MAX_SWIPE_DISTANCE);
    const success = await triggerRemove();
    if (!success) {
      setOffsetValue(0);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-3">
        <button
          type="button"
          tabIndex={-1}
          aria-label={removeLabel}
          onClick={handleDeleteClick}
          disabled={disabled || isRemoving}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm transition hover:bg-rose-500 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div
        className="will-change-transform"
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: isSwiping ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </div>
    </div>
  );
}
