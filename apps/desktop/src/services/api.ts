import { invoke } from "@tauri-apps/api/core";
import { ParseRequest, ParseResponse, RenderRequest, RenderResponse, BudgetConfig } from "../types";

async function getBaseUrl(): Promise<string> {
  const info = (await invoke("get_sidecar_port")) as { port: number };
  return `http://127.0.0.1:${info.port}`;
}

export async function parseExcel(req: ParseRequest): Promise<ParseResponse> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/parse-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function renderReport(req: RenderRequest): Promise<RenderResponse> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function listConfigs(): Promise<{ configs: BudgetConfig[] }> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/configs`);
  return res.json();
}

export async function parseTemplate(templatePath: string): Promise<{
  structure: {
    context_vars: string[];
    sections: { id: string; placeholder: string; flag_name: string; title: string }[];
    attachments_bundle: { placeholder: string; flag_name: string } | null;
  };
  warnings: string[];
}> {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/parse-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_path: templatePath }),
  });
  return res.json();
}
