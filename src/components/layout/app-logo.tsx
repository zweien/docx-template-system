"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  priority?: boolean;
}

export function AppLogo({ className, priority = false }: AppLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="IDRL填表系统"
      width={260}
      height={145}
      priority={priority}
      className={cn("h-7 w-auto shrink-0 object-contain", className)}
    />
  );
}
