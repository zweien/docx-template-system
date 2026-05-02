import { invoke } from "@tauri-apps/api/core";
import { ParseRequest, ParseResponse, RenderRequest, RenderResponse, BudgetConfig } from "../types";
import { useAppStore } from "../stores/app-store";

const SIDECAR_PORT_RANGE = [50000, 60000];

async function getBaseUrl(): Promise<string> {
  const store = useAppStore.getState();
  if (store.sidecarPort) {
    return `http://127.0.0.1:${store.sidecarPort}`;
  }
  const info = (await invoke("get_sidecar_port")) as { port: number };
  store.setSidecarPort(info.port);
  return `http://127.0.0.1:${info.port}`;
}

export async function detectSidecarPortBrowser(): Promise<number | null> {
  for (let port = SIDECAR_PORT_RANGE[0]; port <= SIDECAR_PORT_RANGE[1]; port += 100) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return port;
    } catch { /* next */ }
  }
  return null;
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
