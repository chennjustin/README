// ============================================
// 驗證資料關聯合理性
// ============================================

require('dotenv').config();
const { postgresPool } = require('../config/database');

async function verifyDataConsistency() {
    const pool = postgresPool();
    
    try {
        console.log('🔍 開始驗證資料關聯合理性...\n');
        console.log('='.repeat(60));
        
        // ============================================
        // 1. 檢查 TOP_UP 和 MEMBER balance 的關聯
        // ============================================
        console.log('\n📊 1. 檢查 TOP_UP 和 MEMBER balance 的關聯');
        console.log('-'.repeat(60));
        
        const balanceCheck = await pool.query(`
            SELECT 
                m.member_id,
                m.name,
                m.balance as current_balance,
                COALESCE((SELECT SUM(amount) FROM TOP_UP WHERE member_id = m.member_id), 0) as total_top_up,
                COALESCE((SELECT SUM(final_price) FROM BOOK_LOAN WHERE member_id = m.member_id), 0) as total_loan_fee,
                COALESCE((
                    SELECT SUM(af.amount)
                    FROM BOOK_LOAN bl
                    JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
                    JOIN ADD_FEE af ON lr.loan_id = af.loan_id 
                        AND lr.book_id = af.book_id 
                        AND lr.copies_serial = af.copies_serial
                    WHERE bl.member_id = m.member_id
                ), 0) as total_add_fee
            FROM MEMBER m
            ORDER BY m.member_id
            LIMIT 10;
        `);
        
        // 在 JavaScript 中計算 calculated_balance 和 status
        balanceCheck.rows.forEach(row => {
            row.calculated_balance = row.total_top_up - row.total_loan_fee - row.total_add_fee;
                // 考慮 GREATEST(0, ...) 的情況：如果計算結果是負數，實際 balance 應該是 0
                const expectedBalance = Math.max(0, row.calculated_balance);
                row.status = row.current_balance === expectedBalance ? '✅ 正確' : '❌ 不一致';
        });
        
        console.log('前 10 位會員的 balance 驗證：');
        let balanceErrors = 0;
        balanceCheck.rows.forEach(row => {
            const status = row.status;
            if (status === '❌ 不一致') balanceErrors++;
            console.log(`  會員 ${row.member_id} (${row.name}):`);
            console.log(`    當前 balance: ${row.current_balance}`);
            console.log(`    總儲值: ${row.total_top_up}`);
            console.log(`    總借閱費: ${row.total_loan_fee}`);
            console.log(`    總額外費: ${row.total_add_fee}`);
            console.log(`    計算 balance: ${row.calculated_balance}`);
            console.log(`    狀態: ${status}`);
        });
        
        if (balanceErrors > 0) {
            console.log(`\n  ⚠️  發現 ${balanceErrors} 筆 balance 不一致的記錄`);
        } else {
            console.log('\n  ✅ 所有會員的 balance 計算正確');
        }
        
        // ============================================
        // 2. 檢查 BOOK_COPIES 狀態和借閱記錄的關聯
        // ============================================
        console.log('\n📚 2. 檢查 BOOK_COPIES 狀態和借閱記錄的關聯');
        console.log('-'.repeat(60));
        
        const copiesStatusCheck = await pool.query(`
            SELECT 
                bc.book_id,
                bc.copies_serial,
                bc.status as copies_status,
                COUNT(DISTINCT CASE WHEN lr.return_date IS NULL AND lr.due_date >= CURRENT_DATE THEN lr.loan_id END) as active_loans,
                COUNT(DISTINCT CASE WHEN lr.return_date IS NOT NULL THEN lr.loan_id END) as returned_loans,
                CASE 
                    WHEN bc.status = 'Borrowed' AND COUNT(DISTINCT CASE WHEN lr.return_date IS NULL AND lr.due_date >= CURRENT_DATE THEN lr.loan_id END) > 0 THEN '✅ 正確'
                    WHEN bc.status = 'Available' AND COUNT(DISTINCT CASE WHEN lr.return_date IS NULL AND lr.due_date >= CURRENT_DATE THEN lr.loan_id END) = 0 THEN '✅ 正確'
                    WHEN bc.status = 'Lost' THEN '✅ Lost 狀態'
                    ELSE '❌ 不一致'
                END as status_check
            FROM BOOK_COPIES bc
            LEFT JOIN LOAN_RECORD lr ON bc.book_id = lr.book_id AND bc.copies_serial = lr.copies_serial
            WHERE bc.status IN ('Borrowed', 'Available')
            GROUP BY bc.book_id, bc.copies_serial, bc.status
            HAVING COUNT(DISTINCT CASE WHEN lr.return_date IS NULL AND lr.due_date >= CURRENT_DATE THEN lr.loan_id END) > 0 
                OR bc.status = 'Borrowed'
            ORDER BY bc.book_id, bc.copies_serial
            LIMIT 10;
        `);
        
        console.log('BOOK_COPIES 狀態驗證（前 10 筆）：');
        let statusErrors = 0;
        copiesStatusCheck.rows.forEach(row => {
            if (row.status_check === '❌ 不一致') statusErrors++;
            console.log(`  書籍 ${row.book_id}-${row.copies_serial}:`);
            console.log(`    狀態: ${row.copies_status}`);
            console.log(`    進行中借閱: ${row.active_loans}`);
            console.log(`    已歸還借閱: ${row.returned_loans}`);
            console.log(`    驗證: ${row.status_check}`);
        });
        
        if (statusErrors > 0) {
            console.log(`\n  ⚠️  發現 ${statusErrors} 筆狀態不一致的記錄`);
        } else {
            console.log('\n  ✅ BOOK_COPIES 狀態與借閱記錄一致');
        }
        
        // ============================================
        // 3. 檢查借閱記錄和費用的關聯
        // ============================================
        console.log('\n💰 3. 檢查借閱記錄和費用的關聯');
        console.log('-'.repeat(60));
        
        const feeCheck = await pool.query(`
            SELECT 
                lr.loan_id,
                lr.book_id,
                lr.copies_serial,
                lr.due_date,
                lr.return_date,
                lr.renew_cnt,
                COUNT(DISTINCT CASE WHEN af.type = 'renew' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) as renew_fee_count,
                COUNT(DISTINCT CASE WHEN af.type = 'overdue' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) as overdue_fee_count,
                CASE 
                    WHEN lr.renew_cnt > 0 AND COUNT(DISTINCT CASE WHEN af.type = 'renew' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) > 0 THEN '✅ 有續借費'
                    WHEN lr.renew_cnt = 0 AND COUNT(DISTINCT CASE WHEN af.type = 'renew' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) = 0 THEN '✅ 無續借費'
                    WHEN lr.renew_cnt > 0 AND COUNT(DISTINCT CASE WHEN af.type = 'renew' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) = 0 THEN '⚠️  續借但無費用'
                    ELSE '✅'
                END as renew_check,
                CASE 
                    WHEN lr.return_date IS NOT NULL AND lr.return_date > lr.due_date 
                        AND COUNT(DISTINCT CASE WHEN af.type = 'overdue' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) > 0 THEN '✅ 有逾期費'
                    WHEN (lr.return_date IS NULL OR lr.return_date <= lr.due_date)
                        AND COUNT(DISTINCT CASE WHEN af.type = 'overdue' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) = 0 THEN '✅ 無逾期費'
                    WHEN lr.return_date IS NOT NULL AND lr.return_date > lr.due_date 
                        AND COUNT(DISTINCT CASE WHEN af.type = 'overdue' THEN af.loan_id || '-' || af.book_id || '-' || af.copies_serial || '-' || af.type END) = 0 THEN '⚠️  逾期但無費用'
                    ELSE '✅'
                END as overdue_check
            FROM LOAN_RECORD lr
            LEFT JOIN ADD_FEE af ON lr.loan_id = af.loan_id 
                AND lr.book_id = af.book_id 
                AND lr.copies_serial = af.copies_serial
            GROUP BY lr.loan_id, lr.book_id, lr.copies_serial, lr.due_date, lr.return_date, lr.renew_cnt
            HAVING lr.renew_cnt > 0 OR (lr.return_date IS NOT NULL AND lr.return_date > lr.due_date)
            ORDER BY lr.loan_id
            LIMIT 10;
        `);
        
        console.log('借閱記錄和費用關聯驗證（前 10 筆）：');
        feeCheck.rows.forEach(row => {
            console.log(`  借閱 ${row.loan_id}-${row.book_id}-${row.copies_serial}:`);
            console.log(`    續借次數: ${row.renew_cnt}, 續借費: ${row.renew_fee_count} 筆 - ${row.renew_check}`);
            console.log(`    應還日期: ${row.due_date}, 歸還日期: ${row.return_date || '未歸還'}`);
            console.log(`    逾期費: ${row.overdue_fee_count} 筆 - ${row.overdue_check}`);
        });
        
        // ============================================
        // 4. 檢查 BOOK_LOAN 和 LOAN_RECORD 的關聯
        // ============================================
        console.log('\n📝 4. 檢查 BOOK_LOAN 和 LOAN_RECORD 的關聯');
        console.log('-'.repeat(60));
        
        const loanCheck = await pool.query(`
            SELECT 
                bl.loan_id,
                bl.final_price as loan_final_price,
                COALESCE(SUM(lr.rental_fee), 0) as calculated_total_fee,
                COUNT(DISTINCT lr.book_id || '-' || lr.copies_serial) as books_count,
                CASE 
                    WHEN bl.final_price = COALESCE(SUM(lr.rental_fee), 0) THEN '✅ 正確'
                    ELSE '❌ 不一致'
                END as status
            FROM BOOK_LOAN bl
            LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
            GROUP BY bl.loan_id, bl.final_price
            HAVING bl.final_price != COALESCE(SUM(lr.rental_fee), 0) OR COUNT(DISTINCT lr.book_id || '-' || lr.copies_serial) = 0
            ORDER BY bl.loan_id
            LIMIT 10;
        `);
        
        if (loanCheck.rows.length > 0) {
            console.log('發現不一致的借閱交易：');
            loanCheck.rows.forEach(row => {
                console.log(`  借閱 ${row.loan_id}:`);
                console.log(`    記錄的 final_price: ${row.loan_final_price}`);
                console.log(`    計算的總租金: ${row.calculated_total_fee}`);
                console.log(`    書籍數量: ${row.books_count}`);
                console.log(`    狀態: ${row.status}`);
            });
        } else {
            console.log('✅ 所有借閱交易的 final_price 計算正確');
        }
        
        // ============================================
        // 5. 檢查外鍵完整性
        // ============================================
        console.log('\n🔗 5. 檢查外鍵完整性');
        console.log('-'.repeat(60));
        
        const foreignKeyCheck = await pool.query(`
            SELECT 
                'TOP_UP.member_id' as constraint_name,
                COUNT(*) as orphan_count
            FROM TOP_UP tu
            LEFT JOIN MEMBER m ON tu.member_id = m.member_id
            WHERE m.member_id IS NULL
            UNION ALL
            SELECT 
                'TOP_UP.admin_id',
                COUNT(*)
            FROM TOP_UP tu
            LEFT JOIN ADMIN a ON tu.admin_id = a.admin_id
            WHERE a.admin_id IS NULL
            UNION ALL
            SELECT 
                'LOAN_RECORD.loan_id',
                COUNT(*)
            FROM LOAN_RECORD lr
            LEFT JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
            WHERE bl.loan_id IS NULL
            UNION ALL
            SELECT 
                'LOAN_RECORD.book_id, copies_serial',
                COUNT(*)
            FROM LOAN_RECORD lr
            LEFT JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
            WHERE bc.book_id IS NULL;
        `);
        
        let hasOrphans = false;
        foreignKeyCheck.rows.forEach(row => {
            if (row.orphan_count > 0) {
                hasOrphans = true;
                console.log(`  ❌ ${row.constraint_name}: ${row.orphan_count} 筆孤立記錄`);
            }
        });
        
        if (!hasOrphans) {
            console.log('✅ 所有外鍵關聯完整，無孤立記錄');
        }
        
        // ============================================
        // 6. 統計摘要
        // ============================================
        console.log('\n📊 6. 資料統計摘要');
        console.log('-'.repeat(60));
        
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM MEMBER) as total_members,
                (SELECT COUNT(*) FROM TOP_UP) as total_top_ups,
                (SELECT COUNT(*) FROM BOOK_LOAN) as total_loans,
                (SELECT COUNT(*) FROM LOAN_RECORD) as total_loan_records,
                (SELECT COUNT(*) FROM ADD_FEE) as total_add_fees,
                (SELECT COUNT(*) FROM BOOK_COPIES) as total_copies,
                (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Borrowed') as borrowed_copies,
                (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Available') as available_copies,
                (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Lost') as lost_copies,
                (SELECT SUM(amount) FROM TOP_UP) as total_top_up_amount,
                (SELECT SUM(final_price) FROM BOOK_LOAN) as total_loan_fees,
                (SELECT SUM(amount) FROM ADD_FEE) as total_add_fee_amount;
        `);
        
        const s = stats.rows[0];
        console.log(`會員總數: ${s.total_members}`);
        console.log(`儲值記錄總數: ${s.total_top_ups}`);
        console.log(`借閱交易總數: ${s.total_loans}`);
        console.log(`借閱記錄總數: ${s.total_loan_records}`);
        console.log(`額外費用總數: ${s.total_add_fees}`);
        console.log(`書籍複本總數: ${s.total_copies}`);
        console.log(`  - 借閱中: ${s.borrowed_copies}`);
        console.log(`  - 可借: ${s.available_copies}`);
        console.log(`  - 遺失: ${s.lost_copies}`);
        console.log(`總儲值金額: ${s.total_top_up_amount || 0}`);
        console.log(`總借閱費用: ${s.total_loan_fees || 0}`);
        console.log(`總額外費用: ${s.total_add_fee_amount || 0}`);
        console.log(`總支出: ${(parseInt(s.total_loan_fees) || 0) + (parseInt(s.total_add_fee_amount) || 0)}`);
        console.log(`理論總餘額: ${(parseInt(s.total_top_up_amount) || 0) - (parseInt(s.total_loan_fees) || 0) - (parseInt(s.total_add_fee_amount) || 0)}`);
        
        const actualBalance = await pool.query('SELECT SUM(balance) as total_balance FROM MEMBER');
        console.log(`實際總餘額: ${actualBalance.rows[0].total_balance}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ 資料驗證完成！');
        
    } catch (error) {
        console.error('❌ 驗證失敗：');
        console.error(error.message);
        if (error.detail) {
            console.error('詳細資訊：', error.detail);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifyDataConsistency();

