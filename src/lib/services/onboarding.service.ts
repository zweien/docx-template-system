import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function markOnboardingCompleted(
  userId: string
): Promise<ServiceResult<{ completed: boolean }>> {
  try {
    await db.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });
    return { success: true, data: { completed: true } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "更新引导状态失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}
