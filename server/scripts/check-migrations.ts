/**
 * Check migration status
 */

import { getDatabase } from '../src/services/database.js';

async function checkMigrations() {
  const db = getDatabase();
  
  try {
    // Check applied migrations
    const applied = await db.query('SELECT version, filename, applied_at FROM migrations ORDER BY id');
    console.log('\n📋 Applied Migrations:');
    applied.rows.forEach(row => {
      console.log(`  ✅ ${row.version} (${row.filename}) - ${row.applied_at}`);
    });
    
    // Check if system_assets table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_assets'
      )
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('\n✅ system_assets table exists');
      
      // Count records
      const count = await db.query('SELECT COUNT(*) FROM system_assets');
      console.log(`   Records: ${count.rows[0].count}`);
    } else {
      console.log('\n❌ system_assets table does NOT exist');
    }
    
    // Check other system tables
    const tables = ['system_asset_packs', 'system_asset_categories', 'system_asset_usage'];
    for (const table of tables) {
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      if (exists.rows[0].exists) {
        console.log(`✅ ${table} table exists`);
      } else {
        console.log(`❌ ${table} table does NOT exist`);
      }
    }
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMigrations();



