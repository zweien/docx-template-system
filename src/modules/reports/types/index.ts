export interface ReportTemplateListItem {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplateStructure {
  context_vars: string[];
  sections: ReportSectionMeta[];
  attachments_bundle: {
    placeholder: string;
    flag_name: string;
  } | null;
  required_styles: string[];
}

export interface ReportSectionMeta {
  id: string;
  placeholder: string;
  flag_name: string;
  title: string;
  template_headings?: { text: string; level: number }[];
  required_styles?: string[];
}

export interface ReportDraftListItem {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDraftDetail {
  id: string;
  title: string;
  templateId: string;
  template: {
    id: string;
    name: string;
    filePath: string;
    parsedStructure: ReportTemplateStructure;
  };
  context: Record<string, string>;
  sections: Record<string, Record<string, unknown>[]>;
  attachments: Record<string, Record<string, unknown>[]>;
  sectionEnabled: Record<string, boolean>;
  status: string;
  collaboratorIds: string[];
  collaborators: { id: string; name: string; email: string }[];
  createdAt: string;
  updatedAt: string;
}
