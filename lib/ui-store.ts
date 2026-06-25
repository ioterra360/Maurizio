import { create } from "zustand";

type ToastState = { id: number; message: string };

type UIState = {
  toast: ToastState | null;
  showToast: (message: string) => void;
  hideToast: () => void;
};

// Monotonic nonce so back-to-back identical messages still restart the
// toast timers (a bare string would be skipped by the selector equality).
let nextToastId = 0;

/**
 * Global UI side effects. Right now just the toast queue — small enough that
 * coalescing into one store keeps the surface from sprawling.
 */
export const useUIStore = create<UIState>((set) => ({
  toast: null,
  showToast: (message) => set({ toast: { id: ++nextToastId, message } }),
  hideToast: () => set({ toast: null }),
}));
