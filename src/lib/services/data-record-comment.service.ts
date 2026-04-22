import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import { createNotifications } from "./notification.service";

export interface CommentItem {
  id: string;
  recordId: string;
  fieldKey: string | null;
  content: string;
  parentId: string | null;
  mentions: unknown;
  isResolved: boolean;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  replies: CommentItem[];
}

interface CreateCommentInput {
  recordId: string;
  fieldKey?: string;
  content: string;
  parentId?: string;
  mentions?: string[];
}

type DbComment = {
  id: string;
  recordId: string;
  fieldKey: string | null;
  content: string;
  parentId: string | null;
  mentions: unknown;
  isResolved: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { name: string } | null;
  replies: DbComment[];
};

function toCommentItem(c: DbComment): CommentItem {
  return {
    id: c.id,
    recordId: c.recordId,
    fieldKey: c.fieldKey,
    content: c.content,
    parentId: c.parentId,
    mentions: c.mentions,
    isResolved: c.isResolved,
    createdById: c.createdById,
    createdByName: c.createdBy?.name ?? "未知用户",
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    replies: (c.replies as DbComment[]).map(toCommentItem),
  };
}

export async function listComments(
  recordId: string
): Promise<ServiceResult<CommentItem[]>> {
  const rows = await db.dataRecordComment.findMany({
    where: { recordId, parentId: null },
    include: {
      createdBy: { select: { name: true } },
      replies: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return { success: true, data: (rows as unknown as DbComment[]).map(toCommentItem) };
}

export async function createComment(
  userId: string,
  input: CreateCommentInput
): Promise<ServiceResult<CommentItem>> {
  const mentions: string[] | null = input.mentions?.length
    ? input.mentions
    : (() => {
        const matches = input.content.match(/@(\S+)/g);
        return matches ? matches.map((m) => m.slice(1)) : null;
      })();

  if (input.parentId) {
    const parent = await db.dataRecordComment.findUnique({
      where: { id: input.parentId },
      select: { parentId: true },
    });
    if (!parent) {
      return { success: false, error: { code: "NOT_FOUND", message: "父评论不存在" } };
    }
    if (parent.parentId !== null) {
      return { success: false, error: { code: "INVALID_INPUT", message: "只能回复顶层评论" } };
    }
  }

  const comment = await db.dataRecordComment.create({
    data: {
      recordId: input.recordId,
      fieldKey: input.fieldKey ?? null,
      content: input.content,
      parentId: input.parentId ?? null,
      createdById: userId,
      mentions: mentions as unknown as InputJsonValue,
    },
    include: {
      createdBy: { select: { name: true } },
      replies: { include: { createdBy: { select: { name: true } } } },
    },
  });

  const result = toCommentItem(comment as unknown as DbComment);

  // Fire-and-forget notifications
  void sendCommentNotifications(userId, result, mentions);

  return { success: true, data: result };
}

export async function updateComment(
  commentId: string,
  userId: string,
  content: string
): Promise<ServiceResult<CommentItem>> {
  const existing = await db.dataRecordComment.findUnique({ where: { id: commentId } });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "评论不存在" } };
  }
  if (existing.createdById !== userId) {
    return { success: false, error: { code: "FORBIDDEN", message: "只能编辑自己的评论" } };
  }

  const comment = await db.dataRecordComment.update({
    where: { id: commentId },
    data: { content },
    include: {
      createdBy: { select: { name: true } },
      replies: { include: { createdBy: { select: { name: true } } } },
    },
  });
  return { success: true, data: toCommentItem(comment as unknown as DbComment) };
}

export async function resolveComment(
  commentId: string,
  _userId: string
): Promise<ServiceResult<CommentItem>> {
  const existing = await db.dataRecordComment.findUnique({ where: { id: commentId } });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "评论不存在" } };
  }

  const comment = await db.dataRecordComment.update({
    where: { id: commentId },
    data: { isResolved: !existing.isResolved },
    include: {
      createdBy: { select: { name: true } },
      replies: { include: { createdBy: { select: { name: true } } } },
    },
  });
  return { success: true, data: toCommentItem(comment as unknown as DbComment) };
}

export async function deleteComment(
  commentId: string,
  userId: string
): Promise<ServiceResult<void>> {
  const existing = await db.dataRecordComment.findUnique({ where: { id: commentId } });
  if (!existing) {
    return { success: false, error: { code: "NOT_FOUND", message: "评论不存在" } };
  }
  if (existing.createdById !== userId) {
    return { success: false, error: { code: "FORBIDDEN", message: "只能删除自己的评论" } };
  }

  await db.dataRecordComment.delete({ where: { id: commentId } });
  return { success: true, data: undefined };
}

export async function getUnresolvedCount(
  recordIds: string[]
): Promise<Map<string, number>> {
  if (recordIds.length === 0) return new Map();

  const rows = await db.dataRecordComment.groupBy({
    by: ["recordId"],
    where: {
      recordId: { in: recordIds },
      isResolved: false,
      parentId: null,
    },
    _count: true,
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.recordId, row._count);
  }
  return map;
}

export async function getCellCommentCounts(
  recordIds: string[]
): Promise<Map<string, Record<string, number>>> {
  if (recordIds.length === 0) return new Map();

  const rows = await db.dataRecordComment.findMany({
    where: {
      recordId: { in: recordIds },
      fieldKey: { not: null },
      isResolved: false,
    },
    select: { recordId: true, fieldKey: true },
  });

  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    if (!row.fieldKey) continue;
    const existing = map.get(row.recordId) ?? {};
    existing[row.fieldKey] = (existing[row.fieldKey] ?? 0) + 1;
    map.set(row.recordId, existing);
  }
  return map;
}

async function sendCommentNotifications(
  authorId: string,
  comment: CommentItem,
  mentions: string[] | null
) {
  const notifications: Array<{
    recipientId: string;
    type: "COMMENT_MENTION" | "COMMENT_REPLY";
    title: string;
    content: string;
  }> = [];

  // @mention notifications
  if (mentions && mentions.length > 0) {
    const mentionedUsers = await db.user.findMany({
      where: { name: { in: mentions } },
      select: { id: true, name: true },
    });
    for (const user of mentionedUsers) {
      if (user.id === authorId) continue;
      notifications.push({
        recipientId: user.id,
        type: "COMMENT_MENTION",
        title: "在评论中提及了你",
        content: comment.content.length > 100
          ? comment.content.slice(0, 100) + "..."
          : comment.content,
      });
    }
  }

  // Reply notification
  if (comment.parentId) {
    const parent = await db.dataRecordComment.findUnique({
      where: { id: comment.parentId },
      select: { createdById: true },
    });
    if (parent && parent.createdById !== authorId) {
      notifications.push({
        recipientId: parent.createdById,
        type: "COMMENT_REPLY",
        title: "回复了你的评论",
        content: comment.content.length > 100
          ? comment.content.slice(0, 100) + "..."
          : comment.content,
      });
    }
  }

  if (notifications.length > 0) {
    await createNotifications(notifications);
  }
}
