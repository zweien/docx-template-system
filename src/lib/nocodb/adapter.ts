// src/lib/nocodb/adapter.ts

import * as nocodb from "./client";
import { mapColumns, type MappedField } from "./field-mapper";

// ---- Return types (compatible with existing system) ----

export interface TableSummary {
  id: string;
  name: string;
  fieldCount: number;
  recordCount: number;
}

export interface TableDetail {
  id: string;
  name: string;
  fields: MappedField[];
}

export interface RecordData {
  id: string | number;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResult {
  records: RecordData[];
  total: number;
  page: number;
  pageSize: number;
}

// ---- Adapter methods ----

export async function listTables(): Promise<TableSummary[]> {
  const result = await nocodb.listTables();
  return (result.list || []).map((t) => ({
    id: t.id,
    name: t.title,
    fieldCount: t.columns?.length ?? 0,
    recordCount: 0,
  }));
}

export async function getTableDetail(tableId: string): Promise<TableDetail> {
  const table = await nocodb.getTable(tableId);
  const fields = mapColumns(table.columns || []);
  return {
    id: table.id,
    name: table.title,
    fields,
  };
}

export async function getTableFields(
  tableId: string
): Promise<MappedField[]> {
  const detail = await getTableDetail(tableId);
  return detail.fields;
}

export async function listRecords(
  tableId: string,
  options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    where?: string;
    sort?: string;
    fields?: string[];
  }
): Promise<PaginatedResult> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const params: Parameters<typeof nocodb.listRecords>[1] = {
    limit: pageSize,
    offset,
  };

  if (options?.where) {
    params.where = options.where;
  }
  if (options?.sort) {
    params.sort = options.sort;
  }
  if (options?.fields?.length) {
    params.fields = options.fields.join(",");
  }

  const result = await nocodb.listRecords(tableId, params);

  return {
    records: (result.list || []).map((row) => {
      const id = row.Id as string | number | undefined;
      return {
        id: id ?? row["Id"] as string | number ?? "",
        data: Object.fromEntries(
          Object.entries(row).filter(([k]) => k !== "Id")
        ),
      };
    }),
    total: result.pageInfo?.totalRows ?? 0,
    page: result.pageInfo?.page ?? page,
    pageSize: result.pageInfo?.pageSize ?? pageSize,
  };
}

export async function getRecord(
  tableId: string,
  recordId: string | number
): Promise<RecordData> {
  const row = await nocodb.getRecord(tableId, String(recordId));
  const id = (row.Id as string | number | undefined) ?? recordId;
  return {
    id,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id")
    ),
  };
}

export async function createRecord(
  tableId: string,
  data: Record<string, unknown>
): Promise<RecordData> {
  const row = await nocodb.createRecord(tableId, data);
  const id = (row.Id as string | number | undefined) ?? "";
  return {
    id,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id")
    ),
  };
}

export async function updateRecord(
  tableId: string,
  recordId: string | number,
  data: Record<string, unknown>
): Promise<RecordData> {
  const row = await nocodb.updateRecord(tableId, recordId, data);
  const id = (row.Id as string | number | undefined) ?? recordId;
  return {
    id,
    data: Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "Id")
    ),
  };
}

export async function deleteRecord(
  tableId: string,
  recordId: string | number
): Promise<void> {
  await nocodb.deleteRecord(tableId, [recordId]);
}

export async function findRecords(
  tableId: string,
  field: string,
  value: unknown
): Promise<RecordData[]> {
  const where = `(${field},eq,${value})`;
  const result = await listRecords(tableId, { where, pageSize: 10 });
  return result.records;
}

export async function batchCreateRecords(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<RecordData[]> {
  const result = await nocodb.batchCreateRecords(tableId, records);
  return (result.list || []).map((row) => {
    const id = (row.Id as string | number | undefined) ?? "";
    return {
      id,
      data: Object.fromEntries(
        Object.entries(row).filter(([k]) => k !== "Id")
      ),
    };
  });
}

// ---- Re-exports ----

export { healthCheck, createWebhook, type NocoDBWebhook } from "./client";
export { filterToWhere, sortToNocoDB } from "./filter-mapper";
export { mapColumns, type MappedField } from "./field-mapper";
