"use client";

import type { OnlineUser } from "@/types/realtime";
import { UserAvatarStack } from "@/components/data/user-avatar";

interface OnlinePresenceBarProps {
  users: OnlineUser[];
}

export function OnlinePresenceBar({ users }: OnlinePresenceBarProps) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[rgb(255_255_255_/_0.08)] bg-[rgb(255_255_255_/_0.02)] px-2 py-1">
      <UserAvatarStack users={users} size="sm" />
      <span className="text-xs text-[#8a8f98]">
        {users.length} 人在线
      </span>
    </div>
  );
}
