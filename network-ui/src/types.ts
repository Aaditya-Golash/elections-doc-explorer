export interface ElectionNode {
  id: number;
  name: string;
  type: string | null;
  total_in: number | null;
  total_out: number | null;
}

export interface ElectionLink {
  id: number;
  source: number;
  target: number;
  total_amount: number;
}

export interface ElectionGraphResponse {
  nodes: ElectionNode[];
  links: ElectionLink[];
}

// Legacy shapes retained so existing components still type-check
export interface Relationship {
  id: number;
  doc_id: string;
  timestamp: string | null;
  actor: string;
  action: string;
  target: string;
  location: string | null;
  tags: string[];
}

export interface Actor {
  name: string;
  connection_count: number;
}

export interface Stats {
  totalDocuments: { count: number };
  totalTriples: { count: number };
  totalActors: { count: number };
  categories: { category: string; count: number }[];
}

export interface Document {
  doc_id: string;
  file_path: string;
  one_sentence_summary: string;
  paragraph_summary: string;
  category: string;
  date_range_earliest: string | null;
  date_range_latest: string | null;
}

export interface TagCluster {
  id: number;
  name: string;
  exemplars: string[];
  tagCount: number;
}
