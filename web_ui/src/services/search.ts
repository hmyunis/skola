import { apiFetch } from "./api";

export interface CommandPaletteSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export interface CommandPaletteSearchResponse {
  query: string;
  groups: {
    courses: CommandPaletteSearchItem[];
    assessments: CommandPaletteSearchItem[];
    resources: CommandPaletteSearchItem[];
    quizzes: CommandPaletteSearchItem[];
    posts: CommandPaletteSearchItem[];
    members: CommandPaletteSearchItem[];
  };
}

export async function searchCommandPalette(
  query: string,
  options?: { limit?: number; signal?: AbortSignal },
): Promise<CommandPaletteSearchResponse> {
  const trimmed = query.trim();
  const params = new URLSearchParams();
  params.set("q", trimmed);

  const limit = options?.limit ?? 5;
  params.set("limit", String(Math.min(Math.max(limit, 1), 8)));

  return apiFetch(`/search/command-palette?${params.toString()}`, {
    signal: options?.signal,
  });
}
