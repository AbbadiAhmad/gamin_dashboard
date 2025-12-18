require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gaming_dashboard'
  });

  try {
    console.log('Connected to database');

    // Check if column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'gaming_groups'
      AND COLUMN_NAME = 'show_in_dashboard'
    `, [process.env.DB_NAME || 'gaming_dashboard']);

    if (columns.length === 0) {
      console.log('Adding show_in_dashboard column...');
      await connection.query(`
        ALTER TABLE gaming_groups
        ADD COLUMN show_in_dashboard BOOLEAN DEFAULT FALSE AFTER description
      `);
      console.log('✓ Column added successfully');
    } else {
      console.log('✓ Column already exists');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
