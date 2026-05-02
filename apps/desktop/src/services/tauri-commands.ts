import { invoke } from "@tauri-apps/api/core";
import type { TemplateMeta } from "../stores/app-store";

export async function listTemplates(): Promise<TemplateMeta[]> {
  return invoke("list_templates");
}

export async function importTemplate(sourcePath: string): Promise<TemplateMeta> {
  return invoke("import_template", { sourcePath });
}

export async function deleteTemplate(id: string): Promise<void> {
  return invoke("delete_template", { id });
}

export async function selectExcel(): Promise<string | null> {
  const result = (await invoke("select_excel")) as string | null;
  return result;
}

export async function selectDocx(): Promise<string | null> {
  const result = (await invoke("select_docx")) as string | null;
  return result;
}

export async function selectOutputDir(): Promise<string | null> {
  const result = (await invoke("select_output_dir")) as string | null;
  return result;
}

export async function saveFileAs(suggestedName: string): Promise<string | null> {
  const result = (await invoke("save_file_as", { suggestedName })) as string | null;
  return result;
}

export async function openReport(path: string): Promise<void> {
  return invoke("open_report", { path });
}

export async function getAppDataDir(): Promise<string> {
  return invoke("get_app_data_dir");
}
