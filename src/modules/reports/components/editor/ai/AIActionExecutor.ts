// src/modules/reports/components/editor/ai/AIActionExecutor.ts

export interface ExecuteAIActionOptions {
  actionId?: string;
  prompt?: string;
  selection?: string;
  context?: string;
  instruction?: string;
  model?: string;
  onChunk: (text: string) => void;
  onDone: (text: string) => void;
  onError: (message: string) => void;
  signal?: AbortSignal;
}

export async function executeAIAction(options: ExecuteAIActionOptions) {
  const {
    actionId,
    prompt,
    selection,
    context,
    instruction,
    model,
    onChunk,
    onDone,
    onError,
    signal,
  } = options;

  try {
    const res = await fetch("/api/editor-ai/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionId,
        prompt,
        selection,
        context,
        instruction,
        model,
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      onError(body || `请求失败 (${res.status})`);
      return;
    }

    // The endpoint uses toTextStreamResponse() which returns plain text chunks.
    const reader = res.body?.getReader();
    if (!reader) {
      onError("无法读取响应流");
      return;
    }

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulated += chunk;
      onChunk(accumulated);
    }

    onDone(accumulated);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // Cancellation — do not call onError
      return;
    }
    onError(err instanceof Error ? err.message : "未知错误");
  }
}
