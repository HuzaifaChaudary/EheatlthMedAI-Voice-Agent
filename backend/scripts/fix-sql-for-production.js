const fs = require('fs');
const path = require('path');

/**
 * Clean SQL files for production by removing:
 * 1. transaction_timeout (PostgreSQL 14+ only)
 * 2. OWNER TO postgres statements (require superuser)
 * 3. Duplicate PRIMARY KEY constraints (already defined in CREATE TABLE)
 * 4. Empty or malformed statements
 */

function cleanSQLFile(filePath) {
  console.log(`\n🔧 Cleaning ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalLength = content.length;
  let changes = 0;

  // 1. Remove transaction_timeout (PostgreSQL 14+ only, not available in all versions)
  const transactionTimeoutRegex = /SET\s+transaction_timeout\s*=\s*\d+;?\s*\n/gi;
  if (transactionTimeoutRegex.test(content)) {
    content = content.replace(transactionTimeoutRegex, '-- SET transaction_timeout removed (PostgreSQL 14+ only)\n');
    changes++;
    console.log('  ✓ Removed transaction_timeout');
  }

  // 2. Remove all OWNER TO postgres statements (require superuser privileges)
  const ownerRegex = /ALTER\s+(?:TABLE|SEQUENCE)\s+(?:ONLY\s+)?(?:public\.)?[\w_]+\s+OWNER\s+TO\s+postgres;?\s*\n/gi;
  const ownerMatches = content.match(ownerRegex);
  if (ownerMatches) {
    content = content.replace(ownerRegex, '-- OWNER TO postgres removed (not needed, requires superuser)\n');
    changes += ownerMatches.length;
    console.log(`  ✓ Removed ${ownerMatches.length} OWNER TO postgres statements`);
  }

  // 3. Remove duplicate PRIMARY KEY constraints (tables already have PRIMARY KEY from CREATE TABLE)
  // Match: ALTER TABLE ONLY public.table_name ADD CONSTRAINT table_name_pkey PRIMARY KEY (id);
  const duplicatePKRegex = /ALTER\s+TABLE\s+ONLY\s+(?:public\.)?([\w_]+)\s+ADD\s+CONSTRAINT\s+\1_pkey\s+PRIMARY\s+KEY\s+\(id\);?\s*\n/gi;
  const pkMatches = content.match(duplicatePKRegex);
  if (pkMatches) {
    content = content.replace(duplicatePKRegex, '-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)\n');
    changes += pkMatches.length;
    console.log(`  ✓ Removed ${pkMatches.length} duplicate PRIMARY KEY constraints`);
  }

  // 4. Remove standalone semicolons and empty statements
  content = content.replace(/^\s*;\s*$/gm, '');
  
  // 5. Fix statements that end with just a semicolon on new line
  content = content.replace(/;\s*\n\s*;/g, ';');

  // 6. Remove empty ALTER SEQUENCE OWNED BY statements that might cause issues
  // (These are usually fine, but we'll keep them for now)

  const newLength = content.length;
  const reduction = originalLength - newLength;
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✅ File cleaned: ${changes} changes, ${(reduction / 1024).toFixed(2)} KB reduction`);
  } else {
    console.log('  ℹ️  No changes needed');
  }

  return changes;
}

// Main execution
const sqlFiles = [
  path.join(__dirname, '..', 'config', 'db.sql'),
  path.join(__dirname, '..', 'config', 'db-updates.sql')
];

console.log('🧹 Cleaning SQL files for production...\n');

let totalChanges = 0;
sqlFiles.forEach(file => {
  if (fs.existsSync(file)) {
    totalChanges += cleanSQLFile(file);
  } else {
    console.log(`⚠️  File not found: ${path.basename(file)}`);
  }
});

console.log(`\n✨ Done! Total changes: ${totalChanges}`);
console.log('\n📝 Next steps:');
console.log('   1. Test the migrations: npm start');
console.log('   2. Verify no errors in console');
console.log('   3. Check that all tables were created');

