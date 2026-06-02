// src/lib/nocodb/field-mapper.ts

// NocoDB uidt (UI Data Type) → system internal type mapping
// Reference: https://nocodb.com/docs/product-docs/developer-resources/rest-apis

export interface MappedField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: Record<string, unknown>;
  nocodbColumnId: string;
  nocodbUidt: string;
  isSystem: boolean;
  relationType?: "SINGLE" | "MULTIPLE";
  relationTargetTableId?: string;
  relationFieldId?: string;
}

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

interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string;
  meta?: string;
  required?: boolean;
  system?: boolean;
  colOptions?: {
    type: string;
    fk_related_model_id?: string;
    fk_child_column_id?: string;
    fk_parent_column_id?: string;
  };
}

export function mapColumn(column: NocoDBColumn): MappedField {
  const fieldType = UIDT_TO_FIELD_TYPE[column.uidt] || "TEXT";

  const mapped: MappedField = {
    key: column.column_name || column.title,
    label: column.title,
    type: fieldType,
    required: column.required ?? false,
    nocodbColumnId: column.id,
    nocodbUidt: column.uidt,
    isSystem: column.system ?? false,
  };

  if (
    (column.uidt === "SingleSelect" || column.uidt === "MultiSelect") &&
    column.meta
  ) {
    try {
      const meta = JSON.parse(column.meta);
      if (meta.choices) {
        mapped.options = {
          choices: meta.choices.map(
            (c: { title: string; color?: string }) => ({
              label: c.title,
              color: c.color,
            })
          ),
        };
      }
    } catch {
      // meta is not valid JSON, skip
    }
  }

  if (
    column.uidt === "Links" ||
    column.uidt === "LinkToAnotherRecord"
  ) {
    if (column.colOptions) {
      mapped.relationType =
        column.colOptions.type === "bt" ? "SINGLE" : "MULTIPLE";
      mapped.relationTargetTableId =
        column.colOptions.fk_related_model_id;
      mapped.relationFieldId = column.id;
    }
  }

  return mapped;
}

export function mapColumns(columns: NocoDBColumn[]): MappedField[] {
  return columns
    .filter((c) => !c.system)
    .map(mapColumn);
}
