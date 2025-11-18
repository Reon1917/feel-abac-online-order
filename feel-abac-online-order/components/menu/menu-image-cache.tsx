"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  type ReactNode,
} from "react";

type MenuImageCacheValue = {
  claim: (src: string, instanceId: string) => boolean;
  release: (src: string, instanceId: string) => void;
};

const MenuImageCacheContext = createContext<MenuImageCacheValue | null>(null);

const globalImageClaims = new Map<string, Set<string>>();

export function MenuImageCacheProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useMemo<MenuImageCacheValue>(
    () => ({
      claim: (src: string, instanceId: string) => {
        if (!src) return false;
        let claims = globalImageClaims.get(src);
        if (!claims) {
          claims = new Set();
          globalImageClaims.set(src, claims);
        }
        if (claims.size === 0 || claims.has(instanceId)) {
          claims.add(instanceId);
          return claims.size === 1;
        }
        return false;
      },
      release: (src: string, instanceId: string) => {
        if (!src) return;
        const claims = globalImageClaims.get(src);
        if (!claims) return;
        claims.delete(instanceId);
        if (claims.size === 0) {
          globalImageClaims.delete(src);
        }
      },
    }),
    []
  );

  return (
    <MenuImageCacheContext.Provider value={value}>
      {children}
    </MenuImageCacheContext.Provider>
  );
}

export function useMenuImageCache(imageUrl: string | null | undefined) {
  const context = useContext(MenuImageCacheContext);
  const normalized =
    typeof imageUrl === "string" ? imageUrl.trim() : "";
  const instanceId = useId();

  const isFirstInstance = useMemo(() => {
    if (!context || !normalized) {
      return false;
    }
    return context.claim(normalized, instanceId);
  }, [context, instanceId, normalized]);

  useEffect(() => {
    if (!context || !normalized) {
      return;
    }
    const currentSrc = normalized;
    return () => {
      context.release(currentSrc, instanceId);
    };
  }, [context, instanceId, normalized]);

  return { isFirstInstance };
}
