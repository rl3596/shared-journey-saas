"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type JourneyAdminContextValue = {
  isJourneyAdmin: boolean;
  toggleJourneyAdmin: () => void;
  /** Show a small dismissable toast at the bottom of the screen. */
  showToast: (message: string) => void;
};

const JourneyAdminContext = createContext<JourneyAdminContextValue | null>(null);

export function JourneyAdminProvider({ children }: { children: ReactNode }) {
  const [isJourneyAdmin, setIsJourneyAdmin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleJourneyAdmin = useCallback(() => {
    setIsJourneyAdmin((prev) => !prev);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // Clean up pending timeout if the provider unmounts.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <JourneyAdminContext.Provider
      value={{ isJourneyAdmin, toggleJourneyAdmin, showToast }}
    >
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-zinc-900/95 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur dark:bg-zinc-100/95 dark:text-zinc-900"
        >
          {toast}
        </div>
      )}
    </JourneyAdminContext.Provider>
  );
}

export function useJourneyAdmin(): JourneyAdminContextValue {
  const ctx = useContext(JourneyAdminContext);
  if (!ctx) {
    // Safe fallback if the hook is ever used outside the provider —
    // admin stays off and toast is a no-op.
    return {
      isJourneyAdmin: false,
      toggleJourneyAdmin: () => {},
      showToast: () => {},
    };
  }
  return ctx;
}
