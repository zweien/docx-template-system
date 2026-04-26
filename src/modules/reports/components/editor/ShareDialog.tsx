"use client";

import { useState } from "react";

interface ShareDialogProps {
  draftId: string;
  open: boolean;
  onClose: () => void;
  collaboratorIds: string[];
  onCollaboratorsChange: (ids: string[]) => void;
}

export function ShareDialog({
  draftId,
  open,
  onClose,
  collaboratorIds,
  onCollaboratorsChange,
}: ShareDialogProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/drafts/${draftId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "添加失败");
        return;
      }
      onCollaboratorsChange(data.collaboratorIds);
      setInput("");
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
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="输入用户 ID..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 rounded border px-2 py-1 text-sm bg-background"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !input.trim()}
            className="rounded bg-primary px-2 py-1 text-sm text-primary-foreground disabled:opacity-50"
          >
            添加
          </button>
        </div>
        {collaboratorIds.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">当前协作者：</p>
            {collaboratorIds.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between rounded bg-muted px-2 py-1"
              >
                <span className="text-xs truncate max-w-[180px]">{id}</span>
                <button
                  onClick={() => handleRemove(id)}
                  className="text-xs text-destructive hover:underline shrink-0 ml-2"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无协作者</p>
        )}
      </div>
    </div>
  );
}
