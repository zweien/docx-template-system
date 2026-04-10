import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import type { ApiTokenPermission } from "@/generated/prisma/enums";
import { hashToken } from "@/lib/token-crypto";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface AuthenticatedUser {
  userId: string;
  role: Role;
  permission: ApiTokenPermission;
}

/**
 * Authenticate request via API Token (Bearer token in Authorization header).
 * Returns the authenticated user's ID and role on success.
 */
export async function authenticateApiToken(
  request: Request
): Promise<ServiceResult<AuthenticatedUser>> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "缺少 Authorization 头或格式错误" },
      };
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    if (!token.startsWith("idrl_")) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "无效的 API Token 格式" },
      };
    }

    const tokenHash = hashToken(token);

    const apiToken = await db.apiToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true } } },
    });

    if (!apiToken) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "无效的 API Token" },
      };
    }

    // Check revoked
    if (apiToken.revokedAt) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Token 已被撤销" },
      };
    }

    // Check expired
    if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Token 已过期" },
      };
    }

    // Check user exists
    if (!apiToken.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Token 关联用户不存在" },
      };
    }

    // Update lastUsedAt (fire-and-forget)
    db.apiToken
      .update({
        where: { id: apiToken.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return {
      success: true,
      data: {
        userId: apiToken.user.id,
        role: apiToken.user.role,
        permission: apiToken.permission,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "认证失败";
    return { success: false, error: { code: "INTERNAL_ERROR", message } };
  }
}

/** Helper: create a standardized v1 error response */
export function apiErrorResponse(
  code: string,
  message: string,
  status: number
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Check if authenticated user has write access, return error response if not */
export function requireWriteAccess(user: AuthenticatedUser): Response | null {
  if (user.permission === "READ_ONLY") {
    return apiErrorResponse("FORBIDDEN", "此 Token 仅有只读权限", 403);
  }
  return null;
}
