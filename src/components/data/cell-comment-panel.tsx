"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

interface CellCommentPanelProps {
  tableId: string;
  recordId: string;
  fieldKey?: string;
  fieldName?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function CellCommentPanel({ tableId, recordId, fieldKey, fieldName }: CellCommentPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newContent, setNewContent] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<UserOption[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}/comments`
      );
      if (res.ok) {
        const data: CommentItem[] = await res.json();
        const filtered = fieldKey
          ? data.filter((c) => c.fieldKey === fieldKey || c.fieldKey === null)
          : data;
        setComments(filtered);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [tableId, recordId, fieldKey]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // @mention search
  useEffect(() => {
    if (mentionQuery === null) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const q = mentionQuery || "a";
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setMentionResults(data.items ?? []);
          setShowMentions((data.items ?? []).length > 0);
          setMentionIndex(0);
        }
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [mentionQuery]);

  const handleInputChange = (value: string, textarea: HTMLTextAreaElement) => {
    const cursorPos = textarea.selectionStart;
    setNewContent(value);

    // detect @mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
    if (atMatch) {
      setMentionStart(cursorPos - atMatch[0].length);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMentions(false);
      setMentionQuery(null);
    }
  };

  const insertMention = (user: UserOption, isReply: boolean) => {
    const textarea = isReply ? replyInputRef.current : inputRef.current;
    if (!textarea) return;

    const value = isReply ? replyContent : newContent;
    const cursorPos = textarea.selectionStart;

    const atMatch = value.slice(0, cursorPos).match(/@([^@\s]*)$/);
    if (!atMatch) return;

    const start = cursorPos - atMatch[0].length;
    const newValue = value.slice(0, start) + `@${user.name} ` + value.slice(cursorPos);

    if (isReply) {
      setReplyContent(newValue);
    } else {
      setNewContent(newValue);
    }
    setShowMentions(false);
    setMentionQuery(null);

    setTimeout(() => {
      const newPos = start + user.name.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleSubmit = async (content: string, parentId?: string) => {
    if (!content.trim()) return;
    const res = await fetch(
      `/api/data-tables/${tableId}/records/${recordId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          parentId,
          fieldKey: fieldKey ?? undefined,
        }),
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

  const mentionDropdown = (isReply: boolean) => {
    if (!showMentions || mentionResults.length === 0) return null;
    const textarea = isReply ? replyInputRef.current : inputRef.current;
    const rect = textarea?.getBoundingClientRect();
    if (!rect) return null;
    return (
      <div
        className="fixed bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto z-[60]"
        style={{
          left: rect.left,
          top: rect.top - 170 > 0 ? rect.top - 170 : rect.bottom + 4,
          width: Math.min(rect.width, 320),
        }}
      >
        {mentionResults.map((user, i) => (
          <button
            key={user.id}
            type="button"
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 text-left",
              i === mentionIndex && "bg-muted/50"
            )}
            onClick={() => insertMention(user, isReply)}
            onMouseEnter={() => setMentionIndex(i)}
          >
            <UserAvatar name={user.name} size="sm" />
            <div className="min-w-0">
              <div className="font-medium truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">加载评论...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-3">
        {comments.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            暂无评论
          </div>
        )}
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={cn(
              "rounded-lg border p-2.5 space-y-1.5",
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
              <div className="pl-8 space-y-1.5 mt-1.5 border-l-2 border-muted">
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
              <div className="pl-8 relative">
                {mentionDropdown(true)}
                <div className="flex gap-2">
                  <textarea
                    ref={replyInputRef}
                    className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[32px]"
                    placeholder="回复... 输入 @ 提及用户"
                    value={replyContent}
                    rows={1}
                    onChange={(e) => {
                      setReplyContent(e.target.value);
                      const cursorPos = e.target.selectionStart;
                      const textBeforeCursor = e.target.value.slice(0, cursorPos);
                      const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
                      if (atMatch) {
                        setMentionQuery(atMatch[1]);
                      } else {
                        setShowMentions(false);
                        setMentionQuery(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (showMentions) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setMentionIndex((i) => Math.max(i - 1, 0));
                          return;
                        }
                        if (e.key === "Enter" || e.key === "Tab") {
                          e.preventDefault();
                          if (mentionResults[mentionIndex]) {
                            insertMention(mentionResults[mentionIndex], true);
                          }
                          return;
                        }
                        if (e.key === "Escape") {
                          setShowMentions(false);
                          return;
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey && replyContent.trim()) {
                        e.preventDefault();
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
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New comment input */}
      <div className="border-t p-3 relative">
        {mentionDropdown(false)}
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 text-sm border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary resize-none min-h-[36px]"
            placeholder={fieldName ? `关于「${fieldName}」的评论... 输入 @ 提及用户` : "添加评论... 输入 @ 提及用户"}
            value={newContent}
            rows={1}
            onChange={(e) => handleInputChange(e.target.value, e.target)}
            onKeyDown={(e) => {
              if (showMentions) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  if (mentionResults[mentionIndex]) {
                    insertMention(mentionResults[mentionIndex], false);
                  }
                  return;
                }
                if (e.key === "Escape") {
                  setShowMentions(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey && newContent.trim()) {
                e.preventDefault();
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
