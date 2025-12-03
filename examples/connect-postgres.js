// ============================================
// PostgreSQL 直接連接範例
// ============================================
// 此檔案示範如何使用 pg 套件直接連接 PostgreSQL

require('dotenv').config();
const { Pool } = require('pg');

// 從環境變數取得連接資訊
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;

if (!connectionString) {
  console.error('❌ 錯誤：缺少 PostgreSQL 連接字串');
  console.error('請在 .env 檔案中設定 DATABASE_URL 或 DATABASE_POOL_URL');
  process.exit(1);
}

// 建立連接池
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Supabase 需要 SSL
  }
});

// ============================================
// 測試連接
// ============================================
async function testConnection() {
  try {
    console.log('🔌 正在測試 PostgreSQL 連接...\n');

    // 測試查詢：取得會員等級資料
    const result = await pool.query(
      'SELECT * FROM MEMBERSHIP_LEVEL LIMIT 5'
    );

    console.log('✅ PostgreSQL 連接成功！');
    console.log(`📊 找到 ${result.rows.length} 筆會員等級資料：\n`);
    
    result.rows.forEach(level => {
      console.log(`  - ${level.level_name} (ID: ${level.level_id})`);
      console.log(`    折扣率: ${level.discount_rate}, 可借書數: ${level.max_book_allowed}`);
    });

    return true;
  } catch (error) {
    console.error('❌ PostgreSQL 連接失敗：');
    console.error(error.message);
    return false;
  }
}

// ============================================
// 範例查詢
// ============================================

// 查詢所有書籍
async function getAllBooks() {
  const result = await pool.query('SELECT * FROM BOOK');
  return result.rows;
}

// 查詢會員資訊（含關聯資料）
async function getMember(memberId) {
  const result = await pool.query(
    `SELECT 
      m.*,
      ml.level_name,
      ml.discount_rate,
      ml.max_book_allowed
    FROM MEMBER m
    JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
    WHERE m.member_id = $1`,
    [memberId]
  );
  return result.rows[0];
}

// 新增書籍
async function insertBook(bookData) {
  const { name, author, publisher, price, sequence_name } = bookData;
  const result = await pool.query(
    `INSERT INTO BOOK (name, author, publisher, price, sequence_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, author, publisher, price, sequence_name]
  );
  return result.rows[0];
}

// ============================================
// 執行測試
// ============================================
if (require.main === module) {
  testConnection()
    .then(success => {
      if (success) {
        console.log('\n✅ 連接測試完成！');
        console.log('\n💡 提示：您可以在應用程式中使用 pool 來執行 SQL 查詢。');
      }
      pool.end(); // 關閉連接池
      process.exit(success ? 0 : 1);
    });
}

module.exports = {
  pool,
  testConnection,
  getAllBooks,
  getMember,
  insertBook,
};

