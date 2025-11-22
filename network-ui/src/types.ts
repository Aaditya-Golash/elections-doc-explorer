export interface ElectionNode {
  id: number;
  name: string;
  type: string | null;
  total_in?: number | null;
  total_out?: number | null;
}

export interface ElectionEdge {
  id: number;
  source: number;
  target: number;
  amount: number;
}

export interface ElectionGraphResponse {
  nodes: ElectionNode[];
  links: ElectionEdge[];
}
