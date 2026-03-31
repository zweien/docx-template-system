import { describe, expect, it } from "vitest";

import {
  encodeStreamEvent,
  isStreamEvent,
  parseStreamEvent,
} from "./stream-events";

describe("stream-events", () => {
  it("应识别合法的 text-delta 事件", () => {
    const event = {
      type: "text-delta",
      messageId: "msg-1",
      content: "你好",
    };

    expect(isStreamEvent(event)).toBe(true);
  });

  it("应编码为 SSE data 行", () => {
    const encoded = encodeStreamEvent({
      type: "confirm-required",
      messageId: "msg-2",
      confirmToken: "token-1",
      content: "请确认执行",
    });

    expect(encoded).toBe(
      'data: {"type":"confirm-required","messageId":"msg-2","confirmToken":"token-1","content":"请确认执行"}\n\n'
    );
  });

  it("应从 SSE data 行解析事件", () => {
    const parsed = parseStreamEvent(
      'data: {"type":"message-completed","messageId":"msg-3"}'
    );

    expect(parsed).toEqual({
      type: "message-completed",
      messageId: "msg-3",
    });
  });

  it("应拒绝未知事件", () => {
    expect(() =>
      parseStreamEvent('data: {"type":"unknown","messageId":"msg-3"}')
    ).toThrow("无效的流式事件");
  });
});
