"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useOnboardingStore } from "@/lib/stores/onboarding-store";
import { useTour } from "./use-tour";
import { WelcomeDialog } from "./welcome-dialog";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { isActive, currentStep } = useOnboardingStore();
  const { start, resumeFromStep } = useTour();
  const [showWelcome, setShowWelcome] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    if (!session?.user) return;
    hasCheckedRef.current = true;
    const user = session.user as typeof session.user & {
      onboardingCompleted?: boolean;
    };
    if (!user.onboardingCompleted) {
      setShowWelcome(true);
    }
  }, [session]);

  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (!isActive) return;
    if (pathname === prevPathnameRef.current) return;
    prevPathnameRef.current = pathname;
    const timer = setTimeout(() => {
      resumeFromStep(currentStep);
    }, 300);
    return () => clearTimeout(timer);
  }, [pathname, isActive, currentStep, resumeFromStep]);

  useEffect(() => {
    prevPathnameRef.current = pathname;
  }, [pathname]);

  const handleStart = useCallback(() => {
    setShowWelcome(false);
    start();
  }, [start]);

  const handleSkip = useCallback(async () => {
    setShowWelcome(false);
    try {
      await fetch("/api/user/onboarding", { method: "PATCH" });
    } catch {
      // silent
    }
  }, []);

  return (
    <>
      <WelcomeDialog
        open={showWelcome}
        onStart={handleStart}
        onSkip={handleSkip}
      />
      {children}
    </>
  );
}
