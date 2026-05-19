import { create } from "zustand";

type UIState = {
  toast: string | null;
  showToast: (message: string) => void;
  hideToast: () => void;
};

/**
 * Global UI side effects. Right now just the toast queue — small enough that
 * coalescing into one store keeps the surface from sprawling.
 */
export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (message) => set({ toast: message }),
  hideToast: () => set({ toast: null }),
}));
