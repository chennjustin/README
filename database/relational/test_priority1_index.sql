-- ============================================
-- Priority 1 索引性能測試
-- 測試：還書流程查詢（idx_book_loan_member + idx_loan_record_loan）
-- ============================================
-- 此腳本會返回表格結果，可在 Supabase 中直接查看

CREATE OR REPLACE FUNCTION test_priority1_index()
RETURNS TABLE (
    test_phase TEXT,
    query_number INTEGER,
    execution_time_ms NUMERIC,
    records_found INTEGER
) AS $$
DECLARE
    test_member_id BIGINT;
    execution_times_without_index NUMERIC[] := ARRAY[]::NUMERIC[];
    execution_times_with_index NUMERIC[] := ARRAY[]::NUMERIC[];
    avg_time_without NUMERIC;
    avg_time_with NUMERIC;
    stddev_time_without NUMERIC;
    stddev_time_with NUMERIC;
    i INTEGER;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    elapsed_ms NUMERIC;
    query_result INTEGER;
BEGIN
    -- 選擇一個有借閱記錄的會員
    SELECT bl.member_id INTO test_member_id
    FROM BOOK_LOAN bl
    JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
    WHERE lr.return_date IS NULL
    GROUP BY bl.member_id
    HAVING COUNT(*) > 0
    LIMIT 1;
    
    IF test_member_id IS NULL THEN
        RAISE EXCEPTION '沒有找到測試用的會員，請先執行 generate_mock_data.sql';
    END IF;
    
    -- ============================================
    -- 步驟 1：確保沒有索引
    -- ============================================
    DROP INDEX IF EXISTS idx_book_loan_member;
    DROP INDEX IF EXISTS idx_loan_record_loan;
    
    -- ============================================
    -- 步驟 2：執行 5 次查詢（無索引）
    -- ============================================
    FOR i IN 1..5 LOOP
        start_time := clock_timestamp();
        
        SELECT COUNT(*) INTO query_result
        FROM LOAN_RECORD lr
        JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
        WHERE bl.member_id = test_member_id
        AND lr.return_date IS NULL;
        
        end_time := clock_timestamp();
        elapsed_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
        execution_times_without_index := array_append(execution_times_without_index, elapsed_ms);
        
        -- 返回結果
        RETURN QUERY SELECT '無索引'::TEXT, i, elapsed_ms, query_result;
    END LOOP;
    
    -- ============================================
    -- 步驟 3：建立索引
    -- ============================================
    CREATE INDEX idx_book_loan_member ON BOOK_LOAN(member_id);
    CREATE INDEX idx_loan_record_loan ON LOAN_RECORD(loan_id);
    
    -- ============================================
    -- 步驟 4：執行 5 次查詢（有索引）
    -- ============================================
    FOR i IN 1..5 LOOP
        start_time := clock_timestamp();
        
        SELECT COUNT(*) INTO query_result
        FROM LOAN_RECORD lr
        JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
        WHERE bl.member_id = test_member_id
        AND lr.return_date IS NULL;
        
        end_time := clock_timestamp();
        elapsed_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
        execution_times_with_index := array_append(execution_times_with_index, elapsed_ms);
        
        -- 返回結果
        RETURN QUERY SELECT '有索引'::TEXT, i, elapsed_ms, query_result;
    END LOOP;
    
    -- ============================================
    -- 步驟 5：計算統計數據並返回
    -- ============================================
    -- 計算平均值
    SELECT AVG(val) INTO avg_time_without
    FROM unnest(execution_times_without_index) AS val;
    
    SELECT AVG(val) INTO avg_time_with
    FROM unnest(execution_times_with_index) AS val;
    
    -- 計算標準差
    SELECT STDDEV(val) INTO stddev_time_without
    FROM unnest(execution_times_without_index) AS val;
    
    SELECT STDDEV(val) INTO stddev_time_with
    FROM unnest(execution_times_with_index) AS val;
    
    -- 返回統計結果
    RETURN QUERY SELECT 
        '統計-無索引'::TEXT,
        0,
        avg_time_without,
        COALESCE(stddev_time_without, 0)::INTEGER;
    
    RETURN QUERY SELECT 
        '統計-有索引'::TEXT,
        0,
        avg_time_with,
        COALESCE(stddev_time_with, 0)::INTEGER;
    
    RETURN QUERY SELECT 
        '性能提升(%)'::TEXT,
        0,
        CASE 
            WHEN avg_time_without > 0 THEN 
                ((avg_time_without - avg_time_with) / avg_time_without * 100)
            ELSE 0 
        END,
        0;
END;
$$ LANGUAGE plpgsql;

-- 執行測試
SELECT * FROM test_priority1_index();

