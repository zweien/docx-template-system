"use client";

import type { OnlineUser } from "@/types/realtime";
import { UserAvatarStack } from "@/components/data/user-avatar";

interface OnlinePresenceBarProps {
  users: OnlineUser[];
}

export function OnlinePresenceBar({ users }: OnlinePresenceBarProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <UserAvatarStack users={users} size="sm" />
      <span className="text-xs text-muted-foreground">
        {users.length} 人在线
      </span>
    </div>
  );
}
