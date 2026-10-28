"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "@/lib/client";
import { useAuth } from "./AuthProvider";

interface WishlistContextValue {
  ids: Set<string>;
  ready: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { customer, loading } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // Load the customer's saved product ids once they're known; clear on sign-out.
  useEffect(() => {
    if (loading) return;
    if (!customer) {
      setIds(new Set());
      setReady(true);
      return;
    }
    let active = true;
    api
      .listWishlist()
      .then((products) => active && setIds(new Set(products.map((p) => p.id))))
      .catch(() => active && setIds(new Set()))
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [customer, loading]);

  const has = useCallback((productId: string) => ids.has(productId), [ids]);

  const toggle = useCallback(
    async (productId: string) => {
      const saved = ids.has(productId);
      // Optimistic update, rolled back if the request fails.
      setIds((prev) => {
        const next = new Set(prev);
        if (saved) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        if (saved) await api.removeWishlist(productId);
        else await api.addWishlist(productId);
      } catch {
        setIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(productId);
          else next.delete(productId);
          return next;
        });
      }
    },
    [ids],
  );

  return (
    <WishlistContext.Provider value={{ ids, ready, has, toggle }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
