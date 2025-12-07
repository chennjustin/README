// ============================================
// 執行虛擬資料生成腳本
// ============================================

require('dotenv').config();
const { postgresPool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMockData() {
    const pool = postgresPool();
    
    try {
        console.log('🚀 開始執行虛擬資料生成腳本...\n');
        console.log('='.repeat(60));
        
        // 讀取 SQL 文件
        const sqlPath = path.join(__dirname, '../database/relational/generate_mock_data.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 已讀取 SQL 腳本');
        console.log(`   檔案大小: ${(sql.length / 1024).toFixed(2)} KB\n`);
        
        // 分割 SQL 語句（以分號和換行分隔）
        // 注意：PostgreSQL 的 DO $$ ... END $$ 塊需要特殊處理
        console.log('⏳ 正在執行 SQL 腳本...\n');
        
        // 直接執行整個 SQL 文件
        // 使用 pool.query 執行
        await pool.query(sql);
        
        console.log('\n✅ 虛擬資料生成完成！\n');
        console.log('='.repeat(60));
        
        // 驗證生成的資料
        console.log('\n📊 驗證生成的資料...\n');
        
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM ADMIN) as admin_count,
                (SELECT COUNT(*) FROM MEMBER) as member_count,
                (SELECT COUNT(*) FROM TOP_UP) as top_up_count,
                (SELECT COUNT(*) FROM BOOK_COPIES) as copies_count,
                (SELECT COUNT(*) FROM BOOK_LOAN) as loan_count,
                (SELECT COUNT(*) FROM LOAN_RECORD) as loan_record_count,
                (SELECT COUNT(*) FROM ADD_FEE) as add_fee_count,
                (SELECT COUNT(*) FROM RESERVATION) as reservation_count,
                (SELECT COUNT(*) FROM RESERVATION_RECORD) as reservation_record_count;
        `);
        
        const s = stats.rows[0];
        console.log('📈 生成結果統計：');
        console.log(`  ✅ 店員: ${s.admin_count} 位`);
        console.log(`  ✅ 會員: ${s.member_count} 位`);
        console.log(`  ✅ 儲值記錄: ${s.top_up_count} 筆`);
        console.log(`  ✅ 書籍複本: ${s.copies_count} 個`);
        console.log(`  ✅ 借閱交易: ${s.loan_count} 筆`);
        console.log(`  ✅ 借閱記錄: ${s.loan_record_count} 筆`);
        console.log(`  ✅ 額外費用: ${s.add_fee_count} 筆`);
        console.log(`  ✅ 預約記錄: ${s.reservation_count} 筆`);
        console.log(`  ✅ 預約書籍關聯: ${s.reservation_record_count} 筆`);
        
        // 檢查是否有資料
        if (s.member_count > 0 && s.loan_count > 0) {
            console.log('\n✅ 資料生成成功！');
            console.log('\n💡 提示：可以執行以下命令驗證資料關聯：');
            console.log('   node examples/verify-data-consistency.js');
        } else {
            console.log('\n⚠️  警告：部分資料可能未生成，請檢查 SQL 執行日誌');
        }
        
    } catch (error) {
        console.error('\n❌ 執行失敗：');
        console.error(error.message);
        
        if (error.position) {
            console.error(`\n錯誤位置: 第 ${error.position} 個字元`);
        }
        
        if (error.detail) {
            console.error('詳細資訊：', error.detail);
        }
        
        if (error.hint) {
            console.error('提示：', error.hint);
        }
        
        // 顯示錯誤附近的 SQL（如果有）
        if (error.position && error.query) {
            const pos = parseInt(error.position);
            const start = Math.max(0, pos - 200);
            const end = Math.min(error.query.length, pos + 200);
            console.error('\n錯誤附近的 SQL：');
            console.error(error.query.substring(start, end));
        }
        
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMockData();


