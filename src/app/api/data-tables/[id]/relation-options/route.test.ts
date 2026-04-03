import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRouteSessionUserMock = vi.fn();
const getTableMock = vi.fn();
const listRecordsMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getRouteSessionUser: getRouteSessionUserMock,
}));

vi.mock("@/lib/services/data-table.service", () => ({
  getTable: getTableMock,
}));

vi.mock("@/lib/services/data-record.service", () => ({
  listRecords: listRecordsMock,
}));

describe("api/data-tables/[id]/relation-options route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters options by NUMBER displayField string values", async () => {
    getRouteSessionUserMock.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "table-1",
        name: "测试表",
        fields: [
          {
            id: "field-1",
            key: "score",
            label: "分数",
            type: "NUMBER",
            required: false,
            sortOrder: 0,
          },
        ],
      },
    });
    listRecordsMock.mockResolvedValue({
      success: true,
      data: {
        records: [
          {
            id: "record-1",
            data: { score: 1024 },
          },
          {
            id: "record-2",
            data: { score: 88 },
          },
        ],
      },
    });

    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/data-tables/table-1/relation-options?displayField=score&search=10"
      ),
      { params: Promise.resolve({ id: "table-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "record-1", label: "1024" }]);
  });
});
