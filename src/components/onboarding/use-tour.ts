"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./driver-theme.css";
import { tourSteps, PAGE_STEP_MAP } from "./tour-steps";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";

export function useTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive, start: storeStart, stop: storeStop, setStep } = useOnboardingStore();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const navigatingRef = useRef(false);

  const markCompleted = useCallback(async () => {
    try {
      await fetch("/api/user/onboarding", { method: "PATCH" });
    } catch {
      // silent
    }
  }, []);

  const destroyDriver = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  const createDriver = useCallback(() => {
    return driver({
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      popoverClass: "idrl-theme",
      allowClose: true,
      overlayColor: "black",
      overlayOpacity: 0.5,
      smoothScroll: true,
      steps: tourSteps,
      onNextClick: (_element, _step, { state, driver: d }) => {
        const nextIndex = (state.activeIndex ?? 0) + 1;
        const requiredPage = PAGE_STEP_MAP[nextIndex];
        if (requiredPage && !pathname.startsWith(requiredPage)) {
          navigatingRef.current = true;
          setStep(nextIndex);
          d.destroy();
          driverRef.current = null;
          router.push(requiredPage);
          return;
        }
        d.moveNext();
      },
      onDestroyed: () => {
        if (navigatingRef.current) {
          navigatingRef.current = false;
          driverRef.current = null;
          return;
        }
        storeStop();
        driverRef.current = null;
        markCompleted();
      },
    });
  }, [pathname, router, setStep, storeStop, markCompleted]);

  const start = useCallback(() => {
    destroyDriver();
    const d = createDriver();
    driverRef.current = d;
    storeStart();
    d.drive();
  }, [destroyDriver, createDriver, storeStart]);

  const resumeFromStep = useCallback((stepIndex: number) => {
    destroyDriver();
    const d = createDriver();
    driverRef.current = d;
    storeStart();
    d.drive(stepIndex);
  }, [destroyDriver, createDriver, storeStart]);

  const stop = useCallback(() => {
    destroyDriver();
    storeStop();
    markCompleted();
  }, [destroyDriver, storeStop, markCompleted]);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  return { start, stop, resumeFromStep, isActive };
}
