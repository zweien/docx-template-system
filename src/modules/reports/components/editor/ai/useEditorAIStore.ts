import { create } from "zustand";
import type { PinnedSelection } from "@/types/editor-ai";

let _idCounter = 0;
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${++_idCounter}`;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pinnedSelections?: PinnedSelection[];
  timestamp: number;
}

interface EditorAIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  actionDialogOpen: boolean;
  actionDialogSelection: string;
  actionDialogBlockIds: string[];
  actionDialogContext: string;
  openActionDialog: (selection: string, blockIds: string[], context: string) => void;
  closeActionDialog: () => void;

  actionDialogResult: string;
  actionDialogExecuting: boolean;
  setActionDialogResult: (result: string) => void;
  setActionDialogExecuting: (executing: boolean) => void;
  resetActionDialogResult: () => void;

  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;

  pinnedSelections: PinnedSelection[];
  addPinnedSelection: (sel: Omit<PinnedSelection, "id" | "timestamp">) => void;
  removePinnedSelection: (id: string) => void;
  clearPinnedSelections: () => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;

  sectionContent: string;
  setSectionContent: (content: string) => void;
}

export const useEditorAIStore = create<EditorAIState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  actionDialogOpen: false,
  actionDialogSelection: "",
  actionDialogBlockIds: [],
  actionDialogContext: "",
  openActionDialog: (selection, blockIds, context) =>
    set({ actionDialogOpen: true, actionDialogSelection: selection, actionDialogBlockIds: blockIds, actionDialogContext: context }),
  closeActionDialog: () =>
    set({ actionDialogOpen: false, actionDialogSelection: "", actionDialogBlockIds: [], actionDialogContext: "" }),

  actionDialogResult: "",
  actionDialogExecuting: false,
  setActionDialogResult: (result) => set({ actionDialogResult: result }),
  setActionDialogExecuting: (executing) => set({ actionDialogExecuting: executing }),
  resetActionDialogResult: () => set({ actionDialogResult: "", actionDialogExecuting: false }),

  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: generateId(), timestamp: Date.now() },
      ],
    })),
  clearMessages: () => set({ messages: [] }),

  pinnedSelections: [],
  addPinnedSelection: (sel) =>
    set((state) => {
      if (state.pinnedSelections.length >= 5) return state;
      return {
        pinnedSelections: [
          ...state.pinnedSelections,
          { ...sel, id: generateId(), timestamp: Date.now() },
        ],
      };
    }),
  removePinnedSelection: (id) =>
    set((state) => ({
      pinnedSelections: state.pinnedSelections.filter((s) => s.id !== id),
    })),
  clearPinnedSelections: () => set({ pinnedSelections: [] }),

  selectedModel: "",
  setSelectedModel: (model) => set({ selectedModel: model }),

  sectionContent: "",
  setSectionContent: (content) => set({ sectionContent: content }),
}));
