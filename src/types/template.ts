import type { PlaceholderItem } from "./placeholder";

export interface TemplateListItem {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  status: string; // TemplateStatus enum value
  createdAt: string; // ISO date string
}

export interface TemplateDetail extends TemplateListItem {
  description: string | null;
  createdById: string;
  placeholders: PlaceholderItem[];
}
