import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { aggregateRecords } from '@/lib/ai-agent/tools';
import { aggregateRequestSchema } from '@/validators/ai-agent';
import type { FilterCondition } from '@/lib/ai-agent/types';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = aggregateRequestSchema.parse(body);

    const result = await aggregateRecords(
      validated.tableId,
      validated.field,
      validated.operation,
      validated.filters as FilterCondition[] | undefined
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: '数据验证失败' }, { status: 400 });
    }
    return NextResponse.json({ error: '聚合失败' }, { status: 500 });
  }
}