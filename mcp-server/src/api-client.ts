/**
 * API client for NocoDB v2 endpoints.
 * All requests use xc-token auth (NocoDB API Token).
 */

const NOCODB_URL = process.env.NOCODB_URL || "http://localhost:8040";
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || "";
const NOCODB_BASE_ID = process.env.NOCODB_BASE_ID || "";

if (!NOCODB_API_TOKEN) {
  console.error("ERROR: NOCODB_API_TOKEN environment variable is required");
  process.exit(1);
}
if (!NOCODB_BASE_ID) {
  console.error("ERROR: NOCODB_BASE_ID environment variable is required");
  process.exit(1);
}

const baseHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  "xc-token": NOCODB_API_TOKEN,
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

async function request<T>(
  method: string,
  path: string,
  options?: { params?: Record<string, string>; body?: unknown },
): Promise<T> {
  const url = new URL(`${NOCODB_URL}${path}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: baseHeaders,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let code = `NOCODB_${res.status}`;
    let message = text;
    try {
      const json = JSON.parse(text) as { msg?: string; message?: string };
      message = json.msg || json.message || message;
    } catch {
      // text is the raw error message
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- NocoDB raw types ---

interface NocoDBTableMeta {
  id: string;
  title: string;
  base_id: string;
  table_name: string;
  columns?: NocoDBColumn[];
}

interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string;
  meta?: string;
  required?: boolean;
  unique?: boolean;
  colOptions?: {
    type?: string;
    fk_related_model_id?: string;
    fk_child_column_id?: string;
    fk_parent_column_id?: string;
  };
  system?: boolean;
}

interface NocoDBRecordList {
  list: NocoDBRecord[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

interface NocoDBRecord {
  Id: number;
  [key: string]: unknown;
}

// --- Mapped types (same public interface as before) ---

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

// --- uidt → field type mapping ---

const UIDT_TO_FIELD_TYPE: Record<string, string> = {
  SingleLineText: "TEXT",
  LongText: "TEXT",
  RichText: "RICH_TEXT",
  Number: "NUMBER",
  Decimal: "NUMBER",
  Float: "NUMBER",
  Currency: "CURRENCY",
  Percent: "PERCENTAGE",
  Duration: "DURATION",
  Date: "DATE",
  DateTime: "DATE",
  Time: "TEXT",
  Email: "EMAIL",
  PhoneNumber: "PHONE",
  URL: "URL",
  Checkbox: "BOOLEAN",
  SingleSelect: "SELECT",
  MultiSelect: "MULTISELECT",
  Rating: "RATING",
  Formula: "FORMULA",
  Rollup: "ROLLUP",
  Lookup: "LOOKUP",
  AutoNumber: "AUTO_NUMBER",
  Attachment: "FILE",
  Links: "RELATION",
  LinkToAnotherRecord: "RELATION",
  CreatedTime: "SYSTEM_TIMESTAMP",
  LastModifiedTime: "SYSTEM_TIMESTAMP",
  CreatedBy: "SYSTEM_USER",
  LastModifiedBy: "SYSTEM_USER",
  ID: "AUTO_NUMBER",
  Geometry: "TEXT",
  JSON: "TEXT",
  Barcode: "TEXT",
  QRCode: "TEXT",
  Button: "TEXT",
};

function mapNocoDBColumn(col: NocoDBColumn): DataField {
  const fieldType = UIDT_TO_FIELD_TYPE[col.uidt] || "TEXT";

  const mapped: DataField = {
    id: col.id,
    key: col.column_name || col.title,
    label: col.title,
    type: fieldType,
    required: col.required ?? false,
  };

  // Parse select/multiselect options
  if ((col.uidt === "SingleSelect" || col.uidt === "MultiSelect") && col.meta) {
    try {
      const meta = JSON.parse(col.meta);
      if (meta.choices) {
        mapped.options = {
          options: meta.choices.map((c: { title: string; color?: string }) => c.title),
        };
      }
    } catch {
      // meta is not valid JSON, skip
    }
  }

  // Parse relation info
  if (col.uidt === "Links" || col.uidt === "LinkToAnotherRecord") {
    if (col.colOptions) {
      mapped.relationCardinality =
        col.colOptions.type === "bt" ? "SINGLE" : "MULTIPLE";
      mapped.relationTo = col.colOptions.fk_related_model_id;
      mapped.relationSchema = {
        nocodbColumnId: col.id,
        nocodbColOptions: col.colOptions,
      };
    }
  }

  return mapped;
}

// --- Filter conversion: system filter format → NocoDB where clause ---

function filterValueToWhere(
  key: string,
  value: string | { op: string; value: string },
): string {
  if (typeof value === "string") {
    // Exact match: (key,eq,value)
    const escaped = /[,\(\)~"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
    return `(${key},eq,${escaped})`;
  }
  // Operator-based filter
  const opMap: Record<string, string> = {
    eq: "eq",
    ne: "neq",
    gt: "gt",
    gte: "ge",
    lt: "lt",
    lte: "le",
    contains: "like",
    not_contains: "nlike",
  };
  const nocodbOp = opMap[value.op] || "eq";
  let formattedValue: string;
  if (value.op === "contains") {
    formattedValue = `%${value.value}%`;
  } else {
    formattedValue = /[,\(\)~"]/.test(value.value)
      ? `"${value.value.replace(/"/g, '\\"')}"`
      : value.value;
  }
  return `(${key},${nocodbOp},${formattedValue})`;
}

function filtersToWhere(
  filters?: Record<string, string | { op: string; value: string }>,
): string {
  if (!filters) return "";
  const parts = Object.entries(filters).map(([k, v]) =>
    filterValueToWhere(k, v),
  );
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return parts.slice(1).reduce((acc, part) => `${acc}~and(${part})`, parts[0]);
}

// --- Extract record fields from NocoDB record ---

function toRecordItem(
  nocodbRecord: NocoDBRecord,
  tableId: string,
): RecordItem {
  const { Id, ...data } = nocodbRecord;
  // NocoDB stores relation fields as arrays of { Id, ... } or null
  // Strip NocoDB-internal fields like foreign key columns
  return {
    id: String(Id),
    tableId,
    data: data as Record<string, unknown>,
    createdAt: String(data.CreatedTime ?? ""),
    updatedAt: String(data.LastModifiedTime ?? ""),
    createdByName: undefined,
    updatedByName: undefined,
  };
}

// --- API functions (same public signatures as before) ---

export const api = {
  async listTables(): Promise<TableSummary[]> {
    const result = await request<{ list: NocoDBTableMeta[] }>(
      "GET",
      `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables`,
    );
    return (result.list ?? []).map((t) => ({
      id: t.id,
      name: t.title,
      description: undefined,
      fieldCount: t.columns?.filter((c) => !c.system)?.length ?? 0,
      recordCount: undefined,
      createdAt: "",
    }));
  },

  async getTable(tableId: string): Promise<DataTableDetail> {
    const result = await request<NocoDBTableMeta & { columns: NocoDBColumn[] }>(
      "GET",
      `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables/${tableId}`,
    );
    const nonSystemColumns = (result.columns ?? []).filter((c) => !c.system);
    return {
      id: result.id,
      name: result.title,
      description: undefined,
      fields: nonSystemColumns.map(mapNocoDBColumn),
      recordCount: undefined,
      createdAt: "",
    };
  },

  async listRecords(
    tableId: string,
    params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      filters?: Record<string, string | { op: string; value: string }>;
    },
  ): Promise<ListRecordsResult> {
    const queryParams: Record<string, string> = {};
    const limit = params?.pageSize ?? 50;
    const page = params?.page ?? 1;
    const offset = (page - 1) * limit;

    queryParams.limit = String(limit);
    queryParams.offset = String(offset);

    // Build NocoDB where clause from filters
    const where = filtersToWhere(params?.filters);
    if (where) queryParams.where = where;

    // NocoDB doesn't have a generic "search" param in the same way,
    // but we can add it as a where clause if provided
    if (params?.search && !where) {
      // Use a blanket search-like where: not natively supported,
      // so we pass through (NocoDB API may or may not handle it)
    }

    const result = await request<NocoDBRecordList>(
      "GET",
      `/api/v2/tables/${tableId}/records`,
      { params: queryParams },
    );

    const totalRows = result.pageInfo?.totalRows ?? 0;
    const totalPages = limit > 0 ? Math.ceil(totalRows / limit) : 1;

    return {
      records: (result.list ?? []).map((r) => toRecordItem(r, tableId)),
      total: totalRows,
      page,
      pageSize: limit,
      totalPages,
    };
  },

  async createRecord(
    tableId: string,
    data: Record<string, unknown>,
  ): Promise<RecordItem> {
    const result = await request<{ list: NocoDBRecord[] }>(
      "POST",
      `/api/v2/tables/${tableId}/records`,
      { body: data },
    );
    const created = result.list?.[0];
    if (!created) throw new ApiError(500, "CREATE_FAILED", "No record returned from NocoDB");
    return toRecordItem(created, tableId);
  },

  async updateRecord(
    tableId: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<RecordItem> {
    const result = await request<{ list: NocoDBRecord[] }>(
      "PATCH",
      `/api/v2/tables/${tableId}/records`,
      { body: { Id: Number(recordId), ...data } },
    );
    const updated = result.list?.[0];
    if (!updated) throw new ApiError(500, "UPDATE_FAILED", "No record returned from NocoDB");
    return toRecordItem(updated, tableId);
  },

  async deleteRecord(tableId: string, recordId: string): Promise<{ deleted: boolean }> {
    await request(
      "DELETE",
      `/api/v2/tables/${tableId}/records`,
      { body: { Ids: [Number(recordId)] } },
    );
    return { deleted: true };
  },

  // --- Additional methods used by index.ts ---

  /**
   * Link records via a NocoDB relation field.
   * Uses POST /api/v2/tables/{tableId}/links/{fieldId}/records/{recordId}
   */
  async linkRecords(
    tableId: string,
    fieldId: string,
    recordId: string | number,
    linkedRecordIds: (string | number)[],
  ): Promise<void> {
    await request(
      "POST",
      `/api/v2/tables/${tableId}/links/${fieldId}/records/${recordId}`,
      { body: linkedRecordIds.map(Number) },
    );
  },

  /**
   * Batch create records (NocoDB supports array body in POST).
   */
  async batchCreateRecords(
    tableId: string,
    records: Record<string, unknown>[],
  ): Promise<RecordItem[]> {
    const result = await request<{ list: NocoDBRecord[] }>(
      "POST",
      `/api/v2/tables/${tableId}/records`,
      { body: records },
    );
    return (result.list ?? []).map((r) => toRecordItem(r, tableId));
  },
};
