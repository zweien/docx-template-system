import { create } from "zustand";
import type { PinnedSelection } from "@/types/editor-ai";

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

  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
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
          { ...sel, id: crypto.randomUUID(), timestamp: Date.now() },
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
