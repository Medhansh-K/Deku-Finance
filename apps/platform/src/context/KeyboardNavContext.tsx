"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "deku_keyboard_nav_enabled";

interface KeyboardNavContextValue {
  keyboardNavEnabled: boolean;
  toggleKeyboardNav: () => void;
  setKeyboardNavEnabled: (enabled: boolean) => void;
}

const KeyboardNavContext = createContext<KeyboardNavContextValue>({
  keyboardNavEnabled: true,
  toggleKeyboardNav: () => { },
  setKeyboardNavEnabled: () => { },
});

export function KeyboardNavProvider({ children }: { children: React.ReactNode }) {
  const [keyboardNavEnabled, setEnabledState] = useState<boolean>(true);

  // Initialize from localStorage (default ON for new users)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setEnabledState(stored === "true");
      } else {
        // Default ON
        localStorage.setItem(STORAGE_KEY, "true");
        setEnabledState(true);
      }
    } catch {
      setEnabledState(true);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        setEnabledState(e.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setKeyboardNavEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
      window.dispatchEvent(new CustomEvent("deku_keyboard_nav_changed", { detail: { enabled } }));
    } catch { }
  }, []);

  const toggleKeyboardNav = useCallback(() => {
    setKeyboardNavEnabled(!keyboardNavEnabled);
  }, [keyboardNavEnabled, setKeyboardNavEnabled]);

  return (
    <KeyboardNavContext.Provider
      value={{
        keyboardNavEnabled,
        toggleKeyboardNav,
        setKeyboardNavEnabled,
      }}
    >
      {children}
    </KeyboardNavContext.Provider>
  );
}

export function useKeyboardNav() {
  return useContext(KeyboardNavContext);
}

