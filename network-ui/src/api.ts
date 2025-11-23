import type { Actor, Document, ElectionGraphResponse } from "./types";

export const API_BASE = "http://localhost:3001";

export async function fetchElectionGraph(limit: number = 150): Promise<ElectionGraphResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));

  const res = await fetch(`${API_BASE}/api/elections/graph?${params.toString()}`);
  if (!res.ok) {
    throw new Error("Failed to fetch election graph");
  }
  const data: ElectionGraphResponse = await res.json();
  return data;
}

export interface SearchResult {
  id: number;
  name: string;
  type: string | null;
}

export async function searchElectionEntities(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(`${API_BASE}/api/elections/search?query=${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    throw new Error("Failed to search entities");
  }
  const data: SearchResult[] = await res.json();
  return data;
}

// Legacy compatibility helpers for components that expect Epstein-era APIs
export async function searchActors(query: string): Promise<Actor[]> {
  const results = await searchElectionEntities(query);
  return results.map((r) => ({
    name: r.name,
    connection_count: 0,
  }));
}

export async function fetchDocument(_docId: string): Promise<Document> {
  throw new Error("Document API is not implemented for Election Money Explorer");
}

export async function fetchDocumentText(_docId: string): Promise<{ text: string }> {
  throw new Error("Document text API is not implemented for Election Money Explorer");
}
