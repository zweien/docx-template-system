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
          <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] p-0 hover:bg-[rgb(255_255_255_/_0.05)]" />
        }
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(255_255_255_/_0.06)] text-sm font-[510] text-[#f7f8f8]">
          {initials}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-[rgb(255_255_255_/_0.08)] bg-[#191a1b] text-[#f7f8f8]">
        <div className="flex flex-col gap-1 p-2">
          <p className="text-sm font-[510] leading-none">
            {session.user.name}
          </p>
          <p className="text-xs text-[#8a8f98]">
            {session.user.email}
          </p>
          <Badge variant="secondary" className="mt-1 w-fit">
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
