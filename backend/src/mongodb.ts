import dotenv from 'dotenv';
import { MongoClient, Db, Collection } from 'mongodb';
import path from 'path';

// 從專案根目錄讀取 .env 檔案（README 目錄）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || process.env.DATABASE_NAME || 'book_rental_db';

if (!MONGODB_URI) {
  console.warn('⚠️  缺少 MONGODB_URI，搜尋歷史功能將無法使用。請在 .env 設定 MongoDB 連接字串。');
}

// MongoDB 客戶端（單例模式）
let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * 獲取 MongoDB 客戶端（單例）
 */
export async function getMongoClient(): Promise<MongoClient | null> {
  if (!MONGODB_URI) {
    return null;
  }

  if (!client) {
    try {
      client = new MongoClient(MONGODB_URI, {
        tls: true,
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });
      await client.connect();
      console.log('✅ MongoDB 連接成功');
    } catch (error: any) {
      console.error('❌ MongoDB 連接失敗:', error.message);
      client = null;
      return null;
    }
  }

  return client;
}

/**
 * 獲取資料庫實例
 */
export async function getMongoDb(): Promise<Db | null> {
  if (!MONGODB_URI) {
    return null;
  }

  if (!db) {
    const mongoClient = await getMongoClient();
    if (!mongoClient) {
      return null;
    }
    db = mongoClient.db(MONGODB_DATABASE);
  }

  return db;
}

/**
 * 獲取搜尋歷史集合
 */
export async function getSearchHistoryCollection(): Promise<Collection | null> {
  const database = await getMongoDb();
  if (!database) {
    return null;
  }
  return database.collection('search_history');
}

/**
 * 關閉 MongoDB 連接
 */
export async function closeMongoConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB 連接已關閉');
  }
}

