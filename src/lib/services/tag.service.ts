import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function listTags(): Promise<ServiceResult<
  Array<{ id: string; name: string; _count: { templates: number } }>
>> {
  try {
    const tags = await db.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { templates: true } } },
    });
    return { success: true, data: tags };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取标签列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function createTag(data: { name: string }): Promise<ServiceResult<{ id: string; name: string }>> {
  try {
    const tag = await db.tag.create({ data });
    return { success: true, data: tag };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { success: false, error: { code: "DUPLICATE_NAME", message: "标签名称已存在" } };
    }
    const message = error instanceof Error ? error.message : "创建标签失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function deleteTag(id: string): Promise<ServiceResult<null>> {
  try {
    // First remove all join table entries, then delete the tag
    await db.tagOnTemplate.deleteMany({ where: { tagId: id } });
    await db.tag.delete({ where: { id } });
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除标签失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
