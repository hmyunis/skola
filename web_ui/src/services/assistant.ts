import { apiFetch } from "./api";

export type AssistantRole = "user" | "assistant";

export interface AssistantHistoryMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantSuggestionsResponse {
  suggestions: string[];
}

export interface AssistantChatResponse {
  answer: string;
  model: string;
  cached: boolean;
  sources: string[];
  suggestions: string[];
}

export interface AssistantUsageResponse {
  provider: "gemini";
  model: string;
  byokRequired: true;
  hasPersonalApiKey: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  remainingRequests: number | null;
  remainingTokens: number | null;
  resetAt: string | null;
  fallbackResetAt: string;
  fallbackResetPolicy: string;
  updatedAt: string | null;
}

export async function fetchAssistantSuggestions(): Promise<AssistantSuggestionsResponse> {
  return apiFetch("/assistant/suggestions");
}

export async function fetchAssistantUsage(): Promise<AssistantUsageResponse> {
  return apiFetch("/assistant/usage");
}

export async function sendAssistantMessage(payload: {
  message: string;
  history?: AssistantHistoryMessage[];
  clientTimeZone?: string;
  clientLocale?: string;
  clientNowIso?: string;
}): Promise<AssistantChatResponse> {
  return apiFetch("/assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
