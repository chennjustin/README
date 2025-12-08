-- ============================================
-- 刪除所有手動創建的索引
-- ============================================
-- 注意：此腳本只會刪除手動創建的索引，不會刪除主鍵和唯一約束的自動索引
-- 執行前請確認您真的想要刪除所有索引！

-- 實際執行刪除（取消註釋下面的代碼來執行）
/*
DO $$
DECLARE
    idx_record RECORD;
BEGIN
    FOR idx_record IN 
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname NOT LIKE '%_pkey'
          AND indexname NOT LIKE '%_key'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || idx_record.indexname;
        RAISE NOTICE '已刪除索引: %', idx_record.indexname;
    END LOOP;
    
    RAISE NOTICE '✅ 所有索引已刪除完成';
END $$;
*/

-- ============================================
-- 或者，如果您想手動刪除，可以使用以下語句：
-- ============================================

-- MEMBER 表索引
DROP INDEX IF EXISTS idx_member_level_id;
DROP INDEX IF EXISTS idx_member_admin_id;
DROP INDEX IF EXISTS idx_member_email;
DROP INDEX IF EXISTS idx_member_phone;
DROP INDEX IF EXISTS idx_member_status;

-- TOP_UP 表索引
DROP INDEX IF EXISTS idx_top_up_member_id;
DROP INDEX IF EXISTS idx_top_up_admin_id;
DROP INDEX IF EXISTS idx_top_up_date;

-- BOOK_COPIES 表索引
DROP INDEX IF EXISTS idx_copies_status;
DROP INDEX IF EXISTS idx_copies_condition;

-- BOOK_LOAN 表索引
DROP INDEX IF EXISTS idx_loan_admin_id;
DROP INDEX IF EXISTS idx_loan_member_id;

-- LOAN_RECORD 表索引
DROP INDEX IF EXISTS idx_loan_record_date_out;
DROP INDEX IF EXISTS idx_loan_record_due_date;
DROP INDEX IF EXISTS idx_loan_record_return_date;

-- RESERVATION 表索引
DROP INDEX IF EXISTS idx_reservation_member_id;
DROP INDEX IF EXISTS idx_reservation_status;
DROP INDEX IF EXISTS idx_reservation_reserve_date;

-- BOOK_CATEGORY 表索引
DROP INDEX IF EXISTS idx_book_category_category_id;

-- RESERVATION_RECORD 表索引
DROP INDEX IF EXISTS idx_reservation_record_book_id;

-- ADD_FEE 表索引
DROP INDEX IF EXISTS idx_add_fee_loan_record;
DROP INDEX IF EXISTS idx_add_fee_type;
DROP INDEX IF EXISTS idx_add_fee_date;

