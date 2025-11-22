import Database from 'better-sqlite3';

const db = new Database('document_analysis.db');

console.log('🔍 Finding and removing exact duplicate triples\n');

// Step 1: Count total triples before
const beforeCount = db.prepare('SELECT COUNT(*) as count FROM rdf_triples').get() as { count: number };
console.log(`Total triples before dedupe: ${beforeCount.count}`);

// Step 2: Find duplicates based on all key fields
console.log('\nAnalyzing duplicates...');
const duplicatesQuery = db.prepare(`
  SELECT
    doc_id,
    COALESCE(timestamp, '') as timestamp,
    actor,
    action,
    target,
    COALESCE(location, '') as location,
    COUNT(*) as dup_count,
    GROUP_CONCAT(id) as ids
  FROM rdf_triples
  GROUP BY doc_id, timestamp, actor, action, target, location
  HAVING COUNT(*) > 1
`);

const duplicates = duplicatesQuery.all() as Array<{
  doc_id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  location: string;
  dup_count: number;
  ids: string;
}>;

console.log(`Found ${duplicates.length} sets of duplicates\n`);

if (duplicates.length === 0) {
  console.log('✅ No duplicates found!');
  db.close();
  process.exit(0);
}

// Step 3: Show some examples
console.log('Sample duplicates:');
for (let i = 0; i < Math.min(5, duplicates.length); i++) {
  const dup = duplicates[i];
  console.log(`  ${i + 1}. Actor: "${dup.actor}" → Action: "${dup.action}" → Target: "${dup.target}"`);
  console.log(`     Doc: ${dup.doc_id}, Count: ${dup.dup_count}, IDs: ${dup.ids}`);
}

// Step 4: Delete duplicates (keep the one with the lowest ID)
console.log('\nDeleting duplicate triples (keeping lowest ID)...');
let totalDeleted = 0;

const deleteStmt = db.prepare('DELETE FROM rdf_triples WHERE id = ?');

for (const dup of duplicates) {
  const ids = dup.ids.split(',').map(id => parseInt(id));
  // Sort IDs and keep the first one (lowest)
  ids.sort((a, b) => a - b);
  const toDelete = ids.slice(1); // Delete all except the first

  for (const id of toDelete) {
    deleteStmt.run(id);
    totalDeleted++;
  }
}

console.log(`✓ Deleted ${totalDeleted} duplicate triples\n`);

// Step 5: Count total triples after
const afterCount = db.prepare('SELECT COUNT(*) as count FROM rdf_triples').get() as { count: number };
console.log(`Total triples after dedupe: ${afterCount.count}`);
console.log(`Difference: ${beforeCount.count - afterCount.count}\n`);

// Step 6: Vacuum database to reclaim space
console.log('Running VACUUM to reclaim space...');
db.exec('VACUUM');
console.log('✓ VACUUM complete\n');

console.log('✅ Dedupe complete!\n');

db.close();
