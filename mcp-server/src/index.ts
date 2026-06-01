import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { api, ApiError, type RecordItem } from "./api-client.js";

const server = new McpServer({
  name: "docx-data",
  version: "0.1.0",
});

function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    return `API Error (${err.code}): ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

function formatRecord(r: { id: string; data: Record<string, unknown> }): string {
  const fields = Object.entries(r.data)
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ");
  return `  [${r.id}] ${fields}`;
}

/** Fetch ALL records across pages (auto-paginates) */
async function fetchAllRecords(
  tableId: string,
  params?: {
    search?: string;
    filters?: Record<string, string | { op: string; value: string }>;
  },
): Promise<RecordItem[]> {
  const allRecords: RecordItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await api.listRecords(tableId, { ...params, page, pageSize: 200 });
    allRecords.push(...result.records);
    totalPages = result.totalPages;
    page++;
  } while (page <= totalPages);

  return allRecords;
}

// ============================================================
// Discovery tools
// ============================================================

server.tool(
  "list_tables",
  "List all data tables with their fields. Returns table names, IDs, and field summaries. Use this first to discover available tables before operating on records.",
  {},
  async () => {
    try {
      const tables = await api.listTables();
      const lines = tables.map((t) => {
        const desc = t.description ? ` — ${t.description}` : "";
        const records = t.recordCount != null ? ` (${t.recordCount} records)` : "";
        return `## ${t.name} (ID: ${t.id})${desc}${records}\n${t.fieldCount} fields`;
      });
      return {
        content: [
          {
            type: "text" as const,
            text: lines.length
              ? `Found ${tables.length} tables:\n\n${lines.join("\n\n")}`
              : "No data tables found.",
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

server.tool(
  "get_table_schema",
  "Get the complete field schema for a data table, including types, options (for SELECT/MULTISELECT), relation targets, and required flags. Essential before creating or updating records to understand what fields are available.",
  { tableId: z.string().describe("The data table ID (get it from list_tables)") },
  async ({ tableId }) => {
    try {
      const table = await api.getTable(tableId);
      const fields = table.fields
        .map((f) => {
          let desc = `- ${f.key}: ${f.type}${f.required ? " (required)" : ""}`;
          if (f.type === "SELECT" || f.type === "MULTISELECT") {
            const opts = f.options?.options as string[] | undefined;
            if (opts) desc += ` — options: ${opts.join(", ")}`;
          }
          if (f.type === "RELATION" || f.type === "RELATION_SUBTABLE") {
            desc += ` → relates to table ${f.relationTo || "?"}`;
            if (f.relationCardinality) desc += ` (${f.relationCardinality})`;
          }
          if (f.type === "FORMULA" && f.options?.formula) {
            desc += ` — formula: ${f.options.formula}`;
          }
          return desc;
        })
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `# ${table.name}\n\n${fields}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

// ============================================================
// CRUD tools
// ============================================================

server.tool(
  "list_records",
  "Query records from a data table. Supports text search, field-level filters, and auto-pagination. Use filters for precise queries like { publish_year: '2025', index_type: 'SCI' }.",
  {
    tableId: z.string().describe("The data table ID"),
    search: z.string().optional().describe("Search keyword to filter records across all text fields"),
    filters: z.record(z.string()).optional().describe("Field-level exact-match filters, e.g. { \"publish_year\": \"2025\", \"index_type\": \"SCI\" }"),
    page: z.number().optional().describe("Page number (default: 1)"),
    pageSize: z.number().optional().describe("Records per page (max: 200, default: 50)"),
  },
  async ({ tableId, search, filters, page, pageSize }) => {
    try {
      const result = await api.listRecords(tableId, {
        search,
        filters: filters && Object.keys(filters).length > 0 ? filters : undefined,
        page,
        pageSize,
      });
      const header = `${result.total} records (page ${result.page}/${result.totalPages}):\n`;
      const records = result.records.map(formatRecord);
      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n${records.join("\n")}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

server.tool(
  "create_record",
  "Create a new record in a data table. The data object keys must match field keys from get_table_schema. Values must match field types (e.g., numbers for NUMBER, ISO date strings for DATE, option values for SELECT).",
  {
    tableId: z.string().describe("The data table ID"),
    data: z.record(z.unknown()).describe("Field values as key-value pairs. Keys are field keys from the schema."),
  },
  async ({ tableId, data }) => {
    try {
      const record = await api.createRecord(tableId, data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Created record ${record.id}:\n${JSON.stringify(record.data, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

server.tool(
  "update_record",
  "Update fields of an existing record. Only the fields provided in data will be changed; other fields remain unchanged.",
  {
    tableId: z.string().describe("The data table ID"),
    recordId: z.string().describe("The record ID to update"),
    data: z.record(z.unknown()).describe("Field values to update. Only specified fields are changed."),
  },
  async ({ tableId, recordId, data }) => {
    try {
      const record = await api.updateRecord(tableId, recordId, data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated record ${record.id}:\n${JSON.stringify(record.data, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

server.tool(
  "delete_record",
  "Delete a record from a data table. This also removes all relation links involving this record. This action is irreversible.",
  {
    tableId: z.string().describe("The data table ID"),
    recordId: z.string().describe("The record ID to delete"),
  },
  async ({ tableId, recordId }) => {
    try {
      await api.deleteRecord(tableId, recordId);
      return {
        content: [{ type: "text" as const, text: `Deleted record ${recordId}` }],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

// ============================================================
// Advanced tools
// ============================================================

server.tool(
  "find_or_create",
  "Search for a record by a field value; create it if not found. Perfect for deduplication — e.g., 'find author named X, or create if new'. Uses server-side field filtering for accurate matching.",
  {
    tableId: z.string().describe("The data table ID"),
    searchField: z.string().describe("The field key to search by"),
    searchValue: z.string().describe("The value to match"),
    data: z.record(z.unknown()).describe("Complete field values used if creating a new record. Include the searchField too."),
  },
  async ({ tableId, searchField, searchValue, data }) => {
    try {
      const result = await api.listRecords(tableId, {
        filters: { [searchField]: searchValue },
        pageSize: 100,
      });

      if (result.records.length > 0) {
        const existing = result.records[0];
        return {
          content: [
            {
              type: "text" as const,
              text: `Found existing record ${existing.id}:\n${JSON.stringify(existing.data, null, 2)}`,
            },
          ],
        };
      }

      const record = await api.createRecord(tableId, data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Created new record ${record.id}:\n${JSON.stringify(record.data, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

server.tool(
  "upsert_record",
  "Find a record by a unique field value. If found, update it with the provided data. If not found, create a new record. Uses server-side field filtering for accurate matching.",
  {
    tableId: z.string().describe("The data table ID"),
    searchField: z.string().describe("The field key to match (should be unique)"),
    searchValue: z.string().describe("The value to match"),
    data: z.record(z.unknown()).describe("Field values to set (merged with existing if updating)"),
  },
  async ({ tableId, searchField, searchValue, data }) => {
    try {
      const result = await api.listRecords(tableId, {
        filters: { [searchField]: searchValue },
        pageSize: 100,
      });

      if (result.records.length > 0) {
        const existing = result.records[0];
        const record = await api.updateRecord(tableId, existing.id, data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Updated existing record ${record.id}:\n${JSON.stringify(record.data, null, 2)}`,
            },
          ],
        };
      }

      const record = await api.createRecord(tableId, data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Created new record ${record.id}:\n${JSON.stringify(record.data, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

server.tool(
  "batch_create",
  "Create multiple records in a data table in sequence. Reports successes and failures individually. Useful for importing data.",
  {
    tableId: z.string().describe("The data table ID"),
    records: z.array(z.record(z.unknown())).describe("Array of field-value objects, one per record to create"),
  },
  async ({ tableId, records }) => {
    const results: string[] = [];
    let created = 0;
    let failed = 0;

    for (let i = 0; i < records.length; i++) {
      try {
        const record = await api.createRecord(tableId, records[i]);
        results.push(`  [${i + 1}] Created ${record.id}`);
        created++;
      } catch (err) {
        results.push(`  [${i + 1}] FAILED: ${formatError(err)}`);
        failed++;
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Batch create: ${created} succeeded, ${failed} failed out of ${records.length}\n${results.join("\n")}`,
        },
      ],
    };
  },
);

server.tool(
  "link_records",
  "Link two records via a RELATION or RELATION_SUBTABLE field. Updates the source record's relation field to point to the target record. For RELATION fields, the value is the target record ID. For RELATION_SUBTABLE, the value is an array of objects with targetRecordId.",
  {
    tableId: z.string().describe("The source data table ID"),
    recordId: z.string().describe("The source record ID"),
    fieldKey: z.string().describe("The relation field key on the source table"),
    targetRecordId: z.string().describe("The target record ID to link to"),
    append: z.boolean().optional().describe("For MULTIPLE cardinality relations: append instead of replace (default: false, replaces)"),
  },
  async ({ tableId, recordId, fieldKey, targetRecordId, append }) => {
    try {
      // If append is true, we need to fetch existing record first
      let data: Record<string, unknown>;
      if (append) {
        const existing = await fetchAllRecords(tableId);
        const record = existing.find((r) => r.id === recordId);
        const existingValue = record?.data[fieldKey];
        if (Array.isArray(existingValue)) {
          data = { [fieldKey]: [...existingValue, { targetRecordId }] };
        } else if (existingValue && typeof existingValue === "object" && "id" in existingValue) {
          data = { [fieldKey]: [{ targetRecordId: (existingValue as { id: string }).id }, { targetRecordId }] };
        } else {
          data = { [fieldKey]: [{ targetRecordId }] };
        }
      } else {
        data = { [fieldKey]: targetRecordId };
      }

      const result = await api.updateRecord(tableId, recordId, data);
      return {
        content: [
          {
            type: "text" as const,
            text: `Linked record ${recordId} → ${targetRecordId} via field "${fieldKey}"\nResult: ${JSON.stringify(result.data[fieldKey], null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return { content: [{ type: "text" as const, text: formatError(err) }] };
    }
  },
);

// ============================================================
// Start server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed:", err);
  process.exit(1);
});
