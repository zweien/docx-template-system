import { create } from "zustand";

interface OnboardingStore {
  isActive: boolean;
  currentStep: number;
  start: () => void;
  stop: () => void;
  setStep: (step: number) => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  isActive: false,
  currentStep: 0,
  start: () => set({ isActive: true, currentStep: 0 }),
  stop: () => set({ isActive: false }),
  setStep: (step) => set({ currentStep: step }),
}));
