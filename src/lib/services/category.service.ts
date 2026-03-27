import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function listCategories(): Promise<ServiceResult<unknown[]>> {
  try {
    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { templates: true } } },
    });
    return { success: true, data: categories };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取分类列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function createCategory(data: { name: string; sortOrder: number }): Promise<ServiceResult<unknown>> {
  try {
    const category = await db.category.create({ data });
    return { success: true, data: category };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { success: false, error: { code: "DUPLICATE_NAME", message: "分类名称已存在" } };
    }
    const message = error instanceof Error ? error.message : "创建分类失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function updateCategory(id: string, data: { name?: string; sortOrder?: number }): Promise<ServiceResult<unknown>> {
  try {
    const category = await db.category.update({ where: { id }, data });
    return { success: true, data: category };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { success: false, error: { code: "DUPLICATE_NAME", message: "分类名称已存在" } };
    }
    const message = error instanceof Error ? error.message : "更新分类失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function deleteCategory(id: string): Promise<ServiceResult<null>> {
  try {
    const count = await db.template.count({ where: { categoryId: id } });
    if (count > 0) {
      return { success: false, error: { code: "HAS_TEMPLATES", message: `该分类下有 ${count} 个模板，请先迁移` } };
    }
    await db.category.delete({ where: { id } });
    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除分类失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
