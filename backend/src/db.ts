import dotenv from 'dotenv';
import { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';
import path from 'path';

// 從專案根目錄讀取 .env 檔案（README 目錄）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;

if (!connectionString) {
  // 讓啟動時就發現問題
  // 真實環境可改為丟錯給呼叫端
  console.error('缺少 DATABASE_URL 或 DATABASE_POOL_URL，請在 .env 設定 Supabase/PostgreSQL 連線字串。');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

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


