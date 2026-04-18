"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, MessageSquare, MoreHorizontal, Reply, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/data/user-avatar";
import type { CommentItem } from "@/lib/services/data-record-comment.service";

interface CommentPanelProps {
  tableId: string;
  recordId: string;
}

export function CommentPanel({ tableId, recordId }: CommentPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newContent, setNewContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}/comments`
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [tableId, recordId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (content: string, parentId?: string) => {
    if (!content.trim()) return;
    const res = await fetch(
      `/api/data-tables/${tableId}/records/${recordId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), parentId }),
      }
    );
    if (res.ok) {
      await fetchComments();
    }
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch(
      `/api/data-tables/${tableId}/records/${recordId}/comments/${commentId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await fetchComments();
    }
  };

  const handleResolve = async (commentId: string) => {
    const res = await fetch(
      `/api/data-tables/${tableId}/records/${recordId}/comments/${commentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      }
    );
    if (res.ok) {
      await fetchComments();
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const highlightMentions = (content: string) => {
    const parts = content.split(/(@\S+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-blue-600 font-medium">{part}</span>
      ) : (
        part
      )
    );
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">加载评论...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {comments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            暂无评论
          </div>
        )}
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={cn(
              "rounded-lg border p-3 space-y-2",
              comment.isResolved && "opacity-60 bg-muted/30"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserAvatar name={comment.createdByName} size="sm" />
                <div>
                  <span className="text-sm font-medium">{comment.createdByName}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {formatTime(comment.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {comment.isResolved && (
                  <span className="text-xs text-green-600 flex items-center gap-0.5">
                    <Check className="h-3 w-3" /> 已解决
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleResolve(comment.id)}>
                      <Check className="h-3.5 w-3.5 mr-2" />
                      {comment.isResolved ? "取消解决" : "标记为已解决"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReplyTo(comment.id)}>
                      <Reply className="h-3.5 w-3.5 mr-2" />
                      回复
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(comment.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="text-sm pl-8 whitespace-pre-wrap">
              {highlightMentions(comment.content)}
            </div>

            {/* Replies */}
            {comment.replies.length > 0 && (
              <div className="pl-8 space-y-2 mt-2 border-l-2 border-muted">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="pl-3 py-1">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={reply.createdByName} size="sm" />
                      <span className="text-sm font-medium">{reply.createdByName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(reply.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-auto text-muted-foreground hover:text-red-600"
                        onClick={() => handleDelete(reply.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm pl-8 whitespace-pre-wrap">
                      {highlightMentions(reply.content)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reply input */}
            {replyTo === comment.id && (
              <div className="pl-8 flex gap-2">
                <input
                  className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="回复..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && replyContent.trim()) {
                      handleSubmit(replyContent, comment.id);
                      setReplyContent("");
                      setReplyTo(null);
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setReplyTo(null); setReplyContent(""); }}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  disabled={!replyContent.trim()}
                  onClick={() => {
                    handleSubmit(replyContent, comment.id);
                    setReplyContent("");
                    setReplyTo(null);
                  }}
                >
                  发送
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New comment input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="添加评论... 使用 @用户名 提及"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && newContent.trim()) {
                handleSubmit(newContent);
                setNewContent("");
              }
            }}
          />
          <Button
            size="sm"
            disabled={!newContent.trim()}
            onClick={() => {
              handleSubmit(newContent);
              setNewContent("");
            }}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
