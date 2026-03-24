export const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const TEMPLATE_STATUS = {
  DRAFT: "DRAFT",
  READY: "READY",
  ARCHIVED: "ARCHIVED",
} as const;

export type TemplateStatus = (typeof TEMPLATE_STATUS)[keyof typeof TEMPLATE_STATUS];

export const RECORD_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type RecordStatus = (typeof RECORD_STATUS)[keyof typeof RECORD_STATUS];

export const PLACEHOLDER_TYPE = {
  TEXT: "TEXT",
  TEXTAREA: "TEXTAREA",
} as const;

export type PlaceholderType = (typeof PLACEHOLDER_TYPE)[keyof typeof PLACEHOLDER_TYPE];

export const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8065";
