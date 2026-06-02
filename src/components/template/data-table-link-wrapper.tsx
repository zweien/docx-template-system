"use client";

import { DataTableLink } from "./data-table-link";
import type { TemplateFieldMapping } from "@/types/template";

interface DataTableLinkWrapperProps {
  templateId: string;
  dataTableId: string | null;
  fieldMapping: TemplateFieldMapping | null;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
}

export function DataTableLinkWrapper({
  templateId,
  dataTableId,
  fieldMapping,
  placeholders,
}: DataTableLinkWrapperProps) {
  return (
    <DataTableLink
      templateId={templateId}
      dataTableId={dataTableId}
      dataTable={null}
      fieldMapping={fieldMapping}
      placeholders={placeholders}
      onUpdate={() => {
        // 触发页面刷新
        window.location.reload();
      }}
    />
  );
}
