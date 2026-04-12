// src/lib/agent2/doi-service.ts

export interface DOIPaperResult {
  title: string;
  authors: Array<{ name: string; orcid?: string }>;
  year?: number;
  publishDate?: string;
  venueName?: string;
  doi: string;
  paperType?: "journal" | "conference";
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  url?: string;
}

/**
 * 通过 DOI 从 Crossref API 获取论文元数据
 * API: https://api.crossref.org/works/{doi}
 */
export async function fetchPaperByDOI(
  doi: string
): Promise<{ success: true; data: DOIPaperResult } | { success: false; error: string }> {
  // 清理 DOI：移除 URL 前缀
  const cleanDOI = doi
    .replace(/^https?:\/\/doi\.org\//i, "")
    .replace(/^DOI:\s*/i, "")
    .trim();

  try {
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(cleanDOI)}`,
      {
        headers: { "User-Agent": "IDRL-DocxTemplateSystem/1.0 (mailto:admin@example.com)" },
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: `未找到 DOI "${cleanDOI}" 对应的论文，请检查 DOI 是否正确` };
      }
      return { success: false, error: `Crossref API 返回错误 (${response.status})` };
    }

    const json = (await response.json()) as { message: CrossrefWork };
    const item = json.message;

    // 提取作者
    const authors = (item.author ?? []).map((a) => ({
      name: [a.given, a.family].filter(Boolean).join(" "),
      orcid: a.ORCID?.replace("http://orcid.org/", ""),
    }));

    // 提取年份和日期
    const year = item.published?.["date-parts"]?.[0]?.[0]
      ?? item.created?.["date-parts"]?.[0]?.[0];
    const publishDate = item.published?.["date-parts"]?.[0]
      ? formatDateParts(item.published["date-parts"][0])
      : undefined;

    // 提取期刊/会议名
    const venueName = item["container-title"]?.[0] ?? item["event"]?.name ?? undefined;

    // 判断论文类型
    const paperType = inferPaperType(item.type);

    return {
      success: true,
      data: {
        title: item.title?.[0] ?? "",
        authors,
        year,
        publishDate,
        venueName,
        doi: cleanDOI,
        paperType,
        volume: item.volume ?? undefined,
        issue: item.issue ?? undefined,
        pages: item.page ?? undefined,
        issn: item.ISSN?.[0] ?? undefined,
        url: item.URL ?? `https://doi.org/${cleanDOI}`,
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { success: false, error: "Crossref API 请求超时，请稍后重试或手动输入论文信息" };
    }
    return { success: false, error: `DOI 查询失败: ${err instanceof Error ? err.message : "未知错误"}` };
  }
}

// ── Crossref API 类型 ──

interface CrossrefWork {
  title?: string[];
  author?: Array<{ given?: string; family?: string; ORCID?: string }>;
  published?: { "date-parts": number[][] };
  created?: { "date-parts": number[][] };
  "container-title"?: string[];
  event?: { name?: string };
  type?: string;
  volume?: string;
  issue?: string;
  page?: string;
  ISSN?: string[];
  URL?: string;
}

function formatDateParts(parts: number[]): string {
  const [y, m, d] = parts;
  if (d && m) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (m) return `${y}-${String(m).padStart(2, "0")}`;
  return String(y);
}

function inferPaperType(type?: string): "journal" | "conference" | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower.includes("proceedings") || lower.includes("conference")) return "conference";
  if (lower.includes("journal") || lower.includes("article")) return "journal";
  return undefined;
}
