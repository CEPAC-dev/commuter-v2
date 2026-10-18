import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface TripPoint {
  address: string;
  lat: number;
  lng: number;
}

interface TripState {
  pickup: TripPoint | null;
  dropoff: TripPoint | null;
  setPickup: (p: TripPoint | null) => void;
  setDropoff: (p: TripPoint | null) => void;
  swap: () => void;
  clear: () => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      pickup: null,
      dropoff: null,
      setPickup: (pickup) => set({ pickup }),
      setDropoff: (dropoff) => set({ dropoff }),
      swap: () => set((s) => ({ pickup: s.dropoff, dropoff: s.pickup })),
      clear: () => set({ pickup: null, dropoff: null }),
    }),
    {
      name: "commuter-trip",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ pickup: s.pickup, dropoff: s.dropoff }),
    },
  ),
);
