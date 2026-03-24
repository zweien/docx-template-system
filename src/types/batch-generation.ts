// src/types/batch-generation.ts

import { BatchStatus } from "@/generated/prisma/enums";

export interface BatchGenerationItem {
  id: string;
  templateId: string;
  dataTableId: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: BatchStatus;
  fileNamePattern: string | null;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
}

export interface FieldMapping {
  [placeholderKey: string]: string | null; // dataFieldKey or null
}

export interface BatchGenerationInput {
  templateId: string;
  dataTableId: string;
  recordIds: string[];
  fieldMapping: FieldMapping;
  fileNamePattern: string;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
}

export interface GeneratedRecord {
  id: string;
  fileName: string;
  dataRecordId: string;
}

export interface BatchGenerationError {
  recordId: string;
  error: string;
}

export interface BatchGenerationResult {
  success: boolean;
  batchId?: string;
  generatedRecords?: GeneratedRecord[];
  errors?: BatchGenerationError[];
  downloadUrl?: string;
}

export interface FieldMappingValidation {
  valid: boolean;
  errors: string[];
  autoMapping: FieldMapping;
}

export interface Settings {
  fileNamePattern: string;
  outputMethod: "DOWNLOAD" | "SAVE_TO_RECORDS";
}
