import type { Stats, Relationship, Actor, TagCluster } from './types';

// Use relative path in production (served from same domain), localhost in development
const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

export async function fetchStats(): Promise<Stats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function fetchTagClusters(): Promise<TagCluster[]> {
  const response = await fetch(`${API_BASE}/tag-clusters`);
  if (!response.ok) throw new Error('Failed to fetch tag clusters');
  return response.json();
}

export async function fetchRelationships(limit: number = 500, clusterIds: number[] = [], categories: string[] = [], yearRange?: [number, number], includeUndated: boolean = true, keywords: string = '', maxHops?: number | null): Promise<{ relationships: Relationship[], totalBeforeLimit: number, totalBeforeFilter: number }> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (clusterIds.length > 0) {
    params.append('clusters', clusterIds.join(','));
  }
  if (categories.length > 0) {
    params.append('categories', categories.join(','));
  }
  if (yearRange) {
    params.append('yearMin', yearRange[0].toString());
    params.append('yearMax', yearRange[1].toString());
  }
  params.append('includeUndated', includeUndated.toString());
  if (keywords.trim()) {
    params.append('keywords', keywords.trim());
  }
  if (maxHops !== undefined && maxHops !== null) {
    params.append('maxHops', maxHops.toString());
  }
  const response = await fetch(`${API_BASE}/relationships?${params}`);
  if (!response.ok) throw new Error('Failed to fetch relationships');
  return response.json();
}

export async function fetchActorRelationships(name: string, clusterIds: number[] = [], categories: string[] = [], yearRange?: [number, number], includeUndated: boolean = true, keywords: string = '', maxHops?: number | null): Promise<{ relationships: Relationship[], totalBeforeFilter: number }> {
  const params = new URLSearchParams();
  if (clusterIds.length > 0) {
    params.append('clusters', clusterIds.join(','));
  }
  if (categories.length > 0) {
    params.append('categories', categories.join(','));
  }
  if (yearRange) {
    params.append('yearMin', yearRange[0].toString());
    params.append('yearMax', yearRange[1].toString());
  }
  params.append('includeUndated', includeUndated.toString());
  if (keywords.trim()) {
    params.append('keywords', keywords.trim());
  }
  if (maxHops !== undefined && maxHops !== null) {
    params.append('maxHops', maxHops.toString());
  }
  const url = `${API_BASE}/actor/${encodeURIComponent(name)}/relationships${params.toString() ? '?' + params : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch actor relationships');
  return response.json();
}

export async function searchActors(query: string): Promise<Actor[]> {
  const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('Failed to search actors');
  return response.json();
}

export async function fetchDocument(docId: string): Promise<import('./types').Document> {
  const response = await fetch(`${API_BASE}/document/${encodeURIComponent(docId)}`);
  if (!response.ok) throw new Error('Failed to fetch document');
  return response.json();
}

export async function fetchDocumentText(docId: string): Promise<{ text: string }> {
  const response = await fetch(`${API_BASE}/document/${encodeURIComponent(docId)}/text`);
  if (!response.ok) throw new Error('Failed to fetch document text');
  return response.json();
}

export async function fetchActorCounts(limit: number = 300): Promise<Record<string, number>> {
  const params = new URLSearchParams({ limit: limit.toString() });
  const response = await fetch(`${API_BASE}/actor-counts?${params}`);
  if (!response.ok) throw new Error('Failed to fetch actor counts');
  return response.json();
}

export async function fetchActorCount(name: string): Promise<number> {
  const url = `${API_BASE}/actor/${encodeURIComponent(name)}/count`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch actor count');
  const data = await response.json();
  return data.count;
}
