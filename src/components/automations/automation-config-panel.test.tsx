import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationConfigPanel } from "@/components/automations/automation-config-panel";

describe("AutomationConfigPanel", () => {
  it("renders update-related-records action fields", () => {
    const onChange = vi.fn();

    render(
      <AutomationConfigPanel
        selectedNodeId="action-1"
        onChange={onChange}
        value={{
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-1", type: "trigger", x: 0, y: 0 },
              { id: "action-1", type: "action", x: 100, y: 0 },
            ],
            edges: [{ source: "trigger-1", target: "action-1" }],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [
            {
              id: "action-1",
              type: "update_related_records",
              relationFieldKey: "authors",
              targetScope: "all",
              values: { reviewed: true },
            },
          ],
          elseActions: [],
        }}
      />
    );

    expect(screen.getByText("关系字段 Key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("authors")).toBeInTheDocument();
    expect(screen.getByText("作用范围")).toBeInTheDocument();
    expect(screen.getByDisplayValue("all")).toBeInTheDocument();
    expect(screen.getByText("更新值 JSON")).toBeInTheDocument();
  });

  it("allows switching action type to update-related-records", () => {
    const onChange = vi.fn();

    render(
      <AutomationConfigPanel
        selectedNodeId="action-1"
        onChange={onChange}
        value={{
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-1", type: "trigger", x: 0, y: 0 },
              { id: "action-1", type: "action", x: 100, y: 0 },
            ],
            edges: [{ source: "trigger-1", target: "action-1" }],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [
            {
              id: "action-1",
              type: "add_comment",
              target: "current_record",
              content: "created",
            },
          ],
          elseActions: [],
        }}
      />
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "update_related_records" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        thenActions: [
          expect.objectContaining({
            id: "action-1",
            type: "update_related_records",
            relationFieldKey: "relation",
            targetScope: "all",
            values: {},
          }),
        ],
      })
    );
  });

  it("renders send-email action fields", () => {
    const onChange = vi.fn();

    render(
      <AutomationConfigPanel
        selectedNodeId="action-1"
        onChange={onChange}
        value={{
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-1", type: "trigger", x: 0, y: 0 },
              { id: "action-1", type: "action", x: 100, y: 0 },
            ],
            edges: [{ source: "trigger-1", target: "action-1" }],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [
            {
              id: "action-1",
              type: "send_email",
              to: "{{ actor.email }}",
              subject: "审批通知",
              body: "记录 {{ record.title }} 已变更",
            },
          ],
          elseActions: [],
        }}
      />
    );

    expect(screen.getByText("收件人")).toBeInTheDocument();
    expect(screen.getByDisplayValue("{{ actor.email }}")).toBeInTheDocument();
    expect(screen.getByText("邮件主题")).toBeInTheDocument();
    expect(screen.getByDisplayValue("审批通知")).toBeInTheDocument();
    expect(screen.getByText("邮件内容")).toBeInTheDocument();
  });

  it("allows switching action type to send-email", () => {
    const onChange = vi.fn();

    render(
      <AutomationConfigPanel
        selectedNodeId="action-1"
        onChange={onChange}
        value={{
          version: 1,
          canvas: {
            nodes: [
              { id: "trigger-1", type: "trigger", x: 0, y: 0 },
              { id: "action-1", type: "action", x: 100, y: 0 },
            ],
            edges: [{ source: "trigger-1", target: "action-1" }],
          },
          trigger: { type: "record_created" },
          condition: null,
          thenActions: [
            {
              id: "action-1",
              type: "add_comment",
              target: "current_record",
              content: "created",
            },
          ],
          elseActions: [],
        }}
      />
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "send_email" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        thenActions: [
          expect.objectContaining({
            id: "action-1",
            type: "send_email",
            to: "{{ actor.email }}",
            subject: "自动化通知：{{ recordId }}",
            body: "记录 {{ recordId }} 已触发自动化。",
          }),
        ],
      })
    );
  });
});
