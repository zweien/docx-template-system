"use client";

import { useCallback, useEffect, useState } from "react";

export const NAV_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

export function useNavigationState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed, hydrated]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  const openMobile = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen((current) => !current);
  }, []);

  return {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    openMobile,
    closeMobile,
    setMobileOpen,
    toggleMobile,
  };
}
