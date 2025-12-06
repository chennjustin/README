import dotenv from 'dotenv';
import { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;

if (!connectionString) {
  // 讓啟動時就發現問題
  // 真實環境可改為丟錯給呼叫端
  console.error('缺少 DATABASE_URL 或 DATABASE_POOL_URL，請在 .env 設定 Supabase/PostgreSQL 連線字串。');
}

// 判斷是否需要 SSL：如果是 Supabase 或遠端資料庫，需要 SSL
// 本地資料庫（localhost）通常不需要 SSL
const isRemote = connectionString && (
  connectionString.includes('supabase') || 
  connectionString.includes('amazonaws') ||
  connectionString.includes('pooler') ||
  (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'))
);

const poolConfig: any = {
  connectionString,
};

// 只有遠端資料庫才需要 SSL
if (isRemote) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

export const pool = new Pool(poolConfig);

export async function query<T extends QueryResultRow = any>(
  text: string | QueryConfig<any[]>,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text as any, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


