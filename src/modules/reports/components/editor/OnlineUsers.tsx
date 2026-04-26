"use client";

import { useEffect, useState } from "react";
import { useCollaboration } from "./CollaborationProvider";

interface OnlineUser {
  name: string;
  color: string;
}

export function OnlineUsers() {
  const { provider, isConnected } = useCollaboration();
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!provider || !isConnected) return;

    const updateUsers = () => {
      const states = provider.awareness.getStates();
      const seen = new Map<string, OnlineUser>();
      for (const [, state] of states) {
        const user = state?.user;
        if (user?.name && !seen.has(user.name)) {
          seen.set(user.name, { name: user.name, color: user.color || "#6b7280" });
        }
      }
      setUsers(Array.from(seen.values()));
    };

    updateUsers();
    provider.awareness.on("change", updateUsers);
    provider.on("sync", updateUsers);

    return () => {
      provider.awareness.off("change", updateUsers);
      provider.off("sync", updateUsers);
    };
  }, [provider, isConnected]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {users.map((user) => (
          <div
            key={user.name}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white border-2 border-white/20"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {users.length} 在线
      </span>
    </div>
  );
}
