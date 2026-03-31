import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageAttachments } from "./message-attachments";

describe("MessageAttachments", () => {
  it("应展示附件名称和状态", () => {
    render(
      <MessageAttachments
        attachments={[
          {
            id: "att-1",
            fileName: "note.txt",
            extractStatus: "completed",
            extractSummary: "这是摘要",
          },
        ]}
      />
    );

    expect(screen.getByText("note.txt")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("这是摘要")).toBeInTheDocument();
  });
});
