import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { chat } from '@/lib/ai-agent/service';
import { chatRequestSchema } from '@/validators/ai-agent';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '未授权' } }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = chatRequestSchema.parse(body);

    const apiKey = process.env.AI_API_KEY;
    const baseURL = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;
    if (!apiKey) {
      return NextResponse.json({ error: { code: 'CONFIG_ERROR', message: 'AI_API_KEY 未配置' } }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chat({
            message: validated.message,
            tableId: validated.tableId,
            history: validated.history,
            apiKey,
            baseURL,
            model,
          })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.close();
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: error instanceof Error ? error.message : '未知错误' })}\n\n`));
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as { errors?: unknown };
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: '数据验证失败', details: zodError.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: 'LLM_ERROR', message: error instanceof Error ? error.message : 'LLM 调用失败' } }, { status: 500 });
  }
}