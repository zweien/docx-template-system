"use client";

import { DataTableLink } from "./data-table-link";
import type { TemplateFieldMapping } from "@/types/template";

interface DataTableLinkWrapperProps {
  templateId: string;
  dataTableId: string | null;
  dataTable: { id: string; name: string } | null;
  fieldMapping: TemplateFieldMapping | null;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
}

export function DataTableLinkWrapper({
  templateId,
  dataTableId,
  dataTable,
  fieldMapping,
  placeholders,
}: DataTableLinkWrapperProps) {
  return (
    <DataTableLink
      templateId={templateId}
      dataTableId={dataTableId}
      dataTable={dataTable}
      fieldMapping={fieldMapping}
      placeholders={placeholders}
      onUpdate={() => {
        // 触发页面刷新
        window.location.reload();
      }}
    />
  );
}
