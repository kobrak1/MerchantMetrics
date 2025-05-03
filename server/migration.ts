import { db } from './db';
import { 
  users, 
  storeConnections, 
  apiUsage, 
  userSessions, 
  analyticsQueries, 
  subscriptionTiers, 
  userSubscriptions 
} from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Run database migrations to ensure schema is up to date
 * Called when server starts
 */
export async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Ensure each table exists with the latest schema
    await ensureUserTable();
    await ensureStoreConnectionsTable();
    await ensureApiUsageTable();
    await ensureUserSessionsTable();
    await ensureSubscriptionTables();
    
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}

/**
 * Ensure the users table has all required columns
 */
async function ensureUserTable() {
  // Check if users table exists
  const tableExists = await checkTableExists('users');
  
  if (!tableExists) {
    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT,
        current_plan_id INTEGER,
        allowed_store_count INTEGER,
        last_login_ip TEXT,
        last_login_at TIMESTAMP,
        session_count INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } else {
    // Check for and add missing columns
    const columns = await getTableColumns('users');
    
    if (!columns.includes('allowed_store_count')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN allowed_store_count INTEGER`);
    }
    
    if (!columns.includes('last_login_ip')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN last_login_ip TEXT`);
    }
    
    if (!columns.includes('is_admin')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false`);
      console.log('Added is_admin column to users table');
    }
    
    if (!columns.includes('last_login_at')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP`);
    }
    
    if (!columns.includes('session_count')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN session_count INTEGER`);
    }
    
    if (!columns.includes('current_plan_id')) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN current_plan_id INTEGER`);
    }
  }
}

/**
 * Ensure the store_connections table has all required columns
 */
async function ensureStoreConnectionsTable() {
  // Check if store_connections table exists
  const tableExists = await checkTableExists('store_connections');
  
  if (!tableExists) {
    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS store_connections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        platform TEXT NOT NULL,
        store_url TEXT NOT NULL,
        shop_id TEXT,
        shop_domain TEXT,
        api_key TEXT,
        api_secret TEXT,
        access_token TEXT,
        scope TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_sync_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_api_requests INTEGER,
        total_orders_processed INTEGER,
        last_webhook_at TIMESTAMP,
        token_expires_at TIMESTAMP
      )
    `);
  } else {
    // Check for and add missing columns
    const columns = await getTableColumns('store_connections');
    
    if (!columns.includes('shop_id')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN shop_id TEXT`);
    }
    
    if (!columns.includes('shop_domain')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN shop_domain TEXT`);
    }
    
    if (!columns.includes('access_token')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN access_token TEXT`);
    }
    
    if (!columns.includes('scope')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN scope TEXT`);
    }
    
    if (!columns.includes('total_api_requests')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN total_api_requests INTEGER DEFAULT 0`);
    }
    
    if (!columns.includes('total_orders_processed')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN total_orders_processed INTEGER DEFAULT 0`);
    }
    
    if (!columns.includes('last_webhook_at')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN last_webhook_at TIMESTAMP`);
    }
    
    if (!columns.includes('token_expires_at')) {
      await db.execute(sql`ALTER TABLE store_connections ADD COLUMN token_expires_at TIMESTAMP`);
    }
  }
}

/**
 * Create the API usage tracking table if it doesn't exist
 */
async function ensureApiUsageTable() {
  const tableExists = await checkTableExists('api_usage');
  
  if (!tableExists) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        store_connection_id INTEGER,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_time INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

/**
 * Create the user sessions table if it doesn't exist
 */
async function ensureUserSessionsTable() {
  const tableExists = await checkTableExists('user_sessions');
  
  if (!tableExists) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);
  }
}

/**
 * Ensure subscription-related tables exist
 */
async function ensureSubscriptionTables() {
  // Check if subscription_tiers table exists
  const tiersTableExists = await checkTableExists('subscription_tiers');
  
  if (!tiersTableExists) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS subscription_tiers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        max_orders INTEGER NOT NULL,
        price NUMERIC NOT NULL,
        features JSONB,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    
    // Insert default tiers
    await db.execute(sql`
      INSERT INTO subscription_tiers (name, max_orders, price, features, is_active)
      VALUES 
        ('Free Trial', 100, 0, '["Basic analytics", "Connect 1 store"]', TRUE),
        ('Growth Plan', 1000, 29, '["Advanced analytics", "Connect up to 3 stores", "Priority support"]', TRUE),
        ('Business Plan', 5000, 79, '["Full analytics suite", "Unlimited stores", "24/7 support", "API access"]', TRUE)
    `);
  }
  
  // Check if user_subscriptions table exists
  const subscriptionsTableExists = await checkTableExists('user_subscriptions');
  
  if (!subscriptionsTableExists) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        tier_id INTEGER NOT NULL,
        start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_date TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        is_trial BOOLEAN DEFAULT FALSE
      )
    `);
  } else {
    // Check if is_trial column exists and add it if not
    const columns = await getTableColumns('user_subscriptions');
    if (!columns.includes('is_trial')) {
      await db.execute(sql`ALTER TABLE user_subscriptions ADD COLUMN is_trial BOOLEAN DEFAULT FALSE`);
      console.log('Added is_trial column to user_subscriptions table');
    }
  }
}

/**
 * Helper to check if a table exists in the database
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    )
  `);
  
  return result.rows[0].exists;
}

/**
 * Helper to get column names for a table
 */
async function getTableColumns(tableName: string): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = ${tableName}
  `);
  
  return result.rows.map((row: any) => row.column_name);
}