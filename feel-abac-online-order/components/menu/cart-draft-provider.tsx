"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PublicMenuItem } from "@/lib/menu/types";

type PendingAddition = {
  id: string;
  item: PublicMenuItem;
  quantity: number;
};

type FloatingParticle = {
  id: number;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
};

type CartDraftContextValue = {
  pendingItems: PendingAddition[];
  pendingQuantity: number;
  pendingSubtotal: number;
  queueAddition: (item: PublicMenuItem, triggerRect?: DOMRect | null) => void;
  applyPendingAdditions: () => Promise<void>;
  isApplying: boolean;
};

const CartDraftContext = createContext<CartDraftContextValue | null>(null);

let animationIdCounter = 0;

type CartDraftProviderProps = {
  children: ReactNode;
  messages: {
    requireDetails: string;
    applySuccess: string;
    applyError: string;
  };
};

export function CartDraftProvider({ children, messages }: CartDraftProviderProps) {
  const [pendingMap, setPendingMap] = useState<Record<string, PendingAddition>>({});
  const [isApplying, setIsApplying] = useState(false);
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const router = useRouter();
  const cleanupTimers = useRef<Record<number, NodeJS.Timeout>>({});

  const pendingItems = useMemo(() => Object.values(pendingMap), [pendingMap]);

  const pendingQuantity = pendingItems.reduce(
    (total, entry) => total + entry.quantity,
    0
  );

  const pendingSubtotal = pendingItems.reduce(
    (total, entry) => total + entry.item.price * entry.quantity,
    0
  );

  const launchParticle = useCallback((rect?: DOMRect | null) => {
    if (!rect) return;
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = window.innerWidth / 2;
    const endY = window.innerHeight - 72;
    const particleId = animationIdCounter++;
    const particle: FloatingParticle = {
      id: particleId,
      startX,
      startY,
      deltaX: endX - startX,
      deltaY: endY - startY,
    };
    setParticles((prev) => [...prev, particle]);
    const timeout = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== particleId));
      cleanupTimers.current[particleId]?.unref?.();
      delete cleanupTimers.current[particleId];
    }, 600);
    cleanupTimers.current[particleId] = timeout;
  }, []);

  const queueAddition = useCallback(
    (item: PublicMenuItem, triggerRect?: DOMRect | null) => {
      const hasChoiceGroups = item.choiceGroups?.length > 0;
      if (hasChoiceGroups) {
        toast.info(messages.requireDetails);
        return;
      }

      launchParticle(triggerRect);

      setPendingMap((prev) => {
        const existing = prev[item.id];
        const nextQuantity = (existing?.quantity ?? 0) + 1;
        return {
          ...prev,
          [item.id]: {
            id: item.id,
            item,
            quantity: nextQuantity,
          },
        };
      });
    },
    [launchParticle, messages.requireDetails]
  );

  const applyPendingAdditions = useCallback(async () => {
    if (pendingItems.length === 0 || isApplying) {
      return;
    }
    setIsApplying(true);
    try {
      const response = await fetch("/api/cart/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: pendingItems.map((entry) => ({
            menuItemId: entry.item.id,
            quantity: entry.quantity,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message =
          (data && typeof data.error === "string" && data.error) ||
          "Unable to add items right now.";
        throw new Error(message);
      }

      setPendingMap({});
      router.refresh();
      toast.success(messages.applySuccess);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : messages.applyError;
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  }, [isApplying, messages.applyError, messages.applySuccess, pendingItems, router]);

  const value = useMemo<CartDraftContextValue>(
    () => ({
      pendingItems,
      pendingQuantity,
      pendingSubtotal,
      queueAddition,
      applyPendingAdditions,
      isApplying,
    }),
    [
      applyPendingAdditions,
      isApplying,
      pendingItems,
      pendingQuantity,
      pendingSubtotal,
      queueAddition,
    ]
  );

  return (
    <CartDraftContext.Provider value={value}>
      {children}
      <FloatingParticles particles={particles} />
    </CartDraftContext.Provider>
  );
}

function FloatingParticles({ particles }: { particles: FloatingParticle[] }) {
  if (particles.length === 0) {
    return null;
  }

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

export function useCartDraft() {
  const context = useContext(CartDraftContext);
  if (!context) {
    throw new Error("useCartDraft must be used within CartDraftProvider");
  }
  return context;
}
