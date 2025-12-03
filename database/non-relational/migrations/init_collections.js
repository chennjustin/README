// ============================================
// 獨立租借書店系統 - MongoDB 初始化腳本
// 建立集合和索引
// ============================================

require('dotenv').config();
const { MongoClient } = require('mongodb');
const schema = require('../schema/search_history');

// MongoDB 連接字串
// 從環境變數讀取，支援兩種變數名稱
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.MONGODB_DATABASE || process.env.DATABASE_NAME || 'book_rental_db';

/**
 * 初始化 MongoDB 資料庫
 * 建立集合和索引
 */
async function initDatabase() {
    // 添加 SSL/TLS 配置
    const client = new MongoClient(MONGODB_URI, {
        tls: true,
        tlsAllowInvalidCertificates: false,
        tlsAllowInvalidHostnames: false,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
    });
    
    try {
        // 連接到 MongoDB
        await client.connect();
        console.log('已連接到 MongoDB');
        
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(schema.collectionName);
        
        // 檢查集合是否存在，如果不存在則建立
        const collections = await db.listCollections({ name: schema.collectionName }).toArray();
        if (collections.length === 0) {
            await db.createCollection(schema.collectionName);
            console.log(`已建立集合: ${schema.collectionName}`);
        } else {
            console.log(`集合已存在: ${schema.collectionName}`);
        }
        
        // 建立索引
        console.log('正在建立索引...');
        
        // 會員ID索引
        await collection.createIndex({ member_id: 1 });
        console.log('✓ 已建立索引: member_id');
        
        // 搜尋日期索引
        await collection.createIndex({ search_date: -1 });
        console.log('✓ 已建立索引: search_date');
        
        // 複合索引：會員ID + 搜尋日期
        await collection.createIndex({ member_id: 1, search_date: -1 });
        console.log('✓ 已建立複合索引: member_id + search_date');
        
        // 文字索引：搜尋關鍵詞
        await collection.createIndex({ search_query: 'text' });
        console.log('✓ 已建立文字索引: search_query');
        
        // 書籍ID索引
        await collection.createIndex({ book_ids: 1 });
        console.log('✓ 已建立索引: book_ids');
        
        console.log('\n資料庫初始化完成！');
        
        // 顯示集合統計資訊
        const count = await collection.countDocuments();
        const indexes = await collection.indexes();
        console.log(`\n集合統計資訊:`);
        console.log(`  集合名稱: ${schema.collectionName}`);
        console.log(`  文檔數量: ${count}`);
        console.log(`  索引數量: ${indexes.length}`);
        
    } catch (error) {
        console.error('初始化資料庫時發生錯誤:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n已斷開 MongoDB 連接');
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    initDatabase()
        .then(() => {
            console.log('\n✓ 初始化成功');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n✗ 初始化失敗:', error);
            process.exit(1);
        });
}

module.exports = { initDatabase };

