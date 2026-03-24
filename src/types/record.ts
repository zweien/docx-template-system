export interface RecordListItem {
  id: string;
  templateName: string;
  status: string; // RecordStatus enum value
  createdAt: string;
  fileName: string | null;
}

export interface RecordDetail {
  id: string;
  templateId: string;
  templateName: string;
  formData: Record<string, string>;
  status: string;
  fileName: string | null;
  filePath: string | null;
  errorMessage: string | null;
  createdAt: string;
}
