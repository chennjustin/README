-- ============================================
-- 修正 BOOK_COPIES.rental_price
-- ============================================
-- 問題：generate_mock_data.sql 中錯誤地將 rental_price 計算為
--       book_rec.price * discount_factor * 0.1
-- 正確：BOOK.price 已經是租金（定價的 10%），所以應該是
--       BOOK.price * discount_factor
--
-- 此 migration 會更新所有 BOOK_COPIES.rental_price 為正確值

UPDATE BOOK_COPIES bc
SET rental_price = (
    SELECT (b.price * cd.discount_factor)::INTEGER
    FROM BOOK b
    JOIN CONDITION_DISCOUNT cd ON bc.book_condition = cd.book_condition
    WHERE b.book_id = bc.book_id
)
WHERE EXISTS (
    SELECT 1
    FROM BOOK b
    JOIN CONDITION_DISCOUNT cd ON bc.book_condition = cd.book_condition
    WHERE b.book_id = bc.book_id
);

-- 驗證更新結果
DO $$
DECLARE
    incorrect_count INTEGER;
    total_count INTEGER;
BEGIN
    -- 計算仍有錯誤的記錄數
    SELECT COUNT(*) INTO incorrect_count
    FROM BOOK_COPIES bc
    JOIN BOOK b ON bc.book_id = b.book_id
    JOIN CONDITION_DISCOUNT cd ON bc.book_condition = cd.book_condition
    WHERE bc.rental_price != (b.price * cd.discount_factor)::INTEGER;
    
    SELECT COUNT(*) INTO total_count
    FROM BOOK_COPIES;
    
    RAISE NOTICE '總共 % 筆 BOOK_COPIES 記錄', total_count;
    RAISE NOTICE '仍有 % 筆 rental_price 不正確', incorrect_count;
    
    IF incorrect_count = 0 THEN
        RAISE NOTICE '✅ 所有 rental_price 已修正完成！';
    ELSE
        RAISE WARNING '⚠️  仍有 % 筆記錄需要檢查', incorrect_count;
    END IF;
END $$;


