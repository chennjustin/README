-- ============================================
-- 獨立租借書店系統 - 虛擬資料生成腳本（重新設計）
-- PostgreSQL (Supabase)
-- ============================================
-- 
-- 資料一致性保證：
-- 1. 如果有 member 正在借一本書，那本書的 status 會是 'Borrowed'
-- 2. 如果有書 lost，對應的 member 會有遺失費記錄
-- 3. 預約的書會正確設為 'Reserved' 狀態
-- 4. 會員餘額 = 總儲值 - 借閱費用 - 額外費用（包括罰金）
-- 5. 一個會員只能對同一本書進行一筆 Active 預約

-- ============================================
-- 階段 1：清理現有數據
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '開始清理現有數據...';
    
    -- 按外鍵約束順序清理
    DELETE FROM ADD_FEE;
    DELETE FROM LOAN_RECORD;
    DELETE FROM BOOK_LOAN;
    DELETE FROM RESERVATION_RECORD;
    DELETE FROM RESERVATION;
    DELETE FROM TOP_UP;
    
    -- 重置 BOOK_COPIES 狀態（全部設為 Available）
    UPDATE BOOK_COPIES SET status = 'Available';
    
    -- 重置 MEMBER balance
    UPDATE MEMBER SET balance = 0;
    
    RAISE NOTICE '✅ 數據清理完成';
END $$;

-- ============================================
-- 階段 2：生成 TOP_UP 記錄
-- ============================================
DO $$
DECLARE
    member_rec RECORD;
    admin_ids INTEGER[];
    random_admin_id INTEGER;
    top_up_date_val DATE;
    top_up_amount INTEGER;
    join_date_val DATE;
    i INTEGER;
    end_date DATE := '2025-12-05'::DATE;
    days_since_join INTEGER;
BEGIN
    SELECT ARRAY_AGG(admin_id) INTO admin_ids FROM ADMIN WHERE status = 'Active';
    
    IF array_length(admin_ids, 1) IS NULL THEN
        RAISE EXCEPTION '沒有可用的管理員';
    END IF;
    
    FOR member_rec IN SELECT member_id, join_date FROM MEMBER
    LOOP
        join_date_val := member_rec.join_date;
        days_since_join := end_date - join_date_val;
        
        IF days_since_join <= 0 THEN
            CONTINUE;
        END IF;
        
        -- 每個會員生成 1-5 筆儲值記錄
        FOR i IN 1..(1 + floor(random() * 5)::INTEGER)
        LOOP
            top_up_date_val := join_date_val + (floor(random() * days_since_join)::INTEGER || ' days')::INTERVAL;
            
            random_admin_id := admin_ids[1 + floor(random() * array_length(admin_ids, 1))::INTEGER];
            
            -- 隨機儲值金額（100-10000 元）
            top_up_amount := 100 + floor(random() * 9900)::INTEGER;
            
            INSERT INTO TOP_UP (member_id, admin_id, amount, top_up_date)
            VALUES (member_rec.member_id, random_admin_id, top_up_amount, top_up_date_val);
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成儲值記錄';
END $$;

-- ============================================
-- 階段 3：生成 RESERVATION 和 RESERVATION_RECORD（在借閱之前）
-- ============================================
-- 注意：預約在借閱之前生成，這樣借閱時可以考慮預約情況
DO $$
DECLARE
    member_rec RECORD;
    reservation_date DATE;
    pickup_date DATE;
    status_val VARCHAR(15);
    reservation_id_val BIGINT;
    book_rec RECORD;
    start_date DATE := '2023-01-01'::DATE;
    end_date DATE := '2025-12-05'::DATE;
    days_range INTEGER;
    books_to_reserve INTEGER;
    i INTEGER;
    member_count INTEGER;
    selected_members INTEGER;
    year_weight REAL;
    days_in_year INTEGER;
    year_start DATE;
BEGIN
    days_range := end_date - start_date;
    
    -- 選擇 30-50% 的活躍會員生成預約
    SELECT COUNT(*) INTO member_count FROM MEMBER WHERE status = 'Active';
    selected_members := floor(member_count * (0.3 + random() * 0.2))::INTEGER;
    
    FOR member_rec IN 
        SELECT member_id FROM MEMBER WHERE status = 'Active'
        ORDER BY RANDOM()
        LIMIT selected_members
    LOOP
        -- 每個會員生成 0-3 筆預約
        FOR i IN 1..(floor(random() * 4)::INTEGER)
        LOOP
            -- 使用加權隨機分布選擇年份
            year_weight := random();
            IF year_weight < 0.2 THEN
                year_start := '2023-01-01'::DATE;
                days_in_year := 365;
            ELSIF year_weight < 0.6 THEN
                year_start := '2024-01-01'::DATE;
                days_in_year := 365;
            ELSE
                year_start := '2025-01-01'::DATE;
                days_in_year := 335;
            END IF;
            
            reservation_date := year_start + (floor(random() * days_in_year)::INTEGER || ' days')::INTERVAL;
            
            -- 隨機決定狀態（40% Active, 40% Fulfilled, 20% Cancelled）
            IF random() < 0.4 THEN
                status_val := 'Active';
                pickup_date := NULL;
            ELSIF random() < 0.8 THEN
                status_val := 'Fulfilled';
                pickup_date := reservation_date + (floor(random() * 7)::INTEGER || ' days')::INTERVAL;
                IF pickup_date > '2025-12-05'::DATE THEN
                    pickup_date := '2025-12-05'::DATE;
                END IF;
            ELSE
                status_val := 'Cancelled';
                pickup_date := NULL;
            END IF;
            
            INSERT INTO RESERVATION (member_id, reserve_date, pickup_date, status)
            VALUES (member_rec.member_id, reservation_date, pickup_date, status_val)
            RETURNING reservation_id INTO reservation_id_val;
            
            -- 每筆預約 1-3 本書
            books_to_reserve := 1 + floor(random() * 3)::INTEGER;
            
            -- 為每筆預約分配書籍，確保一個會員不會對同一本書有重複的 Active 預約
            FOR book_rec IN 
                SELECT book_id
                FROM (
                    SELECT DISTINCT b.book_id, RANDOM() as rnd
                    FROM BOOK b
                    WHERE NOT EXISTS (
                        -- 檢查該會員是否已經有該本書的 Active 預約
                        SELECT 1
                        FROM RESERVATION r
                        JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
                        WHERE r.member_id = member_rec.member_id
                          AND rr.book_id = b.book_id
                          AND r.status = 'Active'
                    )
                ) sub
                ORDER BY rnd
                LIMIT books_to_reserve
            LOOP
                INSERT INTO RESERVATION_RECORD (reservation_id, book_id)
                VALUES (reservation_id_val, book_rec.book_id)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成預約記錄';
END $$;

-- ============================================
-- 階段 4：更新 BOOK_COPIES 狀態（根據預約）
-- ============================================
-- 為 Active 預約分配 reserved 複本
DO $$
DECLARE
    book_rec RECORD;
    available_copy RECORD;
    reserved_count INTEGER;
    reserved_copies INTEGER;
BEGIN
    -- 對每本書，統計有多少 Active 預約
    FOR book_rec IN 
        SELECT DISTINCT b.book_id
        FROM BOOK b
        JOIN RESERVATION_RECORD rr ON b.book_id = rr.book_id
        JOIN RESERVATION r ON rr.reservation_id = r.reservation_id
        WHERE r.status = 'Active'
    LOOP
        -- 統計這本書有多少 Active 預約
        SELECT COUNT(DISTINCT r.reservation_id) INTO reserved_count
        FROM RESERVATION r
        JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
        WHERE rr.book_id = book_rec.book_id
          AND r.status = 'Active';
        
        -- 統計這本書有多少 Available 複本
        SELECT COUNT(*) INTO reserved_copies
        FROM BOOK_COPIES bc
        WHERE bc.book_id = book_rec.book_id
          AND bc.status = 'Available';
        
        -- 從這本書的 Available 複本中，選擇 min(reserved_count, reserved_copies) 個設為 Reserved
        UPDATE BOOK_COPIES bc
        SET status = 'Reserved'
        WHERE bc.book_id = book_rec.book_id
          AND bc.status = 'Available'
          AND bc.copies_serial IN (
              SELECT bc2.copies_serial
              FROM BOOK_COPIES bc2
              WHERE bc2.book_id = book_rec.book_id
                AND bc2.status = 'Available'
              ORDER BY bc2.copies_serial
              LIMIT LEAST(reserved_count, reserved_copies)
          );
    END LOOP;
    
    RAISE NOTICE '✅ BOOK_COPIES 狀態已根據預約更新';
END $$;

-- ============================================
-- 階段 5：生成 BOOK_LOAN 和 LOAN_RECORD（12000 筆）
-- ============================================
-- 按時間順序生成借閱記錄，確保資料一致性
-- 時間分布：集中在最近時間段（2024-2025 年更多記錄）
DO $$
DECLARE
    member_rec RECORD;
    admin_ids INTEGER[];
    random_admin_id INTEGER;
    loan_date DATE;
    return_date DATE;
    due_date DATE;
    books_to_borrow INTEGER;
    i INTEGER;
    loan_id_val BIGINT;
    total_loans INTEGER := 0;
    target_loans INTEGER := 12000; -- 目標：12000 筆 LOAN_RECORD
    copy_rec RECORD;
    rental_fee_val INTEGER;
    total_fee INTEGER;
    member_level_id INTEGER;
    discount_rate_val DECIMAL(3,2);
    hold_days_val INTEGER;
    renew_cnt_val INTEGER;
    is_lost BOOLEAN;
    lost_probability REAL := 0.02; -- 2% 機率遺失
    year_weight REAL;
    days_in_year INTEGER;
    year_start DATE;
    copy_available BOOLEAN;
    has_reservation BOOLEAN;
    selected_copies TEXT[]; -- 追蹤已經選擇的複本，避免重複
BEGIN
    SELECT ARRAY_AGG(admin_id) INTO admin_ids FROM ADMIN WHERE status = 'Active';
    
    IF array_length(admin_ids, 1) IS NULL THEN
        RAISE EXCEPTION '沒有可用的管理員';
    END IF;
    
    -- 生成借閱記錄，直到達到目標數量
    WHILE total_loans < target_loans
    LOOP
        -- 隨機選擇一個活躍會員
        -- 優化：使用 TABLESAMPLE 或直接隨機選擇，減少 ORDER BY RANDOM() 的開銷
        FOR member_rec IN 
            SELECT m.member_id, ml.max_book_allowed, ml.discount_rate, ml.hold_days, m.level_id
            FROM MEMBER m 
            JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id 
            WHERE m.status = 'Active'
            ORDER BY RANDOM()
            LIMIT 1
        LOOP
            -- 使用加權隨機分布選擇年份（2023年：20%，2024年：40%，2025年：40%）
            year_weight := random();
            IF year_weight < 0.2 THEN
                -- 2023年
                year_start := '2023-01-01'::DATE;
                days_in_year := 365;
            ELSIF year_weight < 0.6 THEN
                -- 2024年
                year_start := '2024-01-01'::DATE;
                days_in_year := 365;
            ELSE
                -- 2025年
                year_start := '2025-01-01'::DATE;
                days_in_year := 335; -- 到 2025-12-05
            END IF;
            
            loan_date := year_start + (floor(random() * days_in_year)::INTEGER || ' days')::INTERVAL;
            
            random_admin_id := admin_ids[1 + floor(random() * array_length(admin_ids, 1))::INTEGER];
            
            books_to_borrow := LEAST(1 + floor(random() * 3)::INTEGER, member_rec.max_book_allowed);
            total_fee := 0;
            
            -- 建立借閱交易
            INSERT INTO BOOK_LOAN (admin_id, member_id, final_price)
            VALUES (random_admin_id, member_rec.member_id, 0)
            RETURNING loan_id INTO loan_id_val;
            
            -- 初始化已選擇的複本數組
            selected_copies := ARRAY[]::TEXT[];
            
            -- 為每本書選擇一個可用的複本
            FOR i IN 1..books_to_borrow
            LOOP
                -- 選擇複本：優先 Available，如果該會員有預約該書，也可以選擇 Reserved
                -- 排除已經選擇過的複本
                -- 優化：先嘗試選擇 Available 的複本，如果沒有再考慮 Reserved
                SELECT bc.book_id, bc.copies_serial, bc.rental_price, bc.status
                INTO copy_rec
                FROM (
                    -- 先選擇 Available 的複本
                    SELECT bc2.book_id, bc2.copies_serial, bc2.rental_price, bc2.status, 1 as priority
                    FROM BOOK_COPIES bc2
                    WHERE bc2.status = 'Available'
                      AND (bc2.book_id::TEXT || ',' || bc2.copies_serial::TEXT) != ALL(selected_copies)
                    
                    UNION ALL
                    
                    -- 如果該會員有預約該書，也可以選擇 Reserved 的複本
                    SELECT bc3.book_id, bc3.copies_serial, bc3.rental_price, bc3.status, 2 as priority
                    FROM BOOK_COPIES bc3
                    WHERE bc3.status = 'Reserved'
                      AND (bc3.book_id::TEXT || ',' || bc3.copies_serial::TEXT) != ALL(selected_copies)
                      AND EXISTS (
                          SELECT 1 FROM RESERVATION r
                          JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
                          WHERE r.member_id = member_rec.member_id
                            AND rr.book_id = bc3.book_id
                            AND r.status = 'Active'
                      )
                ) bc
                ORDER BY priority, RANDOM()
                LIMIT 1;
                
                -- 如果沒有可用的複本，跳過這筆借閱
                IF copy_rec.book_id IS NULL THEN
                    EXIT;
                END IF;
                
                -- 計算租金
                rental_fee_val := floor(copy_rec.rental_price * member_rec.discount_rate)::INTEGER;
                total_fee := total_fee + rental_fee_val;
                
                -- 計算應還日期
                due_date := loan_date + (member_rec.hold_days || ' days')::INTERVAL;
                
                -- 決定是否已歸還（90% 已歸還，10% 未歸還，減少逾期書籍）
                IF random() < 0.9 THEN
                    -- 已歸還：80% 在應還日期之前或當天歸還，20% 可能逾期 1-7 天
                    IF random() < 0.8 THEN
                        -- 80% 在應還日期之前或當天歸還
                        return_date := loan_date + (floor(random() * (member_rec.hold_days + 1))::INTEGER || ' days')::INTERVAL;
                    ELSE
                        -- 20% 可能逾期 1-7 天
                        return_date := due_date + (1 + floor(random() * 7)::INTEGER || ' days')::INTERVAL;
                    END IF;
                    -- 確保 return_date 不超過 2025-12-05
                    IF return_date > '2025-12-05'::DATE THEN
                        return_date := '2025-12-05'::DATE;
                    END IF;
                ELSE
                    return_date := NULL;
                END IF;
                
                -- 決定是否續借（只有在未歸還的情況下才可能續借，20% 機率）
                IF return_date IS NULL AND random() < 0.2 THEN
                    renew_cnt_val := 1;
                    due_date := due_date + 7;
                ELSE
                    renew_cnt_val := 0;
                END IF;
                
                -- 決定是否遺失（只有在已歸還的情況下才可能遺失，2% 機率）
                is_lost := (return_date IS NOT NULL AND random() < lost_probability);
                
                -- 插入借閱記錄
                INSERT INTO LOAN_RECORD (
                    loan_id, book_id, copies_serial, date_out, 
                    due_date, return_date, rental_fee, renew_cnt
                )
                VALUES (
                    loan_id_val, copy_rec.book_id, 
                    copy_rec.copies_serial, loan_date,
                    due_date, return_date, rental_fee_val, renew_cnt_val
                );
                
                -- 將選擇的複本加入到追蹤數組，避免重複選擇
                selected_copies := array_append(selected_copies, copy_rec.book_id::TEXT || ',' || copy_rec.copies_serial::TEXT);
                
                -- 注意：不在此處更新複本狀態，因為階段 7 會重新計算所有狀態以確保一致性
                -- 這樣可以大幅提升性能，減少資料庫操作
                
                -- 如果借的是 Reserved 的複本，且該會員有 Active 預約，更新預約狀態為 Fulfilled
                -- 這個更新是必要的，因為它影響預約狀態，不會在階段 7 重新計算
                IF copy_rec.status = 'Reserved' THEN
                    UPDATE RESERVATION r
                    SET status = 'Fulfilled', 
                        pickup_date = GREATEST(loan_date, r.reserve_date)
                    WHERE r.reservation_id = (
                        SELECT r2.reservation_id
                        FROM RESERVATION r2
                        JOIN RESERVATION_RECORD rr ON r2.reservation_id = rr.reservation_id
                        WHERE rr.book_id = copy_rec.book_id
                          AND r2.member_id = member_rec.member_id
                          AND r2.status = 'Active'
                        LIMIT 1
                    )
                    AND r.status = 'Active';
                END IF;
            END LOOP;
            
            -- 更新借閱交易的總金額
            UPDATE BOOK_LOAN 
            SET final_price = total_fee 
            WHERE loan_id = loan_id_val;
            
            total_loans := total_loans + 1;
            
            -- 每 500 筆顯示進度（更頻繁的進度提示）
            IF total_loans % 500 = 0 THEN
                RAISE NOTICE '已生成 % / % 筆借閱記錄 (%.1f%%)', 
                    total_loans, target_loans, 
                    (total_loans::NUMERIC / target_loans * 100);
            END IF;
            
            IF total_loans >= target_loans THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成 % 筆借閱記錄', total_loans;
END $$;

-- ============================================
-- 階段 6：生成 ADD_FEE 記錄
-- ============================================
-- 根據借閱記錄生成額外費用，確保資料一致性
DO $$
DECLARE
    loan_record_rec RECORD;
    fee_amount INTEGER;
    fee_date DATE;
    overdue_days INTEGER;
    lost_fee_amount DECIMAL(4,3);
    damage_rate DECIMAL(4,3);
BEGIN
    FOR loan_record_rec IN 
        SELECT lr.loan_id, lr.book_id, lr.copies_serial, 
               lr.date_out, lr.due_date, lr.return_date, lr.renew_cnt,
               bc.purchase_price, bc.status AS copy_status
        FROM LOAN_RECORD lr
        JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
    LOOP
        -- 續借費（如果 renew_cnt > 0）
        IF loan_record_rec.renew_cnt > 0 THEN
            SELECT base_amount INTO fee_amount FROM FEE_TYPE WHERE type = 'renew';
            IF fee_amount IS NOT NULL THEN
                fee_date := loan_record_rec.due_date - 7;
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'renew', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
            END IF;
        END IF;
        
        -- 逾期費（如果 return_date > due_date 或未歸還但已逾期）
        IF (loan_record_rec.return_date IS NOT NULL 
            AND loan_record_rec.return_date > loan_record_rec.due_date)
           OR (loan_record_rec.return_date IS NULL 
               AND loan_record_rec.due_date < '2025-12-05'::DATE) THEN
            SELECT base_amount INTO fee_amount FROM FEE_TYPE WHERE type = 'overdue';
            
            IF fee_amount IS NOT NULL THEN
                IF loan_record_rec.return_date IS NOT NULL THEN
                    overdue_days := loan_record_rec.return_date - loan_record_rec.due_date;
                ELSE
                    overdue_days := '2025-12-05'::DATE - loan_record_rec.due_date;
                END IF;
                
                -- 限制逾期費：最多收取 365 天的費用
                IF overdue_days > 365 THEN
                    overdue_days := 365;
                END IF;
                
                fee_amount := fee_amount * overdue_days;
                fee_date := loan_record_rec.due_date + 1;
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'overdue', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) 
                DO UPDATE SET amount = EXCLUDED.amount, date = EXCLUDED.date;
            END IF;
        END IF;
        
        -- 遺失費（如果複本狀態為 Lost）
        IF loan_record_rec.copy_status = 'Lost' THEN
            SELECT rate INTO lost_fee_amount FROM FEE_TYPE WHERE type = 'lost';
            IF lost_fee_amount IS NOT NULL THEN
                fee_amount := floor(loan_record_rec.purchase_price * lost_fee_amount)::INTEGER;
                fee_date := COALESCE(loan_record_rec.return_date, loan_record_rec.due_date + 1);
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'lost', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
            END IF;
        END IF;
        
        -- 損壞費（5% 機率，只在已歸還且未遺失的情況下產生）
        IF loan_record_rec.return_date IS NOT NULL 
           AND loan_record_rec.copy_status != 'Lost' 
           AND random() < 0.05 THEN
            -- 隨機選擇損壞類型
            IF random() < 0.33 THEN
                SELECT rate INTO damage_rate FROM FEE_TYPE WHERE type = 'damage_good_to_fair';
                IF damage_rate IS NOT NULL THEN
                    fee_amount := floor(loan_record_rec.purchase_price * damage_rate)::INTEGER;
                    fee_date := loan_record_rec.return_date;
                    
                    INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                    VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                            loan_record_rec.copies_serial, 'damage_good_to_fair', fee_amount, fee_date)
                    ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
                END IF;
            ELSIF random() < 0.66 THEN
                SELECT rate INTO damage_rate FROM FEE_TYPE WHERE type = 'damage_fair_to_poor';
                IF damage_rate IS NOT NULL THEN
                    fee_amount := floor(loan_record_rec.purchase_price * damage_rate)::INTEGER;
                    fee_date := loan_record_rec.return_date;
                    
                    INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                    VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                            loan_record_rec.copies_serial, 'damage_fair_to_poor', fee_amount, fee_date)
                    ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
                END IF;
            ELSE
                SELECT rate INTO damage_rate FROM FEE_TYPE WHERE type = 'damage_good_to_poor';
                IF damage_rate IS NOT NULL THEN
                    fee_amount := floor(loan_record_rec.purchase_price * damage_rate)::INTEGER;
                    fee_date := loan_record_rec.return_date;
                    
                    INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                    VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                            loan_record_rec.copies_serial, 'damage_good_to_poor', fee_amount, fee_date)
                    ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成額外費用記錄';
END $$;

-- ============================================
-- 階段 7：更新 BOOK_COPIES 狀態（最終一致性檢查）
-- ============================================
-- 根據所有借閱和預約記錄，重新計算並更新 BOOK_COPIES.status
DO $$
DECLARE
    copy_rec RECORD;
    has_active_loan BOOLEAN;
    has_lost_fee BOOLEAN;
    book_id_val BIGINT;
    active_reservation_count INTEGER;
    available_copies INTEGER;
BEGIN
    -- 先將所有複本設為 Available
    UPDATE BOOK_COPIES 
    SET status = 'Available';
    
    -- 1. 找出所有遺失的複本（有 lost 類型的 ADD_FEE），設為 Lost（優先級最高）
    FOR copy_rec IN
        SELECT DISTINCT af.book_id, af.copies_serial
        FROM ADD_FEE af
        WHERE af.type = 'lost'
    LOOP
        UPDATE BOOK_COPIES
        SET status = 'Lost'
        WHERE book_id = copy_rec.book_id 
          AND copies_serial = copy_rec.copies_serial;
    END LOOP;
    
    -- 2. 找出所有未歸還的借閱，設為 Borrowed（排除 Lost）
    FOR copy_rec IN
        SELECT DISTINCT lr.book_id, lr.copies_serial
        FROM LOAN_RECORD lr
        WHERE lr.return_date IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM ADD_FEE af
              WHERE af.loan_id = lr.loan_id
                AND af.book_id = lr.book_id
                AND af.copies_serial = lr.copies_serial
                AND af.type = 'lost'
          )
    LOOP
        UPDATE BOOK_COPIES
        SET status = 'Borrowed'
        WHERE book_id = copy_rec.book_id 
          AND copies_serial = copy_rec.copies_serial
          AND status != 'Lost';
    END LOOP;
    
    -- 3. 找出所有 Active 預約的書籍，為每本書選擇一個 Available 複本設為 Reserved
    FOR book_id_val IN
        SELECT DISTINCT rr.book_id
        FROM RESERVATION r
        JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
        WHERE r.status = 'Active'
    LOOP
        -- 統計這本書有多少 Active 預約
        SELECT COUNT(DISTINCT r.reservation_id) INTO active_reservation_count
        FROM RESERVATION r
        JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
        WHERE rr.book_id = book_id_val
          AND r.status = 'Active';
        
        -- 統計這本書有多少 Available 複本
        SELECT COUNT(*) INTO available_copies
        FROM BOOK_COPIES bc
        WHERE bc.book_id = book_id_val
          AND bc.status = 'Available';
        
        -- 從這本書的 Available 複本中，選擇 min(active_reservation_count, available_copies) 個設為 Reserved
        -- 使用子查詢更新，確保只更新 Available 的複本
        UPDATE BOOK_COPIES bc
        SET status = 'Reserved'
        WHERE bc.book_id = book_id_val
          AND bc.status = 'Available'
          AND bc.copies_serial IN (
              SELECT bc2.copies_serial
              FROM BOOK_COPIES bc2
              WHERE bc2.book_id = book_id_val
                AND bc2.status = 'Available'
              ORDER BY bc2.copies_serial
              LIMIT LEAST(active_reservation_count, available_copies)
          );
    END LOOP;
    
    RAISE NOTICE '✅ BOOK_COPIES 狀態已根據所有記錄更新（最終一致性檢查）';
END $$;

-- ============================================
-- 階段 8：更新 MEMBER balance
-- ============================================
-- 根據儲值記錄、借閱費用和額外費用更新會員餘額
-- balance = 總儲值金額 - 借閱費用 - 額外費用
DO $$
DECLARE
    member_rec RECORD;
    total_spent INTEGER;
    total_top_up INTEGER;
    new_balance INTEGER;
    loan_fee INTEGER;
    add_fee_amount INTEGER;
BEGIN
    FOR member_rec IN SELECT member_id FROM MEMBER
    LOOP
        -- 計算總儲值金額
        SELECT COALESCE(SUM(amount), 0) INTO total_top_up
        FROM TOP_UP
        WHERE member_id = member_rec.member_id;
        
        -- 計算借閱費用（從 BOOK_LOAN.final_price）
        SELECT COALESCE(SUM(final_price), 0) INTO loan_fee
        FROM BOOK_LOAN
        WHERE member_id = member_rec.member_id;
        
        -- 計算額外費用（透過 LOAN_RECORD 關聯）
        SELECT COALESCE(SUM(af.amount), 0) INTO add_fee_amount
        FROM BOOK_LOAN bl
        JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
        JOIN ADD_FEE af ON lr.loan_id = af.loan_id 
            AND lr.book_id = af.book_id 
            AND lr.copies_serial = af.copies_serial
        WHERE bl.member_id = member_rec.member_id;
        
        -- 計算總支出
        total_spent := loan_fee + add_fee_amount;
        
        -- 計算新餘額（確保不為負數）
        new_balance := GREATEST(0, total_top_up - total_spent);
        
        -- 更新會員餘額
        UPDATE MEMBER 
        SET balance = new_balance 
        WHERE member_id = member_rec.member_id;
    END LOOP;
    
    RAISE NOTICE '✅ 會員餘額已更新（根據儲值記錄和所有費用）';
END $$;

-- ============================================
-- 階段 9：資料一致性驗證
-- ============================================
DO $$
DECLARE
    lost_count INTEGER;
    lost_fee_count INTEGER;
    borrowed_count INTEGER;
    active_loan_count INTEGER;
    reserved_count INTEGER;
    active_reservation_count INTEGER;
    balance_mismatch_count INTEGER;
BEGIN
    RAISE NOTICE '開始資料一致性驗證...';
    
    -- 驗證 Lost 狀態與遺失費的一致性
    SELECT COUNT(*) INTO lost_count
    FROM BOOK_COPIES
    WHERE status = 'Lost';
    
    SELECT COUNT(DISTINCT (book_id, copies_serial)) INTO lost_fee_count
    FROM ADD_FEE
    WHERE type = 'lost';
    
    IF lost_count != lost_fee_count THEN
        RAISE WARNING '⚠️ Lost 複本數量 (%) 與遺失費記錄數量 (%) 不一致', lost_count, lost_fee_count;
    ELSE
        RAISE NOTICE '✅ Lost 複本與遺失費記錄一致: % 個', lost_count;
    END IF;
    
    -- 驗證 Borrowed 狀態與未歸還借閱的一致性
    SELECT COUNT(*) INTO borrowed_count
    FROM BOOK_COPIES
    WHERE status = 'Borrowed';
    
    SELECT COUNT(*) INTO active_loan_count
    FROM LOAN_RECORD
    WHERE return_date IS NULL;
    
    IF borrowed_count != active_loan_count THEN
        RAISE WARNING '⚠️ Borrowed 複本數量 (%) 與未歸還借閱數量 (%) 不一致', borrowed_count, active_loan_count;
    ELSE
        RAISE NOTICE '✅ Borrowed 複本與未歸還借閱一致: % 個', borrowed_count;
    END IF;
    
    -- 驗證 Reserved 狀態與 Active 預約的一致性
    SELECT COUNT(*) INTO reserved_count
    FROM BOOK_COPIES
    WHERE status = 'Reserved';
    
    SELECT COUNT(DISTINCT rr.book_id) INTO active_reservation_count
    FROM RESERVATION r
    JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
    WHERE r.status = 'Active';
    
    IF reserved_count != active_reservation_count THEN
        RAISE WARNING '⚠️ Reserved 複本數量 (%) 與 Active 預約書籍數量 (%) 不一致', reserved_count, active_reservation_count;
    ELSE
        RAISE NOTICE '✅ Reserved 複本與 Active 預約一致: % 個', reserved_count;
    END IF;
    
    -- 驗證會員餘額計算正確性（抽樣檢查前 10 個會員）
    SELECT COUNT(*) INTO balance_mismatch_count
    FROM (
        SELECT m.member_id,
               m.balance AS current_balance,
               COALESCE(SUM(t.amount), 0) - 
               COALESCE(SUM(bl.final_price), 0) - 
               COALESCE(SUM(af.amount), 0) AS calculated_balance
        FROM MEMBER m
        LEFT JOIN TOP_UP t ON m.member_id = t.member_id
        LEFT JOIN BOOK_LOAN bl ON m.member_id = bl.member_id
        LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
        LEFT JOIN ADD_FEE af ON lr.loan_id = af.loan_id 
            AND lr.book_id = af.book_id 
            AND lr.copies_serial = af.copies_serial
        GROUP BY m.member_id, m.balance
        HAVING GREATEST(0, COALESCE(SUM(t.amount), 0) - COALESCE(SUM(bl.final_price), 0) - COALESCE(SUM(af.amount), 0)) != m.balance
        LIMIT 10
    ) mismatch;
    
    IF balance_mismatch_count > 0 THEN
        RAISE WARNING '⚠️ 發現 % 個會員的餘額計算不一致', balance_mismatch_count;
    ELSE
        RAISE NOTICE '✅ 會員餘額計算正確（抽樣檢查通過）';
    END IF;
    
    RAISE NOTICE '✅ 資料一致性驗證完成';
END $$;

-- ============================================
-- 完成訊息
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 虛擬資料生成完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '已生成：';
    RAISE NOTICE '  - % 筆儲值記錄', (SELECT COUNT(*) FROM TOP_UP);
    RAISE NOTICE '  - % 筆借閱交易', (SELECT COUNT(*) FROM BOOK_LOAN);
    RAISE NOTICE '  - % 筆借閱記錄', (SELECT COUNT(*) FROM LOAN_RECORD);
    RAISE NOTICE '  - % 筆額外費用', (SELECT COUNT(*) FROM ADD_FEE);
    RAISE NOTICE '  - % 筆預約記錄', (SELECT COUNT(*) FROM RESERVATION);
    RAISE NOTICE '  - % 筆預約書籍關聯', (SELECT COUNT(*) FROM RESERVATION_RECORD);
    RAISE NOTICE '';
    RAISE NOTICE 'BOOK_COPIES 狀態統計：';
    RAISE NOTICE '  - Available: % 個', (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Available');
    RAISE NOTICE '  - Reserved: % 個', (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Reserved');
    RAISE NOTICE '  - Borrowed: % 個', (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Borrowed');
    RAISE NOTICE '  - Lost: % 個', (SELECT COUNT(*) FROM BOOK_COPIES WHERE status = 'Lost');
    RAISE NOTICE '========================================';
END $$;
