import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

// elections.db lives one level up from the backend folder
const db = new Database("../elections.db");

interface ElectionNode {
  id: number;
  name: string;
  type: string | null;
  party: string | null;
  total_in: number | null;
  total_out: number | null;
}

interface ElectionLink {
  id: number;
  source: number;
  target: number;
  total_amount: number;
}

interface ElectionSearchResult {
  id: number;
  name: string;
  type: string | null;
}

interface ElectionGraphResponse {
  nodes: ElectionNode[];
  links: ElectionLink[];
}

// Returns nodes + edges limited by "limit" param
app.get("/api/elections/graph", (req, res) => {
  const limit = Number(req.query.limit) || 150;

  const nodes = db
    .prepare<[number], ElectionNode>(
      `
    SELECT 
      id,
      name,
      type,
      CASE
        WHEN UPPER(COALESCE(party, '')) LIKE 'D%' OR UPPER(party) LIKE '%DEM%' THEN 'D'
        WHEN UPPER(COALESCE(party, '')) LIKE 'R%' OR UPPER(party) LIKE '%REP%' THEN 'R'
        ELSE NULL
      END AS party,
      COALESCE((SELECT SUM(total_amount) FROM edges WHERE target_entity_id = entities.id), 0) AS total_in,
      COALESCE((SELECT SUM(total_amount) FROM edges WHERE source_entity_id = entities.id), 0) AS total_out
    FROM entities
    ORDER BY (total_in + total_out) DESC
    LIMIT ?
  `,
    )
    .all(limit);

  if (nodes.length === 0) return res.json({ nodes: [], links: [] });

  const ids = nodes.map((n: ElectionNode) => n.id);
  const placeholders = ids.map(() => "?").join(",");
  const params: number[] = [...ids, ...ids];

  const linksStmt = db
    .prepare<number[], ElectionLink>(
      `
    SELECT 
      id,
      source_entity_id AS source,
      target_entity_id AS target,
      total_amount
    FROM edges
    WHERE source_entity_id IN (${placeholders})
      AND target_entity_id IN (${placeholders})
  `,
    );
  const links = linksStmt.all(...params);

  const response: ElectionGraphResponse = { nodes, links };

  res.json(response);
});

// Simple search for entities by name
app.get("/api/elections/search", (req, res) => {
  const q = (req.query.query ?? req.query.q ?? "").toString().trim();
  if (!q) return res.json([]);

  const rows = db
    .prepare<[string], ElectionSearchResult>(
      `
    SELECT id, name, type
    FROM entities
    WHERE name LIKE '%' || ? || '%'
    LIMIT 40
  `,
    )
    .all(q);

  res.json(rows);
});

app.listen(3001, () => {
  console.log("Election API running at http://localhost:3001");
});
