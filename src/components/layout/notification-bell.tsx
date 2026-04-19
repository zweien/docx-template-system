"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { NotificationItem, NotificationType } from "@/types/notification";

const TYPE_BADGE: Record<NotificationType, { color: string; label: string }> = {
  TASK_ASSIGNED: { color: "bg-blue-500", label: "任务分配" },
  DUE_TODAY: { color: "bg-amber-500", label: "今天到期" },
  OVERDUE: { color: "bg-red-500", label: "已到期" },
  MANUAL_REMIND: { color: "bg-amber-500", label: "催办提醒" },
  COMMENT_MENTION: { color: "bg-purple-500", label: "提及通知" },
  COMMENT_REPLY: { color: "bg-green-500", label: "评论回复" },
};

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString("zh-CN");
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      const data = await res.json();
      if (data.success) {
        setUnreadCount(data.data);
      }
    } catch {
      // silently ignore
    }
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh on route change
  useEffect(() => {
    fetchUnreadCount();
  }, [pathname, fetchUnreadCount]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const fetchNotifications = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/notifications?pageSize=20");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.items);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  const handleToggle = async () => {
    if (!open) {
      // Opening: fetch fresh list (also triggers lazy-load due-check on backend)
      await fetchNotifications();
    }
    setOpen((prev) => !prev);
  };

  const handleMarkAsRead = async (notification: NotificationItem) => {
    if (notification.isRead) return;

    try {
      const res = await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notification.id] }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        setOpen(false);
        if (notification.taskId) {
          router.push(`/collections/${notification.taskId}`);
        }
      }
    } catch {
      toast.error("操作失败");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success("已全部标记为已读");
      } else {
        toast.error(data.error?.message ?? "操作失败");
      }
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button variant="ghost" size="icon" onClick={handleToggle} className="relative text-[#8a8f98] hover:text-[#f7f8f8]">
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-[rgb(255_255_255_/_0.08)] bg-[#191a1b] shadow-[0_16px_40px_rgb(0_0_0_/_0.35)]">
          <div className="flex items-center justify-between border-b border-[rgb(255_255_255_/_0.05)] px-3 py-2">
            <span className="text-sm font-[510] text-[#f7f8f8]">通知</span>
            {unreadCount > 0 ? (
              <Button variant="ghost" size="xs" onClick={handleMarkAllAsRead} className="gap-1 text-xs text-[#8a8f98] hover:text-[#f7f8f8]">
                <CheckCheck className="h-3 w-3" />
                全部已读
              </Button>
            ) : null}
          </div>

          <div className="divide-y">
            {loadingList ? (
              <div className="px-3 py-6 text-center text-sm text-[#8a8f98]">加载中...</div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#8a8f98]">暂无通知</div>
            ) : (
              notifications.map((notification) => {
                const badge = TYPE_BADGE[notification.type];
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleMarkAsRead(notification)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                      !notification.isRead ? "bg-[rgb(113_112_255_/_0.14)]" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 inline-block size-2 shrink-0 rounded-full ${badge.color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-[510] text-[#8a8f98]">{badge.label}</span>
                          <span className="text-xs text-[#62666d]">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className={`truncate text-sm ${notification.isRead ? "text-[#8a8f98]" : "text-[#f7f8f8]"}`}>
                          {notification.title}
                        </p>
                        <p className="line-clamp-1 text-xs text-[#8a8f98]">{notification.content}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-[rgb(255_255_255_/_0.05)] px-3 py-2 text-center">
            <a
              href="/notifications"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                // Navigate via router if a notifications page exists
                router.push("/notifications");
              }}
              className="text-xs text-[#8a8f98] hover:text-[#f7f8f8]"
            >
              查看全部通知
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
