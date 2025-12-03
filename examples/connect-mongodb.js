// ============================================
// MongoDB 連接範例
// ============================================
// 此檔案示範如何連接 MongoDB Atlas

require('dotenv').config();
const { MongoClient } = require('mongodb');

// 從環境變數取得連接資訊
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DATABASE || 'book_rental_db';

if (!mongoUri) {
  console.error('❌ 錯誤：缺少 MongoDB 連接字串');
  console.error('請在 .env 檔案中設定 MONGODB_URI');
  process.exit(1);
}

// 建立 MongoDB 客戶端
// 添加 SSL/TLS 配置以修復 SSL 錯誤
const client = new MongoClient(mongoUri, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
});

// ============================================
// 測試連接
// ============================================
async function testConnection() {
  try {
    console.log('🔌 正在測試 MongoDB 連接...\n');

    // 連接到資料庫
    await client.connect();
    console.log('✅ MongoDB 連接成功！\n');

    const db = client.db(dbName);
    const collection = db.collection('search_history');

    // 檢查集合是否存在
    const collections = await db.listCollections().toArray();
    const collectionExists = collections.some(c => c.name === 'search_history');

    if (collectionExists) {
      console.log('📊 search_history 集合已存在');
      
      // 取得文件數量
      const count = await collection.countDocuments();
      console.log(`   文件數量: ${count}`);
      
      // 取得索引資訊
      const indexes = await collection.indexes();
      console.log(`   索引數量: ${indexes.length}`);
    } else {
      console.log('⚠️  search_history 集合不存在');
      console.log('   請執行 database/non-relational/migrations/init_collections.js 來初始化');
    }

    return true;
  } catch (error) {
    console.error('❌ MongoDB 連接失敗：');
    console.error(error.message);
    
    // 提供詳細的錯誤診斷
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.error('\n💡 SSL/TLS 錯誤診斷：');
      console.error('   1. 檢查連接字串格式是否正確');
      console.error('   2. 確認連接字串包含完整的參數：?retryWrites=true&w=majority');
      console.error('   3. 檢查 MongoDB Atlas Network Access 設定');
      console.error('   4. 確認用戶名和密碼正確');
      console.error('   5. 嘗試從 MongoDB Atlas Dashboard 重新複製連接字串\n');
    } else if (error.message.includes('authentication')) {
      console.error('\n💡 認證錯誤：');
      console.error('   請檢查連接字串中的用戶名和密碼是否正確\n');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n💡 網路錯誤：');
      console.error('   請檢查連接字串中的主機名稱是否正確\n');
    }
    
    return false;
  } finally {
    await client.close();
  }
}

// ============================================
// 範例操作
// ============================================

// 新增搜尋記錄
async function insertSearchHistory(memberId, searchQuery, bookIds = []) {
  const db = client.db(dbName);
  const collection = db.collection('search_history');
  
  const document = {
    member_id: memberId,
    search_query: searchQuery,
    search_date: new Date(),
    book_ids: bookIds,
    filters: {}
  };

  const result = await collection.insertOne(document);
  return result.insertedId;
}

// 查詢會員的搜尋歷史
async function getMemberSearchHistory(memberId, limit = 10) {
  const db = client.db(dbName);
  const collection = db.collection('search_history');
  
  const results = await collection
    .find({ member_id: memberId })
    .sort({ search_date: -1 })
    .limit(limit)
    .toArray();
  
  return results;
}

// 文字搜尋
async function searchByQuery(searchQuery) {
  const db = client.db(dbName);
  const collection = db.collection('search_history');
  
  const results = await collection
    .find({ $text: { $search: searchQuery } })
    .sort({ search_date: -1 })
    .limit(10)
    .toArray();
  
  return results;
}

// ============================================
// 執行測試
// ============================================
if (require.main === module) {
  testConnection()
    .then(success => {
      if (success) {
        console.log('\n✅ 連接測試完成！');
        console.log('\n💡 提示：您可以在應用程式中使用 client 來操作 MongoDB。');
      }
      process.exit(success ? 0 : 1);
    });
}

module.exports = {
  client,
  testConnection,
  insertSearchHistory,
  getMemberSearchHistory,
  searchByQuery,
};

