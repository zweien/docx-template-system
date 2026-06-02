// src/lib/nocodb/client.ts

const NOCODB_URL = process.env.NOCODB_URL || "http://localhost:8040";
const NOCODB_API_TOKEN = process.env.NOCODB_API_TOKEN || "";
const NOCODB_BASE_ID = process.env.NOCODB_BASE_ID || "";

export class NocoDBError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "NocoDBError";
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: { params?: Record<string, string>; body?: unknown }
): Promise<T> {
  const url = new URL(`${NOCODB_URL}${path}`);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "xc-token": NOCODB_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NocoDBError(
      res.status,
      `NOCODB_${res.status}`,
      `NocoDB API error: ${res.status} ${text}`
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Meta API ----

export interface NocoDBTable {
  id: string;
  title: string;
  baseId: string;
  columns?: NocoDBColumn[];
}

export interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string;
  meta?: string;
  required?: boolean;
  unique?: boolean;
  colOptions?: {
    type: string;
    fk_related_model_id?: string;
    fk_child_column_id?: string;
    fk_parent_column_id?: string;
    fk_mm_model_id?: string;
    fk_mm_child_column_id?: string;
    fk_mm_parent_column_id?: string;
  };
  system?: boolean;
}

export async function listTables(): Promise<{ list: NocoDBTable[] }> {
  return request("GET", `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables`);
}

export async function getTable(
  tableId: string
): Promise<NocoDBTable & { columns: NocoDBColumn[] }> {
  return request(
    "GET",
    `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables/${tableId}`
  );
}

// ---- Data API ----

export interface NocoDBRecordList {
  list: Record<string, unknown>[];
  pageInfo: {
    totalRows: number;
    page: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

export async function listRecords(
  tableId: string,
  params?: {
    where?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    fields?: string;
  }
): Promise<NocoDBRecordList> {
  const queryParams: Record<string, string> = {};
  if (params?.where) queryParams.where = params.where;
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  if (params?.sort) queryParams.sort = params.sort;
  if (params?.fields) queryParams.fields = params.fields;

  return request("GET", `/api/v2/tables/${tableId}/records`, {
    params: queryParams,
  });
}

export async function getRecord(
  tableId: string,
  recordId: string
): Promise<Record<string, unknown>> {
  const result = await request<NocoDBRecordList>(
    "GET",
    `/api/v2/tables/${tableId}/records/${recordId}`
  );
  return result.list?.[0] ?? {};
}

export async function createRecord(
  tableId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await request<{ list: Record<string, unknown>[] }>(
    "POST",
    `/api/v2/tables/${tableId}/records`,
    { body: data }
  );
  return result.list?.[0] ?? {};
}

export async function updateRecord(
  tableId: string,
  recordId: string | number,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const result = await request<{ list: Record<string, unknown>[] }>(
    "PATCH",
    `/api/v2/tables/${tableId}/records`,
    { body: { Id: recordId, ...data } }
  );
  return result.list?.[0] ?? {};
}

export async function deleteRecord(
  tableId: string,
  recordIds: (string | number)[]
): Promise<void> {
  await request("DELETE", `/api/v2/tables/${tableId}/records`, {
    body: { Ids: recordIds },
  });
}

export async function batchCreateRecords(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<{ list: Record<string, unknown>[] }> {
  return request("POST", `/api/v2/tables/${tableId}/records`, {
    body: records,
  });
}

export async function linkRecords(
  tableId: string,
  linkFieldId: string,
  recordId: string | number,
  linkedRecordIds: (string | number)[]
): Promise<void> {
  await request(
    "POST",
    `/api/v2/tables/${tableId}/links/${linkFieldId}/records/${recordId}`,
    { body: linkedRecordIds }
  );
}

// ---- Health Check ----

export async function healthCheck(): Promise<boolean> {
  try {
    await request("GET", `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables`, {
      params: { limit: "1" },
    });
    return true;
  } catch {
    return false;
  }
}

// ---- Webhooks ----

export interface NocoDBWebhook {
  id?: string;
  title: string;
  event: "after.insert" | "after.update" | "after.delete";
  active?: boolean;
  notification: {
    type: "URL";
    payload: {
      method: "POST";
      body: string;
      url: string;
      headers: { key: string; value: string }[];
    };
  };
}

export async function createWebhook(
  tableId: string,
  webhook: NocoDBWebhook
): Promise<{ id: string }> {
  return request(
    "POST",
    `/api/v2/meta/bases/${NOCODB_BASE_ID}/tables/${tableId}/hooks`,
    { body: webhook }
  );
}
