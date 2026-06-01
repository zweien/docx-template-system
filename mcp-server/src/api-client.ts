/**
 * API client for docx-template-system v1 data table endpoints.
 * All requests use Bearer token auth (API Token).
 */

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8060";
const API_TOKEN = process.env.API_TOKEN || "";

if (!API_TOKEN) {
  console.error("ERROR: API_TOKEN environment variable is required");
  process.exit(1);
}

const baseHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// v1 API wraps responses in { data: ... } or { error: { code, message } }
interface ApiResponse<T> {
  data: T;
}

interface ApiErrorResponse {
  error: { code: string; message: string };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${API_BASE_URL}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: baseHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let code = "UNKNOWN";
    let message = text;
    try {
      const json = JSON.parse(text) as ApiErrorResponse;
      code = json.error?.code || code;
      message = json.error?.message || message;
    } catch {}
    throw new ApiError(res.status, code, message);
  }

  const json = (await res.json()) as ApiResponse<T>;
  return json.data;
}

// --- Type definitions ---

export interface TableSummary {
  id: string;
  name: string;
  description?: string;
  fieldCount: number;
  recordCount?: number;
  createdAt: string;
}

export interface DataTableDetail {
  id: string;
  name: string;
  description?: string;
  fields: DataField[];
  recordCount?: number;
  createdAt: string;
}

export interface DataField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: Record<string, unknown>;
  relationTo?: string;
  displayField?: string;
  relationCardinality?: "SINGLE" | "MULTIPLE";
  relationSchema?: Record<string, unknown>;
  defaultValue?: string;
}

export interface RecordItem {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface ListRecordsResult {
  records: RecordItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// --- API functions ---

export const api = {
  listTables(): Promise<TableSummary[]> {
    return request<TableSummary[]>("GET", "/data-tables");
  },

  getTable(tableId: string): Promise<DataTableDetail> {
    return request<DataTableDetail>("GET", `/data-tables/${tableId}`);
  },

  listRecords(
    tableId: string,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: Record<string, string | { op: string; value: string }>;
    },
  ): Promise<ListRecordsResult> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.search) qs.set("search", params.search);
    if (params?.filters) {
      for (const [key, val] of Object.entries(params.filters)) {
        if (typeof val === "string") {
          qs.set(`filters[${key}]`, val);
        } else {
          qs.set(`filters[${key}][${val.op}]`, val.value);
        }
      }
    }
    const query = qs.toString();
    return request<ListRecordsResult>(
      "GET",
      `/data-tables/${tableId}/records${query ? `?${query}` : ""}`,
    );
  },

  createRecord(
    tableId: string,
    data: Record<string, unknown>,
  ): Promise<RecordItem> {
    return request<RecordItem>("POST", `/data-tables/${tableId}/records`, { data });
  },

  updateRecord(
    tableId: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<RecordItem> {
    return request<RecordItem>("PATCH", `/data-tables/${tableId}/records/${recordId}`, { data });
  },

  deleteRecord(tableId: string, recordId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>("DELETE", `/data-tables/${tableId}/records/${recordId}`);
  },
};
