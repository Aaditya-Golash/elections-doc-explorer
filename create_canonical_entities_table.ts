import Database from 'better-sqlite3';

const db = new Database('document_analysis.db');

console.log('📊 Creating canonical_entities table for hop distances\n');

// Step 1: Create new table
console.log('Creating canonical_entities table...');
db.exec(`
  CREATE TABLE IF NOT EXISTS canonical_entities (
    canonical_name TEXT PRIMARY KEY,
    hop_distance_from_principal INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log('✓ Table created\n');

// Step 2: Populate with unique canonical names and their hop distances
console.log('Populating canonical_entities with unique canonical names...');
db.exec(`
  INSERT OR REPLACE INTO canonical_entities (canonical_name, hop_distance_from_principal, created_at)
  SELECT DISTINCT
    canonical_name,
    hop_distance_from_principal,
    datetime('now')
  FROM entity_aliases
  WHERE canonical_name = original_name
    AND hop_distance_from_principal IS NOT NULL
`);

const count = db.prepare('SELECT COUNT(*) as count FROM canonical_entities').get() as { count: number };
console.log(`✓ Inserted ${count.count} canonical entities\n`);

// Step 3: Create index for fast lookups
console.log('Creating index on canonical_name...');
db.exec('CREATE INDEX IF NOT EXISTS idx_canonical_entities_name ON canonical_entities(canonical_name)');
console.log('✓ Index created\n');

// Step 4: Show distribution
console.log('Hop distance distribution in canonical_entities:');
const distribution = db.prepare(`
  SELECT hop_distance_from_principal, COUNT(*) as count
  FROM canonical_entities
  GROUP BY hop_distance_from_principal
  ORDER BY hop_distance_from_principal
`).all() as Array<{ hop_distance_from_principal: number; count: number }>;

for (const row of distribution) {
  if (row.hop_distance_from_principal === 1000) {
    console.log(`  ${row.hop_distance_from_principal} hops (disconnected): ${row.count} entities`);
  } else {
    console.log(`  ${row.hop_distance_from_principal} hops: ${row.count} entities`);
  }
}

console.log('\n✅ canonical_entities table created successfully!\n');

db.close();
