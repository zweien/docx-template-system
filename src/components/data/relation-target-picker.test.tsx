import { render, screen, waitFor } from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RelationTargetPicker,
  type RelationTargetOption,
} from "./relation-target-picker";

const SelectContext = createContext<{
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
} | null>(null);

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value = "",
    disabled,
    onValueChange,
    children,
  }: {
    value?: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => (
    <SelectContext.Provider
      value={{
        value,
        disabled,
        onValueChange: (nextValue: string) => onValueChange?.(nextValue),
      }}
    >
      <div>{children}</div>
    </SelectContext.Provider>
  ),
  SelectTrigger: ({
    children,
    id,
  }: {
    children: ReactNode;
    id?: string;
  }) => <button id={id}>{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
    const context = useContext(SelectContext);

    return (
      <button
        type="button"
        disabled={context?.disabled}
        data-selected={context?.value === value}
        onClick={() => context?.onValueChange(value)}
      >
        {children}
      </button>
    );
  },
}));

describe("RelationTargetPicker", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an explicit error state when relation options request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "查询失败" }),
    } as Response);

    render(
      <RelationTargetPicker
        value={null}
        onChange={vi.fn<(value: RelationTargetOption | null) => void>()}
        relationTableId="table-1"
        displayField="phone"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("加载关联记录失败")).toBeInTheDocument();
    });
  });

  it("shows an explicit error state when fetch rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    render(
      <RelationTargetPicker
        value={null}
        onChange={vi.fn<(value: RelationTargetOption | null) => void>()}
        relationTableId="table-1"
        displayField="phone"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("加载关联记录失败")).toBeInTheDocument();
    });
  });
});
