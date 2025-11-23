#!/usr/bin/env node

import Database from 'better-sqlite3';

const dbPath = process.argv[2] || 'document_analysis.db';
const db = new Database(dbPath);

console.log('\n=== Document Analysis Database Summary ===\n');

// Total documents
const totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
console.log(`Total documents: ${totalDocs.count}`);

// Total RDF triples
const totalTriples = db.prepare('SELECT COUNT(*) as count FROM rdf_triples').get() as { count: number };
console.log(`Total RDF triples: ${totalTriples.count}`);

// Documents by category
console.log('\nDocuments by category:');
const categories = db.prepare(`
  SELECT category, COUNT(*) as count
  FROM documents
  GROUP BY category
  ORDER BY count DESC
`).all() as { category: string; count: number }[];

for (const cat of categories) {
  console.log(`  - ${cat.category}: ${cat.count}`);
}

// Most common actors
console.log('\nTop actors (by mentions in RDF triples):');
const actors = db.prepare(`
  SELECT actor, COUNT(*) as mention_count
  FROM rdf_triples
  GROUP BY actor
  ORDER BY mention_count DESC
  LIMIT 10
`).all() as { actor: string; mention_count: number }[];

for (const actor of actors) {
  console.log(`  - ${actor.actor}: ${actor.mention_count} mentions`);
}

// Most common actions
console.log('\nTop actions (by frequency):');
const actions = db.prepare(`
  SELECT action, COUNT(*) as action_count
  FROM rdf_triples
  GROUP BY action
  ORDER BY action_count DESC
  LIMIT 10
`).all() as { action: string; action_count: number }[];

for (const action of actions) {
  console.log(`  - ${action.action}: ${action.action_count} times`);
}

// Sample relationships
console.log('\nSample relationships (with timestamps):');
const sampleTriples = db.prepare(`
  SELECT timestamp, actor, action, target, location
  FROM rdf_triples
  WHERE timestamp IS NOT NULL
  ORDER BY timestamp
  LIMIT 10
`).all() as { timestamp: string; actor: string; action: string; target: string; location: string | null }[];

for (const triple of sampleTriples) {
  const locationStr = triple.location ? ` @ ${triple.location}` : '';
  console.log(`  [${triple.timestamp}] ${triple.actor} → ${triple.action} → ${triple.target}${locationStr}`);
}

// Cost summary
console.log('\nCost summary:');
const costSummary = db.prepare(`
  SELECT
    SUM(cost_usd) as total_cost,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(cache_read_tokens) as total_cache_read_tokens
  FROM documents
`).get() as {
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
};

console.log(`  Total cost: $${costSummary.total_cost.toFixed(4)}`);
console.log(`  Input tokens: ${costSummary.total_input_tokens.toLocaleString()}`);
console.log(`  Output tokens: ${costSummary.total_output_tokens.toLocaleString()}`);
console.log(`  Cache read tokens: ${costSummary.total_cache_read_tokens.toLocaleString()}`);

db.close();
console.log('\n');
