"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const roleLabels: Record<string, string> = {
  ADMIN: "管理员",
  USER: "用户",
};

export function UserNav() {
  const { data: session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!session?.user) {
    return null;
  }

  const initials = session.user.name
    ? session.user.name.charAt(0).toUpperCase()
    : "U";

  const roleLabel =
    roleLabels[session.user.role as string] ?? session.user.role;

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/audit-logout", { method: "POST" });

      const response = await fetch("/api/auth/sso-logout-url");
      const data = (await response.json()) as { url?: string };

      await signOut({ redirect: false });
      window.location.assign(data.url || "/login");
    } catch {
      await signOut({ callbackUrl: "/login" });
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="relative h-9 w-9 rounded-full" />
        }
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white">
          {initials}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col gap-1 p-2">
          <p className="text-sm font-medium leading-none">
            {session.user.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {session.user.email}
          </p>
          <Badge variant="secondary" className="w-fit mt-1">
            {roleLabel}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          onClick={handleLogout}
        >
          <LogOut />
          {isLoggingOut ? "退出中..." : "退出登录"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
