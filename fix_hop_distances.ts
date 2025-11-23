import Database from 'better-sqlite3';

const db = new Database('document_analysis.db');

console.log('🔧 Fixing hop distances: ensuring all entities have hop_distance values\n');

// Step 1: Get all unique entities from rdf_triples (both actors and targets)
console.log('Collecting all unique entities from rdf_triples...');
const actorsResult = db.prepare(`
  SELECT DISTINCT actor as name FROM rdf_triples
  UNION
  SELECT DISTINCT target as name FROM rdf_triples
`).all() as Array<{ name: string }>;

const allEntities = new Set(actorsResult.map(r => r.name));
console.log(`✓ Found ${allEntities.size} unique entities\n`);

// Step 2: Resolve entities through existing aliases to get canonical names
console.log('Resolving entities through existing aliases...');
const canonicalMap = new Map<string, string>(); // Maps any name to its canonical form

for (const entity of allEntities) {
  // Check if this entity has an alias entry
  const aliasResult = db.prepare(`
    SELECT canonical_name FROM entity_aliases WHERE original_name = ?
  `).get(entity) as { canonical_name: string } | undefined;

  if (aliasResult) {
    canonicalMap.set(entity, aliasResult.canonical_name);
  } else {
    // No alias exists, so canonical name is itself
    canonicalMap.set(entity, entity);
  }
}

// Get all unique canonical names
const canonicalNames = new Set(canonicalMap.values());
console.log(`✓ Resolved to ${canonicalNames.size} canonical entities\n`);

// Step 3: Ensure all canonical names exist in entity_aliases
console.log('Ensuring all canonical entities exist in entity_aliases...');
let inserted = 0;
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO entity_aliases (canonical_name, original_name, created_by, created_at)
  VALUES (?, ?, 'hop_fix', datetime('now'))
`);

for (const canonical of canonicalNames) {
  const result = insertStmt.run(canonical, canonical);
  if (result.changes > 0) inserted++;
}
console.log(`✓ Inserted ${inserted} new canonical entity entries\n`);

// Step 4: Build relationship graph using canonical names
console.log('Building relationship graph with canonical names...');
const relationshipsResult = db.prepare(`
  SELECT DISTINCT actor, target FROM rdf_triples
`).all() as Array<{ actor: string; target: string }>;

const adjacencyList = new Map<string, Set<string>>();

for (const rel of relationshipsResult) {
  const canonicalActor = canonicalMap.get(rel.actor)!;
  const canonicalTarget = canonicalMap.get(rel.target)!;

  if (!adjacencyList.has(canonicalActor)) {
    adjacencyList.set(canonicalActor, new Set());
  }
  if (!adjacencyList.has(canonicalTarget)) {
    adjacencyList.set(canonicalTarget, new Set());
  }

  adjacencyList.get(canonicalActor)!.add(canonicalTarget);
  adjacencyList.get(canonicalTarget)!.add(canonicalActor);
}

console.log(`✓ Built graph with ${adjacencyList.size} nodes and ${relationshipsResult.length} edges\n`);

// Step 5: BFS from Jeffrey Epstein to calculate hop distances
console.log('Calculating hop distances from Jeffrey Epstein using BFS...');
const PRINCIPAL = 'Jeffrey Epstein';
const DISCONNECTED_HOP_DISTANCE = 1000;

const hopDistances = new Map<string, number>();
const queue: { name: string; distance: number }[] = [];
const visited = new Set<string>();

// Find canonical name for Jeffrey Epstein
const principalCanonical = canonicalMap.get(PRINCIPAL) || PRINCIPAL;

if (adjacencyList.has(principalCanonical)) {
  visited.add(principalCanonical);
  hopDistances.set(principalCanonical, 0);
  queue.push({ name: principalCanonical, distance: 0 });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacencyList.get(current.name);

    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const newDistance = current.distance + 1;
          hopDistances.set(neighbor, newDistance);
          queue.push({ name: neighbor, distance: newDistance });
        }
      }
    }
  }
} else {
  console.log(`⚠️  Warning: Principal "${PRINCIPAL}" not found in graph`);
}

console.log(`✓ Calculated distances for ${hopDistances.size} connected actors\n`);

// Step 6: Set hop_distance = 1000 for all disconnected entities
console.log('Setting hop_distance = 1000 for disconnected entities...');
let disconnectedCount = 0;
for (const canonical of canonicalNames) {
  if (!hopDistances.has(canonical)) {
    hopDistances.set(canonical, DISCONNECTED_HOP_DISTANCE);
    disconnectedCount++;
  }
}
console.log(`✓ Marked ${disconnectedCount} entities as disconnected (hop_distance = 1000)\n`);

// Step 7: Update hop distances in entity_aliases
console.log('Updating hop distances in entity_aliases...');
const updateStmt = db.prepare(`
  UPDATE entity_aliases
  SET hop_distance_from_principal = ?
  WHERE canonical_name = ?
`);

let updated = 0;
for (const [canonical, distance] of hopDistances) {
  const result = updateStmt.run(distance, canonical);
  if (result.changes > 0) updated++;
}
console.log(`✓ Updated ${updated} entities with hop distances\n`);

// Step 8: Show distribution
console.log('Hop distance distribution:');
const distribution = new Map<number, number>();
for (const distance of hopDistances.values()) {
  distribution.set(distance, (distribution.get(distance) || 0) + 1);
}

const sortedDistances = Array.from(distribution.entries()).sort((a, b) => a[0] - b[0]);
for (const [distance, count] of sortedDistances) {
  if (distance === DISCONNECTED_HOP_DISTANCE) {
    console.log(`  ${distance} hops (disconnected): ${count} actors`);
  } else {
    console.log(`  ${distance} hops: ${count} actors`);
  }
}

console.log('\n✅ Hop distance fix complete!\n');

db.close();
