import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markOnboardingCompleted } from "@/lib/services/onboarding.service";

export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await markOnboardingCompleted(session.user.id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(result.data);
}
