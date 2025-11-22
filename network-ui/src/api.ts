import type { ElectionGraphResponse } from "./types";

export const API_BASE = "http://localhost:3001";

export async function fetchElectionGraph(limit: number = 150): Promise<ElectionGraphResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  const res = await fetch(`${API_BASE}/api/elections/graph?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch election graph");
  }
  return res.json();
}

export interface SearchResult {
  id: number;
  name: string;
  type: string | null;
}

export async function searchElectionEntities(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(`${API_BASE}/api/elections/search?q=${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    throw new Error("Failed to search entities");
  }
  return res.json();
}
