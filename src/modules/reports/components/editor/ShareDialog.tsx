"use client";

import { useEffect, useRef, useState } from "react";

interface UserItem {
  id: string;
  name: string;
  email: string;
}

interface ShareDialogProps {
  draftId: string;
  open: boolean;
  onClose: () => void;
  collaboratorIds: string[];
  collaborators: UserItem[];
  onCollaboratorsChange: (ids: string[]) => void;
}

export function ShareDialog({
  draftId,
  open,
  onClose,
  collaboratorIds,
  collaborators,
  onCollaboratorsChange,
}: ShareDialogProps) {
  const [input, setInput] = useState("");
  const [candidates, setCandidates] = useState<UserItem[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setInput("");
      setCandidates([]);
      setShowCandidates(false);
      setError("");
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!input.trim()) {
      setCandidates([]);
      setShowCandidates(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(input.trim())}`);
        if (!res.ok) return;
        const data = await res.json();
        const items: UserItem[] = data.items || [];
        const existing = new Set(collaboratorIds);
        setCandidates(items.filter((u: UserItem) => !existing.has(u.id)));
        setShowCandidates(items.length > 0);
      } catch {
        // silent
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [input, collaboratorIds]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowCandidates(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAdd = async (userId: string) => {
    setLoading(true);
    setError("");
    setShowCandidates(false);
    setInput("");
    try {
      const res = await fetch(`/api/reports/drafts/${draftId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "添加失败");
        return;
      }
      onCollaboratorsChange(data.collaboratorIds);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/reports/drafts/${draftId}/collaborators`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) return;
      onCollaboratorsChange(data.collaboratorIds);
    } catch {
      // silent
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border rounded-lg p-4 w-80 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">共享协作者</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            &times;
          </button>
        </div>
        {error && (
          <p className="text-xs text-destructive mb-2">{error}</p>
        )}
        <div className="relative mb-3" ref={containerRef}>
          <input
            ref={inputRef}
            type="text"
            placeholder="搜索用户名或邮箱..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm bg-background"
          />
          {showCandidates && candidates.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-card border rounded shadow-lg max-h-40 overflow-y-auto">
              {candidates.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAdd(user.id)}
                  disabled={loading}
                  className="w-full text-left px-3 py-2 hover:bg-muted disabled:opacity-50"
                >
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        {collaboratorIds.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">当前协作者：</p>
            {collaboratorIds.map((id) => {
              const user = collaborators.find((c) => c.id === id);
              return (
                <div
                  key={id}
                  className="flex items-center justify-between rounded bg-muted px-2 py-1"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-medium truncate block">
                      {user ? user.name : id}
                    </span>
                    {user && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {user.email}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(id)}
                    className="text-xs text-destructive hover:underline shrink-0 ml-2"
                  >
                    移除
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无协作者</p>
        )}
      </div>
    </div>
  );
}
