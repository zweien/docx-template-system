import { db } from "@/lib/db";
import { Role } from "@/generated/prisma/enums";
import { LoginClient } from "./login-client";

interface DevUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // 开发模式：查询所有有密码的本地用户
  const users: DevUser[] =
    process.env.DEV_BYPASS_AUTH === "true"
      ? await db.user.findMany({
          where: { password: { not: null } },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { role: "desc" },
        })
      : [];

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <p className="text-xs font-[510] uppercase tracking-[0.14em] text-[#7170ff]">
          IDRL
        </p>
        <h1 className="mt-2 text-[32px] font-[510] leading-[1.13] tracking-[-0.704px] text-[#f7f8f8]">
          文档填表系统
        </h1>
      </div>
      <LoginClient users={users} callbackUrl={callbackUrl || "/"} />
    </div>
  );
}
