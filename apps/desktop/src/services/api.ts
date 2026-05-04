import { invoke } from "@tauri-apps/api/core";
import { ParseRequest, ParseResponse, RenderRequest, RenderResponse, ExcelValidationResponse, BudgetConfig, MergeInfoResponse, MergeExcelResponse, MergeExcelRequest } from "../types";
import { useAppStore } from "../stores/app-store";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function parseExcel(req: ParseRequest): Promise<ParseResponse> {
  if (isTauri) {
    try {
      const result = await invoke<string>("sidecar_post", {
        path: "/api/parse-excel",
        body: JSON.stringify(req),
      });
      return JSON.parse(result);
    } catch (e) {
      return { success: false, content: undefined, warnings: [], error: { code: "FETCH_ERROR", message: String(e) } };
    }
  }
  // Browser fallback
  const base = await getBaseUrlBrowser();
  const res = await fetch(`${base}/api/parse-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function renderReport(req: RenderRequest): Promise<RenderResponse> {
  if (isTauri) {
    try {
      const result = await invoke<string>("sidecar_post", {
        path: "/api/render",
        body: JSON.stringify(req),
      });
      return JSON.parse(result);
    } catch (e) {
      return { success: false, error: { code: "FETCH_ERROR", message: String(e) } };
    }
  }
  const base = await getBaseUrlBrowser();
  const res = await fetch(`${base}/api/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
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
  if (isTauri) {
    const result = await invoke<string>("sidecar_post", {
      path: "/api/parse-template",
      body: JSON.stringify({ template_path: templatePath }),
    });
    return JSON.parse(result);
  }
  const base = await getBaseUrlBrowser();
  const res = await fetch(`${base}/api/parse-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_path: templatePath }),
  });
  return res.json();
}

const SIDECAR_PORT_RANGE = [50000, 60000];

async function getBaseUrlBrowser(): Promise<string> {
  const store = useAppStore.getState();
  if (store.sidecarPort) {
    return `http://127.0.0.1:${store.sidecarPort}`;
  }
  const port = await detectSidecarPortBrowser();
  if (port) {
    store.setSidecarPort(port);
    return `http://127.0.0.1:${port}`;
  }
  throw new Error("Sidecar not detected");
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

export async function validateExcelData(req: { input_path: string; config: BudgetConfig }): Promise<ExcelValidationResponse> {
  if (isTauri) {
    try {
      const result = await invoke<string>("sidecar_post", {
        path: "/api/validate-excel-data",
        body: JSON.stringify(req),
      });
      return JSON.parse(result);
    } catch (e) {
      return { success: false, config_title: "", excel_sheets: [], missing_sheets: [], summary: null, sheets: [], overall_pass: false, total_errors: 0, total_warnings: 0, error: { code: "FETCH_ERROR", message: String(e) } };
    }
  }
  const base = await getBaseUrlBrowser();
  const res = await fetch(`${base}/api/validate-excel-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}

export async function getMergeInfo(filePaths: string[]): Promise<MergeInfoResponse> {
  if (isTauri) {
    try {
      const result = await invoke<string>("sidecar_post", {
        path: "/api/merge-excel-info",
        body: JSON.stringify({ file_paths: filePaths }),
      });
      return JSON.parse(result);
    } catch (e) {
      return { success: false, files: [], common_sheets: [], error: { code: "FETCH_ERROR", message: String(e) } };
    }
  }
  const base = await getBaseUrlBrowser();
  const res = await fetch(`${base}/api/merge-excel-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_paths: filePaths }),
  });
  return res.json();
}

export async function mergeExcel(req: MergeExcelRequest): Promise<MergeExcelResponse> {
  if (isTauri) {
    try {
      const result = await invoke<string>("sidecar_post", {
        path: "/api/merge-excel",
        body: JSON.stringify(req),
      });
      return JSON.parse(result);
    } catch (e) {
      return { success: false, total_rows_added: 0, sheet_summary: {}, mismatches: [], warnings: [], error: { code: "FETCH_ERROR", message: String(e) } };
    }
  }
  const base = await getBaseUrlBrowser();
  const res = await fetch(`${base}/api/merge-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return res.json();
}
