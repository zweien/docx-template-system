import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  // 编辑功能待后续实现
  return NextResponse.json({ error: '编辑功能尚未实现' }, { status: 501 });
}