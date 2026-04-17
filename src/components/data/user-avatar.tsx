"use client";

interface UserAvatarProps {
  name: string;
  color?: string;
  size?: "sm" | "md";
  className?: string;
}

export function UserAvatar({ name, color, size = "sm", className = "" }: UserAvatarProps) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const sizeClass = size === "sm" ? "size-6 text-xs" : "size-8 text-sm";
  const bg = color ?? "#6B7280";

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-medium shrink-0 ${sizeClass} ${className}`}
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initial}
    </div>
  );
}

interface UserAvatarStackProps {
  users: Array<{ userName: string; color: string }>;
  max?: number;
  size?: "sm" | "md";
}

export function UserAvatarStack({ users, max = 4, size = "sm" }: UserAvatarStackProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user, i) => (
        <UserAvatar key={i} name={user.userName} color={user.color} size={size} className="ring-1 ring-background" />
      ))}
      {remaining > 0 && (
        <div className={`rounded-full flex items-center justify-center bg-muted text-muted-foreground font-medium ring-1 ring-background ${size === "sm" ? "size-6 text-xs" : "size-8 text-sm"}`}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
