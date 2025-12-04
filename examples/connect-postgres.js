// ============================================
// PostgreSQL 直接連接範例
// ============================================
// 此檔案示範如何使用 pg 套件直接連接 PostgreSQL
// 推薦後端開發使用此方式，而非 Supabase Client

require('dotenv').config();

// ============================================
// 方式 1: 使用配置模組（推薦）
// ============================================
const { postgresPool } = require('../config/database');
const pool = postgresPool();

// 注意：如果使用連接池 URL（port 6543），建議在連接字串中加入以下參數：
// ?pgbouncer=true&connection_limit=1&pool_timeout=20

// ============================================
// 方式 2: 直接使用 pg 套件
// ============================================
// const { Pool } = require('pg');
// const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;
// 
// if (!connectionString) {
//   console.error('❌ 錯誤：缺少 PostgreSQL 連接字串');
//   console.error('請在 .env 檔案中設定 DATABASE_URL 或 DATABASE_POOL_URL');
//   process.exit(1);
// }
// 
// const pool = new Pool({
//   connectionString: connectionString,
//   ssl: {
//     rejectUnauthorized: false // Supabase 需要 SSL
//   }
// });

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

// 事務範例：借書操作（需要同時更新多個表）
async function borrowBooks(memberId, adminId, bookCopies) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. 建立借閱交易
    const loanResult = await client.query(
      `INSERT INTO BOOK_LOAN (member_id, admin_id, final_price)
       VALUES ($1, $2, 0)
       RETURNING loan_id`,
      [memberId, adminId]
    );
    const loanId = loanResult.rows[0].loan_id;
    
    // 2. 為每本書建立借閱記錄
    let totalFee = 0;
    for (const { book_id, copies_serial } of bookCopies) {
      // 取得租金
      const feeResult = await client.query(
        `SELECT rental_price, discount_rate
         FROM BOOK_COPIES bc
         JOIN BOOK b ON bc.book_id = b.book_id
         JOIN MEMBER m ON m.member_id = $1
         JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
         WHERE bc.book_id = $2 AND bc.copies_serial = $3`,
        [memberId, book_id, copies_serial]
      );
      
      const rentalFee = Math.floor(feeResult.rows[0].rental_price * feeResult.rows[0].discount_rate);
      totalFee += rentalFee;
      
      // 建立借閱記錄
      await client.query(
        `INSERT INTO LOAN_RECORD 
         (loan_id, book_id, copies_serial, date_out, due_date, rental_fee)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', $4)`,
        [loanId, book_id, copies_serial, rentalFee]
      );
      
      // 更新書籍狀態
      await client.query(
        `UPDATE BOOK_COPIES 
         SET status = 'Borrowed' 
         WHERE book_id = $1 AND copies_serial = $2`,
        [book_id, copies_serial]
      );
    }
    
    // 3. 更新總金額
    await client.query(
      `UPDATE BOOK_LOAN SET final_price = $1 WHERE loan_id = $2`,
      [totalFee, loanId]
    );
    
    await client.query('COMMIT');
    return { loanId, totalFee };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 執行測試
// ============================================
if (require.main === module) {
  testConnection()
    .then(success => {
      if (success) {
        console.log('\n✅ 連接測試完成！');
        console.log('\n💡 提示：');
        console.log('   - 後端開發推薦使用 DATABASE_URL（PostgreSQL 直接連接）');
        console.log('   - 可以使用 pool.query() 執行任意 SQL 查詢');
        console.log('   - 支援事務、JOIN、子查詢等複雜操作');
        console.log('   - 比 Supabase Client 更靈活，適合複雜業務邏輯');
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
  borrowBooks,
};

