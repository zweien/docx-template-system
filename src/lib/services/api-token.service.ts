import { db } from "@/lib/db";
import { hashToken, encryptToken, decryptToken, generateToken, getTokenPrefix } from "@/lib/token-crypto";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export interface ApiTokenListItem {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  isRevoked: boolean;
}

export interface ApiTokenDetail extends ApiTokenListItem {
  token: string;
}

export async function listTokens(
  userId: string
): Promise<ServiceResult<ApiTokenListItem[]>> {
  try {
    const tokens = await db.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        expiresAt: t.expiresAt,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        isRevoked: t.revokedAt !== null,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 Token 列表失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function createToken(
  userId: string,
  name: string,
  expiresInDays?: number | null
): Promise<ServiceResult<ApiTokenDetail>> {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const tokenEncrypted = encryptToken(token);
    const tokenPrefix = getTokenPrefix(token);

    let expiresAt: Date | null = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const record = await db.apiToken.create({
      data: {
        name,
        tokenHash,
        tokenEncrypted,
        tokenPrefix,
        userId,
        expiresAt,
      },
    });

    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        token,
        tokenPrefix: record.tokenPrefix,
        expiresAt: record.expiresAt,
        lastUsedAt: record.lastUsedAt,
        createdAt: record.createdAt,
        isRevoked: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建 Token 失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function getTokenDetail(
  id: string,
  userId: string
): Promise<ServiceResult<ApiTokenDetail>> {
  try {
    const record = await db.apiToken.findUnique({
      where: { id },
    });

    if (!record || record.userId !== userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Token 不存在" },
      };
    }

    const token = decryptToken(record.tokenEncrypted);

    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        token,
        tokenPrefix: record.tokenPrefix,
        expiresAt: record.expiresAt,
        lastUsedAt: record.lastUsedAt,
        createdAt: record.createdAt,
        isRevoked: record.revokedAt !== null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 Token 详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}

export async function revokeToken(
  id: string,
  userId: string
): Promise<ServiceResult<null>> {
  try {
    const record = await db.apiToken.findUnique({
      where: { id },
    });

    if (!record || record.userId !== userId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Token 不存在" },
      };
    }

    if (record.revokedAt) {
      return {
        success: false,
        error: { code: "ALREADY_REVOKED", message: "Token 已被撤销" },
      };
    }

    await db.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "撤销 Token 失败";
    return { success: false, error: { code: "REVOKE_FAILED", message } };
  }
}
