import { create } from "zustand";
import { payloadToDraftSections } from "@/modules/reports/converter/engine-to-blocknote";

type BlockNoteBlock = Record<string, unknown>;

interface DraftData {
  id: string;
  title: string;
  templateId: string;
  template: {
    id: string;
    name: string;
    filePath: string;
    parsedStructure: Record<string, unknown>;
  };
  context: Record<string, string>;
  sections: Record<string, BlockNoteBlock[]>;
  attachments: Record<string, BlockNoteBlock[]>;
  sectionEnabled: Record<string, boolean>;
  status: string;
  collaboratorIds: string[];
}

interface Payload {
  context?: Record<string, string>;
  sections?: { id: string; blocks: BlockNoteBlock[]; enabled?: boolean }[];
}

interface ReportDraftStore {
  draft: DraftData | null;
  activeSection: string;
  isDirty: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  collaboratorIds: string[];

  loadDraft: (id: string) => Promise<void>;
  setActiveSection: (id: string) => void;
  updateSection: (id: string, blocks: BlockNoteBlock[]) => void;
  updateContext: (key: string, value: string) => void;
  updateTitle: (title: string) => void;
  toggleSection: (id: string) => void;
  save: () => Promise<void>;
  exportDocx: () => Promise<void>;
  importPayload: (payload: Payload) => void;
  setCollaboratorIds: (ids: string[]) => void;
}

export const useReportDraftStore = create<ReportDraftStore>((set, get) => ({
  draft: null,
  activeSection: "",
  isDirty: false,
  saveStatus: "idle",
  collaboratorIds: [],

  loadDraft: async (id) => {
    const res = await fetch(`/api/reports/drafts/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "加载失败");
    const sectionIds = Object.keys(json.data.sections);
    set({
      draft: json.data,
      activeSection: sectionIds[0] || "",
      isDirty: false,
      saveStatus: "idle",
      collaboratorIds: json.data.collaboratorIds || [],
    });
  },

  setActiveSection: (id) => set({ activeSection: id }),

  updateSection: (id, blocks) => {
    const { draft } = get();
    if (!draft) return;
    set({
      draft: { ...draft, sections: { ...draft.sections, [id]: blocks } },
      isDirty: true,
      saveStatus: "idle",
    });
  },

  updateContext: (key, value) => {
    const { draft } = get();
    if (!draft) return;
    set({
      draft: { ...draft, context: { ...draft.context, [key]: value } },
      isDirty: true,
      saveStatus: "idle",
    });
  },

  updateTitle: (title) => {
    const { draft } = get();
    if (!draft) return;
    set({ draft: { ...draft, title }, isDirty: true, saveStatus: "idle" });
  },

  toggleSection: (id) => {
    const { draft } = get();
    if (!draft) return;
    const sectionEnabled = { ...draft.sectionEnabled, [id]: !draft.sectionEnabled[id] };
    set({ draft: { ...draft, sectionEnabled }, isDirty: true, saveStatus: "idle" });
  },

  save: async () => {
    const { draft } = get();
    if (!draft) return;
    set({ saveStatus: "saving" });
    try {
      const res = await fetch(`/api/reports/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          context: draft.context,
          sections: draft.sections,
          attachments: draft.attachments,
          sectionEnabled: draft.sectionEnabled,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      set({ isDirty: false, saveStatus: "saved" });
    } catch {
      set({ saveStatus: "error" });
    }
  },

  exportDocx: async () => {
    const { draft, save } = get();
    if (!draft) return;
    await save();
    const res = await fetch(`/api/reports/drafts/${draft.id}/export`, { method: "POST" });
    if (!res.ok) throw new Error("导出失败");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  importPayload: (payload: Payload) => {
    const { draft } = get();
    if (!draft) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newSections = payloadToDraftSections(payload as any, draft.sections as any, draft.sectionEnabled) as any;
    const newContext: Record<string, string> = { ...draft.context };
    if (payload.context) {
      for (const [key, value] of Object.entries(payload.context)) {
        if (key in newContext) newContext[key] = value;
      }
    }
    const newSectionEnabled = { ...draft.sectionEnabled };
    if (payload.sections) {
      for (const sec of payload.sections) {
        if (sec.id in newSectionEnabled && sec.enabled !== undefined) {
          newSectionEnabled[sec.id] = sec.enabled;
        }
      }
    }
    set({
      draft: { ...draft, sections: newSections, context: newContext, sectionEnabled: newSectionEnabled },
      isDirty: true,
      saveStatus: "idle",
    });
  },

  setCollaboratorIds: (ids) => set({ collaboratorIds: ids }),
}));
