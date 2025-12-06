-- ============================================
-- 修正 LOAN_RECORD.rental_fee 和 BOOK_LOAN.final_price
-- ============================================
-- 問題：由於 generate_mock_data.sql 中 BOOK_COPIES.rental_price 計算錯誤
--      導致 LOAN_RECORD.rental_fee 和 BOOK_LOAN.final_price 也是錯誤的
-- 
-- 正確的計算方式：
-- 1. BOOK_COPIES.rental_price = BOOK.price * CONDITION_DISCOUNT.discount_factor
-- 2. LOAN_RECORD.rental_fee = BOOK_COPIES.rental_price * MEMBERSHIP_LEVEL.discount_rate
-- 3. BOOK_LOAN.final_price = SUM(LOAN_RECORD.rental_fee) for each loan
--
-- 此 migration 會：
-- 1. 重新計算所有 LOAN_RECORD.rental_fee
-- 2. 重新計算所有 BOOK_LOAN.final_price
-- 3. 重新計算所有 MEMBER.balance（基於正確的金額）

-- 步驟 1: 重新計算 LOAN_RECORD.rental_fee
-- 正確公式：rental_fee = BOOK_COPIES.rental_price * MEMBERSHIP_LEVEL.discount_rate
-- 注意：BOOK_COPIES.rental_price 已經在 004_fix_rental_price.sql 中修正過了
UPDATE LOAN_RECORD lr
SET rental_fee = (
    SELECT floor(bc.rental_price * ml.discount_rate)::INTEGER
    FROM BOOK_LOAN bl
    JOIN MEMBER m ON bl.member_id = m.member_id
    JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
    JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
    WHERE bl.loan_id = lr.loan_id
)
WHERE EXISTS (
    SELECT 1
    FROM BOOK_LOAN bl
    JOIN MEMBER m ON bl.member_id = m.member_id
    JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
    JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
    WHERE bl.loan_id = lr.loan_id
);

-- 步驟 2: 重新計算 BOOK_LOAN.final_price
UPDATE BOOK_LOAN bl
SET final_price = (
    SELECT COALESCE(SUM(lr.rental_fee), 0)
    FROM LOAN_RECORD lr
    WHERE lr.loan_id = bl.loan_id
)
WHERE EXISTS (
    SELECT 1
    FROM LOAN_RECORD lr
    WHERE lr.loan_id = bl.loan_id
);

-- 步驟 3: 重新計算 MEMBER.balance
-- balance = 所有 TOP_UP 金額總和 - 所有 BOOK_LOAN.final_price - 所有 ADD_FEE.amount
-- 注意：如果計算結果為負數，設為 0（因為有 balance >= 0 的約束）
UPDATE MEMBER m
SET balance = GREATEST(0, (
    SELECT 
        COALESCE((
            SELECT SUM(tu.amount) 
            FROM TOP_UP tu 
            WHERE tu.member_id = m.member_id
        ), 0) - 
        COALESCE((
            SELECT SUM(bl.final_price) 
            FROM BOOK_LOAN bl 
            WHERE bl.member_id = m.member_id
        ), 0) - 
        COALESCE((
            SELECT SUM(af.amount) 
            FROM LOAN_RECORD lr
            JOIN BOOK_LOAN bl2 ON lr.loan_id = bl2.loan_id
            JOIN ADD_FEE af ON lr.loan_id = af.loan_id 
                AND lr.book_id = af.book_id 
                AND lr.copies_serial = af.copies_serial
            WHERE bl2.member_id = m.member_id
        ), 0)
))
WHERE EXISTS (
    SELECT 1
    FROM MEMBER m2
    WHERE m2.member_id = m.member_id
);

-- 驗證更新結果
DO $$
DECLARE
    loan_count INTEGER;
    book_loan_count INTEGER;
    member_count INTEGER;
    negative_balance_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO loan_count FROM LOAN_RECORD;
    SELECT COUNT(*) INTO book_loan_count FROM BOOK_LOAN;
    SELECT COUNT(*) INTO member_count FROM MEMBER;
    
    -- 檢查有多少會員的餘額被設為 0（原本應該是負數）
    SELECT COUNT(*) INTO negative_balance_count
    FROM MEMBER m
    WHERE (
        SELECT 
            COALESCE((SELECT SUM(tu.amount) FROM TOP_UP tu WHERE tu.member_id = m.member_id), 0) - 
            COALESCE((SELECT SUM(bl.final_price) FROM BOOK_LOAN bl WHERE bl.member_id = m.member_id), 0) - 
            COALESCE((
                SELECT SUM(af.amount) 
                FROM LOAN_RECORD lr
                JOIN BOOK_LOAN bl2 ON lr.loan_id = bl2.loan_id
                JOIN ADD_FEE af ON lr.loan_id = af.loan_id 
                    AND lr.book_id = af.book_id 
                    AND lr.copies_serial = af.copies_serial
                WHERE bl2.member_id = m.member_id
            ), 0)
    ) < 0 AND m.balance = 0;
    
    RAISE NOTICE '✅ 更新完成！';
    RAISE NOTICE '  - % 筆 LOAN_RECORD 記錄已更新', loan_count;
    RAISE NOTICE '  - % 筆 BOOK_LOAN 記錄已更新', book_loan_count;
    RAISE NOTICE '  - % 筆 MEMBER 記錄的 balance 已重新計算', member_count;
    IF negative_balance_count > 0 THEN
        RAISE WARNING '  ⚠️  % 筆會員的餘額原本應該是負數，已設為 0（可能需要手動檢查）', negative_balance_count;
    END IF;
END $$;

