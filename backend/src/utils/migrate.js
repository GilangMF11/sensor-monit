const pool = require('./db');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

async function getExecutedMigrations(client) {
  const result = await client.query('SELECT name FROM migrations ORDER BY id');
  return new Set(result.rows.map(r => r.name));
}

async function run() {
  const migrations = require('../migrations/migrationLoader');
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);
    const executed = await getExecutedMigrations(client);

    let ran = 0;
    for (const migration of migrations) {
      if (executed.has(migration.name)) {
        console.log(`  skip  ${migration.name}`);
        continue;
      }

      console.log(`  run   ${migration.name}`);
      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  FAIL  ${migration.name}: ${err.message}`);
        throw err;
      }
    }

    console.log(ran > 0 ? `\n${ran} migration(s) executed.` : '\nAlready up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
