/**
 * Compare Redis and Postgres store implementations
 * Shows missing functions and type differences
 */

import * as fs from 'fs';
import * as path from 'path';

interface FunctionInfo {
  name: string;
  async: boolean;
  params: string;
  returnType: string;
}

interface TypeInfo {
  name: string;
  definition: string;
}

interface StoreComparison {
  storeName: string;
  redisPath: string;
  postgresPath: string;
  missingInPostgres: string[];
  missingInRedis: string[];
  typeDifferences: Array<{ name: string; redis: string; postgres: string }>;
  redisFunctions: FunctionInfo[];
  postgresFunctions: FunctionInfo[];
  redisTypes: TypeInfo[];
  postgresTypes: TypeInfo[];
}

function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Match exported functions: export async function name(...): ReturnType
  const functionRegex = /export\s+(async\s+)?function\s+(\w+)\s*\(([\s\S]*?)\)\s*:\s*([^{]+)/g;

  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push({
      name: match[2],
      async: !!match[1],
      params: match[3].trim(),
      returnType: match[4].trim(),
    });
  }

  return functions;
}

function extractTypes(content: string): TypeInfo[] {
  const types: TypeInfo[] = [];

  // Match type definitions
  const typeRegex = /export\s+type\s+(\w+)\s*=\s*([^;]+);?/g;

  let match;
  while ((match = typeRegex.exec(content)) !== null) {
    types.push({
      name: match[1],
      definition: match[2].trim().substring(0, 100), // First 100 chars
    });
  }

  return types;
}

function compareStores(storeName: string): StoreComparison | null {
  const basePath = path.join(process.cwd(), 'src', 'lib');
  const redisPath = path.join(basePath, `${storeName}StoreRedis.ts.backup`);
  const postgresPath = path.join(basePath, `${storeName}Store.ts`);

  if (!fs.existsSync(redisPath)) {
    console.log(`⚠️  No Redis backup found for ${storeName}Store`);
    return null;
  }

  if (!fs.existsSync(postgresPath)) {
    console.log(`⚠️  No Postgres version found for ${storeName}Store`);
    return null;
  }

  const redisContent = fs.readFileSync(redisPath, 'utf-8');
  const postgresContent = fs.readFileSync(postgresPath, 'utf-8');

  const redisFunctions = extractFunctions(redisContent);
  const postgresFunctions = extractFunctions(postgresContent);

  const redisTypes = extractTypes(redisContent);
  const postgresTypes = extractTypes(postgresContent);

  const redisFunctionNames = new Set(redisFunctions.map(f => f.name));
  const postgresFunctionNames = new Set(postgresFunctions.map(f => f.name));

  const missingInPostgres = redisFunctions
    .filter(f => !postgresFunctionNames.has(f.name))
    .map(f => f.name);

  const missingInRedis = postgresFunctions
    .filter(f => !redisFunctionNames.has(f.name))
    .map(f => f.name);

  // Compare types
  const typeDifferences: Array<{ name: string; redis: string; postgres: string }> = [];
  const redisTypeMap = new Map(redisTypes.map(t => [t.name, t.definition]));
  const postgresTypeMap = new Map(postgresTypes.map(t => [t.name, t.definition]));

  for (const redisType of redisTypes) {
    const postgresType = postgresTypeMap.get(redisType.name);
    if (postgresType && postgresType !== redisType.definition) {
      typeDifferences.push({
        name: redisType.name,
        redis: redisType.definition,
        postgres: postgresType,
      });
    }
  }

  return {
    storeName,
    redisPath,
    postgresPath,
    missingInPostgres,
    missingInRedis,
    typeDifferences,
    redisFunctions,
    postgresFunctions,
    redisTypes,
    postgresTypes,
  };
}

function printComparison(comparison: StoreComparison) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ${comparison.storeName}Store Comparison`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📁 Redis:     ${comparison.redisPath}`);
  console.log(`📁 Postgres:  ${comparison.postgresPath}\n`);

  // Function counts
  console.log(`📈 Function Count:`);
  console.log(`   Redis:    ${comparison.redisFunctions.length} functions`);
  console.log(`   Postgres: ${comparison.postgresFunctions.length} functions\n`);

  // Missing in Postgres
  if (comparison.missingInPostgres.length > 0) {
    console.log(`❌ Missing in Postgres (${comparison.missingInPostgres.length}):`);
    for (const funcName of comparison.missingInPostgres) {
      const func = comparison.redisFunctions.find(f => f.name === funcName);
      if (func) {
        console.log(`   - ${func.async ? 'async ' : ''}${func.name}(${func.params}): ${func.returnType}`);
      }
    }
    console.log();
  } else {
    console.log(`✅ All Redis functions implemented in Postgres\n`);
  }

  // Missing in Redis (new in Postgres)
  if (comparison.missingInRedis.length > 0) {
    console.log(`🆕 New in Postgres (${comparison.missingInRedis.length}):`);
    for (const funcName of comparison.missingInRedis) {
      const func = comparison.postgresFunctions.find(f => f.name === funcName);
      if (func) {
        console.log(`   + ${func.async ? 'async ' : ''}${func.name}(${func.params}): ${func.returnType}`);
      }
    }
    console.log();
  }

  // Type differences
  if (comparison.typeDifferences.length > 0) {
    console.log(`⚠️  Type Differences (${comparison.typeDifferences.length}):`);
    for (const diff of comparison.typeDifferences) {
      console.log(`   Type: ${diff.name}`);
      console.log(`   Redis:    ${diff.redis.substring(0, 60)}...`);
      console.log(`   Postgres: ${diff.postgres.substring(0, 60)}...`);
      console.log();
    }
  } else {
    console.log(`✅ All types match between Redis and Postgres\n`);
  }

  // Type counts
  console.log(`📝 Type Count:`);
  console.log(`   Redis:    ${comparison.redisTypes.length} types`);
  console.log(`   Postgres: ${comparison.postgresTypes.length} types\n`);
}

// Main execution
console.log('\n🔍 Comparing Redis and Postgres Store Implementations\n');

const stores = ['user', 'products', 'promotions', 'purchases', 'refund', 'alcoholTypes'];

const allComparisons: StoreComparison[] = [];

for (const storeName of stores) {
  const comparison = compareStores(storeName);
  if (comparison) {
    allComparisons.push(comparison);
    printComparison(comparison);
  }
}

// Summary
console.log(`\n${'='.repeat(80)}`);
console.log(`📊 SUMMARY`);
console.log(`${'='.repeat(80)}\n`);

let totalMissing = 0;
let totalNew = 0;
let storesWithIssues = 0;

for (const comp of allComparisons) {
  if (comp.missingInPostgres.length > 0 || comp.typeDifferences.length > 0) {
    storesWithIssues++;
    totalMissing += comp.missingInPostgres.length;
  }
  totalNew += comp.missingInRedis.length;
}

if (storesWithIssues === 0) {
  console.log(`✅ All stores have complete parity!`);
  console.log(`   ${allComparisons.length} stores compared`);
  console.log(`   ${totalNew} new functions added in Postgres\n`);
} else {
  console.log(`⚠️  Issues found:`);
  console.log(`   ${storesWithIssues} stores with missing functions`);
  console.log(`   ${totalMissing} total functions missing in Postgres`);
  console.log(`   ${totalNew} new functions added in Postgres\n`);
  console.log(`❗ Review the details above and update Postgres stores accordingly.\n`);
}

// Detailed function list for each store
console.log(`\n${'='.repeat(80)}`);
console.log(`📋 DETAILED FUNCTION LISTS`);
console.log(`${'='.repeat(80)}\n`);

for (const comp of allComparisons) {
  console.log(`\n${comp.storeName}Store:`);
  console.log(`${'─'.repeat(40)}`);

  console.log(`\nRedis Functions (${comp.redisFunctions.length}):`);
  for (const func of comp.redisFunctions) {
    const status = comp.missingInPostgres.includes(func.name) ? '❌' : '✅';
    console.log(`  ${status} ${func.name}`);
  }

  if (comp.missingInRedis.length > 0) {
    console.log(`\nNew Postgres Functions (${comp.missingInRedis.length}):`);
    for (const funcName of comp.missingInRedis) {
      console.log(`  🆕 ${funcName}`);
    }
  }
}

console.log('\n');
