import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

// elections.db lives one level up from the backend folder
const db = new Database("../elections.db");

// Returns nodes + edges limited by "limit" param
app.get("/api/elections/graph", (req, res) => {
  const limit = Number(req.query.limit) || 150;

  const nodes = db
    .prepare(
      `
    SELECT 
      id,
      name,
      type,
      COALESCE((SELECT SUM(total_amount) FROM edges WHERE target_entity_id = entities.id), 0) AS total_in,
      COALESCE((SELECT SUM(total_amount) FROM edges WHERE source_entity_id = entities.id), 0) AS total_out
    FROM entities
    ORDER BY (total_in + total_out) DESC
    LIMIT ?
  `,
    )
    .all(limit);

  if (nodes.length === 0) return res.json({ nodes: [], links: [] });

  const ids = nodes.map((n) => n.id);
  const placeholders = ids.map(() => "?").join(",");

  const links = db
    .prepare(
      `
    SELECT 
      id,
      source_entity_id AS source,
      target_entity_id AS target,
      total_amount AS amount
    FROM edges
    WHERE source_entity_id IN (${placeholders})
      AND target_entity_id IN (${placeholders})
  `,
    )
    .all(...ids, ...ids);

  res.json({ nodes, links });
});

// Simple search for entities by name
app.get("/api/elections/search", (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.json([]);

  const rows = db
    .prepare(
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
