import { invoke } from "@tauri-apps/api/core";
import type { TemplateMeta } from "../stores/app-store";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function pickFileBrowser(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file?.name || null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function listTemplates(): Promise<TemplateMeta[]> {
  if (!isTauri) return [];
  return invoke("list_templates");
}

export async function importTemplate(sourcePath: string): Promise<TemplateMeta> {
  return invoke("import_template", { sourcePath });
}

export async function deleteTemplate(id: string): Promise<void> {
  return invoke("delete_template", { id });
}

export async function renameTemplate(id: string, newName: string): Promise<void> {
  return invoke("rename_template", { id, newName });
}

export async function selectExcel(): Promise<string | null> {
  if (!isTauri) return pickFileBrowser(".xlsx,.xls");
  return invoke("select_excel");
}

export async function selectDocx(): Promise<string | null> {
  if (!isTauri) return pickFileBrowser(".docx");
  return invoke("select_docx");
}

export async function selectOutputDir(): Promise<string | null> {
  if (!isTauri) return null;
  return invoke("select_output_dir");
}

export async function saveFileAs(suggestedName: string): Promise<string | null> {
  if (!isTauri) return null;
  return invoke("save_file_as", { suggestedName });
}

export async function openReport(path: string): Promise<void> {
  return invoke("open_report", { path });
}

export async function saveReportAs(sourcePath: string, suggestedName: string): Promise<string | null> {
  return invoke("save_report_as", { sourcePath, suggestedName });
}

export async function getAppDataDir(): Promise<string> {
  if (!isTauri) return "/tmp/desktop-app-data";
  return invoke("get_app_data_dir");
}
