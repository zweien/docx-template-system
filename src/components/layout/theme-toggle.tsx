"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const themes = ["light", "dark", "system"] as const;

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const current = themes.includes(theme as typeof themes[number])
    ? (theme as typeof themes[number])
    : "system";

  const Icon = icons[current];

  const toggle = () => {
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    setTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="shrink-0"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
