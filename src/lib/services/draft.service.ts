import { db } from "@/lib/db";

// ── Unified return type ──

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// ── Public API ──

export async function listDrafts(
  userId: string
): Promise<ServiceResult<
  {
    id: string;
    templateId: string;
    formData: unknown;
    createdAt: Date;
    updatedAt: Date;
    template: { name: string; fileName: string };
  }[]
>> {
  try {
    const drafts = await db.draft.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: { template: { select: { name: true, fileName: true } } },
    });

    return { success: true, data: drafts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取草稿列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function saveDraft(
  userId: string,
  templateId: string,
  formData: Record<string, string>
): Promise<ServiceResult<{ id: string }>> {
  try {
    // Check if a draft already exists for this user + template combination
    const existing = await db.draft.findFirst({
      where: { userId, templateId },
    });

    if (existing) {
      // Update the existing draft
      await db.draft.update({
        where: { id: existing.id },
        data: { formData },
      });
      return { success: true, data: { id: existing.id } };
    }

    // Create a new draft
    const draft = await db.draft.create({
      data: { userId, templateId, formData },
    });
    return { success: true, data: { id: draft.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存草稿失败";
    return { success: false, error: { code: "SAVE_FAILED", message } };
  }
}

export async function getDraft(
  id: string
): Promise<
  ServiceResult<{
    id: string;
    templateId: string;
    userId: string;
    formData: unknown;
    createdAt: Date;
    updatedAt: Date;
    template: { name: string; fileName: string };
  } | null>
> {
  try {
    const draft = await db.draft.findUnique({
      where: { id },
      include: { template: { select: { name: true, fileName: true } } },
    });

    if (!draft) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "草稿不存在" },
      };
    }

    return { success: true, data: draft };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取草稿失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function updateDraft(
  id: string,
  userId: string,
  formData: Record<string, string>
): Promise<ServiceResult<{ id: string }>> {
  try {
    // Verify ownership
    const draft = await db.draft.findUnique({ where: { id } });
    if (!draft) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "草稿不存在" },
      };
    }
    if (draft.userId !== userId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "无权操作此草稿" },
      };
    }

    await db.draft.update({
      where: { id },
      data: { formData },
    });

    return { success: true, data: { id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新草稿失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteDraft(
  id: string,
  userId: string
): Promise<ServiceResult<null>> {
  try {
    // Verify ownership
    const draft = await db.draft.findUnique({ where: { id } });
    if (!draft) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "草稿不存在" },
      };
    }
    if (draft.userId !== userId) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "无权操作此草稿" },
      };
    }

    await db.draft.delete({ where: { id } });
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除草稿失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
