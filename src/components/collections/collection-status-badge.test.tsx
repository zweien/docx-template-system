import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionStatusBadge } from "./collection-status-badge";

describe("CollectionStatusBadge", () => {
  it("应渲染待提交状态", () => {
    render(<CollectionStatusBadge status="PENDING" />);

    expect(screen.getByText("待提交")).toBeInTheDocument();
  });

  it("应渲染已提交状态", () => {
    render(<CollectionStatusBadge status="SUBMITTED" />);

    expect(screen.getByText("已提交")).toBeInTheDocument();
  });

  it("应渲染逾期状态", () => {
    render(<CollectionStatusBadge status="LATE" />);

    expect(screen.getByText("已逾期")).toBeInTheDocument();
  });
});
