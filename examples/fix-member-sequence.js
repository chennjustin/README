// ============================================
// 修復 MEMBER 表的序列
// ============================================
// 此腳本用於修復 member_id 序列，確保序列值與實際的最大 member_id 同步

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 從環境變數取得連接資訊
const connectionString = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;

if (!connectionString) {
  console.error('❌ 錯誤：缺少資料庫連接資訊');
  console.error('請在 .env 檔案中設定 DATABASE_URL 或 DATABASE_POOL_URL');
  process.exit(1);
}

// 建立 PostgreSQL 連接池
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Supabase 需要 SSL
  }
});

async function fixMemberSequence() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 開始修復 MEMBER 表的序列...\n');

    // 先查詢當前狀態
    console.log('📊 查詢當前狀態...');
    const currentState = await client.query(`
      SELECT 
        last_value AS current_sequence_value,
        (SELECT MAX(member_id) FROM MEMBER) AS max_member_id
      FROM member_member_id_seq
    `);
    
    const currentSeq = parseInt(currentState.rows[0].current_sequence_value);
    const maxId = parseInt(currentState.rows[0].max_member_id) || 0;
    
    console.log(`   當前序列值: ${currentSeq}`);
    console.log(`   最大 member_id: ${maxId}\n`);

    if (currentSeq <= maxId) {
      console.log('⚠️  序列值小於或等於最大 member_id，需要修復');
    } else {
      console.log('ℹ️  序列值大於最大 member_id，這是正常的');
    }

    // 執行修復
    console.log('🔨 執行修復...');
    const fixResult = await client.query(`
      SELECT setval(
        'member_member_id_seq',
        COALESCE((SELECT MAX(member_id) FROM MEMBER), 0) + 1,
        false
      ) AS new_sequence_value
    `);
    
    const newSeq = fixResult.rows[0].new_sequence_value;
    console.log(`   新序列值: ${newSeq}\n`);

    // 驗證修復結果
    console.log('✅ 驗證修復結果...');
    const verifyResult = await client.query(`
      SELECT 
        last_value AS current_sequence_value,
        (SELECT MAX(member_id) FROM MEMBER) AS max_member_id
      FROM member_member_id_seq
    `);
    
    const verifiedSeq = parseInt(verifyResult.rows[0].current_sequence_value);
    const verifiedMaxId = parseInt(verifyResult.rows[0].max_member_id) || 0;
    
    console.log(`   序列值: ${verifiedSeq}`);
    console.log(`   最大 member_id: ${verifiedMaxId}`);
    console.log(`   下一個新會員 ID 將是: ${verifiedSeq}\n`);

    if (verifiedSeq === verifiedMaxId + 1) {
      console.log('✅ 修復成功！序列已與最大 member_id 同步');
    } else {
      console.log('⚠️  警告：序列值可能仍有問題');
    }

  } catch (error) {
    console.error('❌ 執行失敗：');
    console.error(error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 執行修復
if (require.main === module) {
  fixMemberSequence()
    .then(() => {
      console.log('\n✅ 腳本執行完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 腳本執行失敗');
      process.exit(1);
    });
}

module.exports = { fixMemberSequence };

