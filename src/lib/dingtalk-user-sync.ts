import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import type { DingtalkUserInfo } from "@/lib/dingtalk";

interface DingtalkUserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  dingtalkOpenId: string | null;
  dingtalkUnionId: string | null;
  dingtalkNick: string | null;
}

function buildDisplayName(info: DingtalkUserInfo): string {
  return info.nick?.trim() || `钉钉用户_${info.openId.slice(0, 6)}`;
}

function buildPlaceholderEmail(openId: string): string {
  return `dingtalk_${openId.slice(0, 8)}@dingtalk.local`;
}

export async function syncDingtalkUser(
  userInfo: DingtalkUserInfo
): Promise<DingtalkUserRecord> {
  const existing = await db.user.findUnique({
    where: { dingtalkOpenId: userInfo.openId },
  });

  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        name: buildDisplayName(userInfo),
        dingtalkUnionId: info.unionId || existing.dingtalkUnionId,
        dingtalkNick: info.nick || existing.dingtalkNick,
      },
    });
  }

  return db.user.create({
    data: {
      email: buildPlaceholderEmail(userInfo.openId),
      name: buildDisplayName(userInfo),
      role: "USER" as Role,
      dingtalkOpenId: userInfo.openId,
      dingtalkUnionId: info.unionId,
      dingtalkNick: info.nick,
      authProvider: "dingtalk",
    },
  });
}
