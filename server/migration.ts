import { db } from './db';
import { sql } from 'drizzle-orm';

export async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Add new columns to users table
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS current_plan_id INTEGER REFERENCES subscription_tiers(id),
      ADD COLUMN IF NOT EXISTS allowed_store_count INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0
    `);
    
    // Add new columns to store_connections table
    await db.execute(sql`
      ALTER TABLE store_connections
      ADD COLUMN IF NOT EXISTS shop_id TEXT,
      ADD COLUMN IF NOT EXISTS shop_domain TEXT,
      ADD COLUMN IF NOT EXISTS access_token TEXT,
      ADD COLUMN IF NOT EXISTS scope TEXT,
      ADD COLUMN IF NOT EXISTS total_api_requests INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_orders_processed INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP
    `);
    
    // Create api_usage table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        store_connection_id INTEGER REFERENCES store_connections(id),
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER,
        response_time INTEGER,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Create user_sessions table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        session_id TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_activity_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}