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
  return db.user.upsert({
    where: { dingtalkOpenId: userInfo.openId },
    update: {
      name: buildDisplayName(userInfo),
      dingtalkUnionId: userInfo.unionId || undefined,
      dingtalkNick: userInfo.nick || undefined,
    },
    create: {
      email: buildPlaceholderEmail(userInfo.openId),
      name: buildDisplayName(userInfo),
      role: "USER" as Role,
      dingtalkOpenId: userInfo.openId,
      dingtalkUnionId: userInfo.unionId,
      dingtalkNick: userInfo.nick,
      authProvider: "dingtalk",
    },
  });
}
