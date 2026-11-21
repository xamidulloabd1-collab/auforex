"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * UI-only preference (last selected instrument/timeframe). Never used for
 * authentication, subscription status or content access.
 */
type ChartPreferences = {
  symbol: string;
  interval: string;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: string) => void;
};

export const useChartPreferences = create<ChartPreferences>()(
  persist(
    (set) => ({
      symbol: "FX:EURUSD",
      interval: "60",
      setSymbol: (symbol) => set({ symbol }),
      setInterval: (interval) => set({ interval }),
    }),
    {
      name: "au-chart-preferences",
      storage: createJSONStorage(() => {
        try {
          return window.localStorage;
        } catch {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
      }),
      partialize: (s) => ({ symbol: s.symbol, interval: s.interval }),
    },
  ),
);
