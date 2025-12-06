// ============================================
// 資料庫連接配置模組
// ============================================
// 此檔案提供統一的資料庫連接配置

require('dotenv').config();

// ============================================
// Supabase 配置
// ============================================
const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

// PostgreSQL 直接連接配置
const { Pool } = require('pg');
const postgresConfig = {
  connectionString: process.env.DATABASE_URL || process.env.DATABASE_POOL_URL,
};

// 建立 PostgreSQL 連接池（用於後端開發）
let postgresPool = null;
function getPostgresPool() {
  if (!postgresConfig.connectionString) {
    throw new Error('缺少 DATABASE_URL 或 DATABASE_POOL_URL 環境變數');
  }
  
  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString: postgresConfig.connectionString,
      ssl: {
        rejectUnauthorized: false // Supabase 需要 SSL
      },
      max: 20, // 最大連接數
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  
  return postgresPool;
}

// ============================================
// MongoDB 配置
// ============================================
const mongodbConfig = {
  uri: process.env.MONGODB_URI,
  database: process.env.MONGODB_DATABASE || 'book_rental_db',
};

// ============================================
// 驗證配置
// ============================================
function validateConfig() {
  const errors = [];

  // 檢查 Supabase 配置（至少需要一種連接方式）
  if (!supabaseConfig.url && !postgresConfig.connectionString) {
    errors.push('缺少 Supabase 連接配置（SUPABASE_URL 或 DATABASE_URL）');
  }

  // 檢查 MongoDB 配置
  if (!mongodbConfig.uri) {
    errors.push('缺少 MongoDB 連接配置（MONGODB_URI）');
  }

  if (errors.length > 0) {
    console.error('❌ 資料庫配置錯誤：');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('\n請檢查 .env 檔案是否正確設定。');
    console.error('參考 .env.example 檔案來設定環境變數。\n');
    return false;
  }

  return true;
}

// ============================================
// 匯出配置
// ============================================
module.exports = {
  supabase: supabaseConfig,
  postgres: postgresConfig,
  postgresPool: getPostgresPool, // 取得 PostgreSQL 連接池的函數
  mongodb: mongodbConfig,
  validate: validateConfig,
};

