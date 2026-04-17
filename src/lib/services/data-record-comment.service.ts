import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";

export interface CommentItem {
  id: string;
  recordId: string;
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
  content: string;
  parentId?: string;
  mentions?: string[];
}

type DbComment = {
  id: string;
  recordId: string;
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

  const comment = await db.dataRecordComment.create({
    data: {
      recordId: input.recordId,
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
  return { success: true, data: toCommentItem(comment as unknown as DbComment) };
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
  userId: string
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
