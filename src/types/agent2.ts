// ============ Conversation ============
export interface Agent2ConversationItem {
  id: string;
  title: string;
  isFavorite: boolean;
  model: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface Agent2ConversationDetail extends Agent2ConversationItem {
  userId: string;
  messages: Agent2MessageItem[];
}

// ============ Message ============
export interface Agent2MessageItem {
  id: string;
  conversationId: string;
  role: string; // "user" | "assistant"
  parts: unknown[]; // AI SDK UIMessage parts array
  attachments?: Array<{
    name: string;
    type: string;
    url?: string;
    text?: string;
  }>;
  createdAt: string;
}

// ============ Tool Confirm ============
export interface ToolConfirmResult {
  confirmed: boolean;
  result?: unknown;
  error?: string;
}

// ============ Model Config ============
export interface Agent2ModelItem {
  id: string;
  name: string;
  providerId: string;
  modelId: string;
  baseUrl: string;
  isGlobal: boolean;
  userId?: string | null;
  createdAt: string;
  // apiKey is never sent to client
}

export interface Agent2ModelCreateInput {
  name: string;
  providerId: string;
  modelId: string;
  baseUrl: string;
  apiKey?: string;
}

// ============ User Settings ============
export interface Agent2UserSettingsData {
  id: string;
  userId: string;
  autoConfirmTools: Record<string, boolean>;
  defaultModel: string;
  showReasoning: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============ Chat Request ============
export interface Agent2ChatRequest {
  messages: Array<{
    role: string;
    content: string;
    parts?: unknown[];
  }>;
  model: string;
}

// ============ Upload ============
export interface Agent2UploadResult {
  text: string;
  fileName: string;
  fileType: string;
}
