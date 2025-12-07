-- ============================================
-- 獨立租借書店系統 - 虛擬資料生成腳本（重新設計）
-- PostgreSQL (Supabase)
-- ============================================
-- 此腳本生成測試用的虛擬資料，確保資料一致性
-- 執行前請確保已執行 001_initial_schema.sql 和 seed.sql
-- 
-- 資料一致性保證：
-- 1. 如果有 member 正在借一本書，那本書的 available_count 會正確減少
-- 2. 如果有書 lost，對應的 member 會被扣罰金
-- 3. 預約的書會正確設為 reserved 狀態
-- 4. 會員餘額 = 總儲值 - 借閱費用 - 額外費用（包括罰金）
-- 5. 一個會員只能對同一本書進行一筆預約

-- ============================================
-- 清理舊資料（可選，用於重新生成）
-- ============================================
-- 注意：如果資料庫已有重要資料，請註解掉以下清理語句
/*
DELETE FROM ADD_FEE;
DELETE FROM LOAN_RECORD;
DELETE FROM BOOK_LOAN;
DELETE FROM RESERVATION_RECORD;
DELETE FROM RESERVATION;
DELETE FROM TOP_UP;
DELETE FROM MEMBER WHERE member_id > 100; -- 保留 seed 中的測試會員
DELETE FROM BOOK_COPIES;
DELETE FROM ADMIN WHERE admin_id > 10; -- 保留 seed 中的測試管理員
*/

-- ============================================
-- 1. ADMIN - 店員/管理員資料
-- ============================================
INSERT INTO ADMIN (name, phone, role, status) VALUES
('張經理', '0912345678', 'Manager', 'Active'),
('李店員', '0923456789', 'Clerk', 'Active'),
('王店員', '0934567890', 'Clerk', 'Active'),
('陳店員', '0945678901', 'Clerk', 'Active'),
('林店員', '0956789012', 'Clerk', 'Active'),
('黃店員', '0967890123', 'Clerk', 'Active'),
('吳店員', '0978901234', 'Clerk', 'Active'),
('劉店員', '0989012345', 'Clerk', 'Active')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. MEMBER - 會員資料
-- ============================================
DO $$
DECLARE
    i INTEGER;
    member_name VARCHAR(30);
    level_id_val INTEGER;
    admin_id_val INTEGER;
    join_date_val DATE;
    email_val VARCHAR(50);
    phone_val VARCHAR(15);
    status_val VARCHAR(15);
BEGIN
    -- 生成 100 位會員
    FOR i IN 1..100
    LOOP
        -- 隨機分配等級（銅 40%, 銀 40%, 金 20%）
        IF random() < 0.4 THEN
            level_id_val := 1; -- 銅
        ELSIF random() < 0.8 THEN
            level_id_val := 2; -- 銀
        ELSE
            level_id_val := 3; -- 金
        END IF;
        
        -- 隨機分配管理員
        SELECT admin_id INTO admin_id_val
        FROM ADMIN
        ORDER BY RANDOM()
        LIMIT 1;
        
        -- 隨機加入日期（2022/1/1 ~ 2025/12/5）
        join_date_val := '2022-01-01'::DATE + (floor(random() * 1400)::INTEGER || ' days')::INTERVAL;
        
        -- 生成姓名、email、電話
        member_name := '會員' || i;
        email_val := 'member' || i || '@example.com';
        phone_val := '09' || LPAD((10000000 + i)::TEXT, 8, '0');
        
        -- 狀態（90% Active, 5% Inactive, 5% Suspended）
        IF random() < 0.9 THEN
            status_val := 'Active';
        ELSIF random() < 0.95 THEN
            status_val := 'Inactive';
        ELSE
            status_val := 'Suspended';
        END IF;
        
        -- 初始 balance 設為 0，之後會根據 TOP_UP 和費用更新
        INSERT INTO MEMBER (name, level_id, admin_id, join_date, email, phone, balance, status)
        VALUES (member_name, level_id_val, admin_id_val, join_date_val, email_val, phone_val, 0, status_val)
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成會員資料';
END $$;

-- ============================================
-- 3. BOOK_COPIES - 書籍複本資料
-- ============================================
DO $$
DECLARE
    book_rec RECORD;
    copies_count INTEGER;
    i INTEGER;
    purchase_date DATE;
    purchase_price INTEGER;
    condition_val VARCHAR(20);
    rental_price INTEGER;
BEGIN
    FOR book_rec IN SELECT book_id, price FROM BOOK ORDER BY book_id
    LOOP
        -- 每一本書都至少有一個複本
        -- 60% 的書只有 1 個複本，40% 的書有 2-5 個複本
        IF random() < 0.6 THEN
            copies_count := 1;
        ELSE
            copies_count := 2 + floor(random() * 4)::INTEGER;
        END IF;
        
        FOR i IN 1..copies_count
        LOOP
            -- 隨機生成採購日期（2020/1/1 ~ 2025/12/5）
            purchase_date := '2020-01-01'::DATE + (floor(random() * 2165)::INTEGER || ' days')::INTERVAL;
            
            -- 採購價為定價的 70-90%
            purchase_price := floor(book_rec.price * (0.7 + random() * 0.2))::INTEGER;
            
            -- 隨機書況（Good 60%, Fair 30%, Poor 10%）
            IF random() < 0.6 THEN
                condition_val := 'Good';
            ELSIF random() < 0.9 THEN
                condition_val := 'Fair';
            ELSE
                condition_val := 'Poor';
            END IF;
            
            -- 計算租金（定價 × 折扣因子）
            SELECT cd.discount_factor INTO rental_price 
            FROM CONDITION_DISCOUNT cd
            WHERE cd.book_condition = condition_val;
            rental_price := floor(book_rec.price * rental_price)::INTEGER;
            
            -- 初始狀態全部設為 'Available'
            INSERT INTO BOOK_COPIES (
                book_id, copies_serial, status, purchase_date, 
                purchase_price, book_condition, rental_price
            )
            VALUES (
                book_rec.book_id, i, 'Available', purchase_date,
                purchase_price, condition_val, rental_price
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成書籍複本資料';
END $$;

-- ============================================
-- 4. TOP_UP - 儲值記錄（先生成，用於後續計算餘額）
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
    
    FOR member_rec IN SELECT member_id, join_date FROM MEMBER
    LOOP
        join_date_val := member_rec.join_date;
        days_since_join := end_date - join_date_val;
        
        -- 每個會員生成 1-5 筆儲值記錄
        FOR i IN 1..(1 + floor(random() * 5)::INTEGER)
        LOOP
            top_up_date_val := join_date_val + (floor(random() * days_since_join)::INTEGER || ' days')::INTERVAL;
            
            IF array_length(admin_ids, 1) > 0 THEN
                random_admin_id := admin_ids[1 + floor(random() * array_length(admin_ids, 1))::INTEGER];
            ELSE
                RAISE EXCEPTION '沒有可用的管理員';
            END IF;
            
            -- 隨機儲值金額（100-10000 元）
            top_up_amount := 100 + floor(random() * 9900)::INTEGER;
            
            INSERT INTO TOP_UP (member_id, admin_id, amount, top_up_date)
            VALUES (member_rec.member_id, random_admin_id, top_up_amount, top_up_date_val)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成儲值記錄';
END $$;

-- ============================================
-- 5. BOOK_LOAN + LOAN_RECORD - 借閱交易與記錄
-- ============================================
-- 按時間順序生成借閱記錄，確保資料一致性
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
    target_loans INTEGER := 1200;
    start_date DATE := '2023-01-01'::DATE;
    end_date DATE := '2025-12-05'::DATE;
    days_range INTEGER;
    copy_rec RECORD;
    rental_fee_val INTEGER;
    total_fee INTEGER;
    member_level_id INTEGER;
    discount_rate_val DECIMAL(3,2);
    hold_days_val INTEGER;
    renew_cnt_val INTEGER;
    is_lost BOOLEAN;
    lost_probability REAL := 0.02; -- 2% 機率遺失
BEGIN
    SELECT ARRAY_AGG(admin_id) INTO admin_ids FROM ADMIN WHERE status = 'Active';
    days_range := end_date - start_date;
    
    WHILE total_loans < target_loans
    LOOP
        FOR member_rec IN 
            SELECT m.member_id, ml.max_book_allowed, ml.discount_rate, ml.hold_days, m.level_id
            FROM MEMBER m 
            JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id 
            WHERE m.status = 'Active'
            ORDER BY RANDOM()
            LIMIT 1
        LOOP
            loan_date := start_date + (floor(random() * days_range)::INTEGER || ' days')::INTERVAL;
            
            IF array_length(admin_ids, 1) > 0 THEN
                random_admin_id := admin_ids[1 + floor(random() * array_length(admin_ids, 1))::INTEGER];
            ELSE
                RAISE EXCEPTION '沒有可用的管理員';
            END IF;
            
            books_to_borrow := LEAST(1 + floor(random() * 3)::INTEGER, member_rec.max_book_allowed);
            total_fee := 0;
            
            -- 建立借閱交易
            INSERT INTO BOOK_LOAN (admin_id, member_id, final_price)
            VALUES (random_admin_id, member_rec.member_id, 0)
            RETURNING loan_id INTO loan_id_val;
            
            -- 為每本書選擇一個可用的複本（在借閱日期時）
            FOR i IN 1..books_to_borrow
            LOOP
                -- 選擇一個在借閱日期時可用的複本
                -- 這裡我們選擇一個隨機的複本，之後會根據實際借閱情況更新狀態
                SELECT bc.book_id, bc.copies_serial, bc.rental_price
                INTO copy_rec
                FROM BOOK_COPIES bc
                WHERE bc.status = 'Available'
                ORDER BY RANDOM()
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
                
                -- 決定是否已歸還（70% 已歸還，30% 未歸還）
                IF random() < 0.7 THEN
                    -- 已歸還：歸還日期在借出日期到應還日期+30天之間
                    return_date := loan_date + (floor(random() * (member_rec.hold_days + 30))::INTEGER || ' days')::INTERVAL;
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
                )
                ON CONFLICT DO NOTHING;
                
                -- 更新複本狀態
                IF is_lost THEN
                    -- 遺失：設為 Lost
                    UPDATE BOOK_COPIES
                    SET status = 'Lost'
                    WHERE book_id = copy_rec.book_id AND copies_serial = copy_rec.copies_serial;
                ELSIF return_date IS NULL THEN
                    -- 未歸還：設為 Borrowed
                    UPDATE BOOK_COPIES
                    SET status = 'Borrowed'
                    WHERE book_id = copy_rec.book_id AND copies_serial = copy_rec.copies_serial;
                ELSE
                    -- 已歸還：設為 Available
                    UPDATE BOOK_COPIES
                    SET status = 'Available'
                    WHERE book_id = copy_rec.book_id AND copies_serial = copy_rec.copies_serial;
                END IF;
            END LOOP;
            
            -- 更新借閱交易的總金額
            UPDATE BOOK_LOAN 
            SET final_price = total_fee 
            WHERE loan_id = loan_id_val;
            
            total_loans := total_loans + 1;
            
            IF total_loans >= target_loans THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成 % 筆借閱記錄', total_loans;
END $$;

-- ============================================
-- 6. ADD_FEE - 額外費用記錄
-- ============================================
-- 根據借閱記錄生成額外費用，確保資料一致性
DO $$
DECLARE
    loan_record_rec RECORD;
    fee_amount INTEGER;
    fee_date DATE;
    overdue_days INTEGER;
    lost_fee_amount INTEGER;
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
            fee_date := loan_record_rec.due_date - 7;
            
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                    loan_record_rec.copies_serial, 'renew', fee_amount, fee_date)
            ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
        END IF;
        
        -- 逾期費（如果 return_date > due_date 或未歸還但已逾期）
        IF (loan_record_rec.return_date IS NOT NULL 
            AND loan_record_rec.return_date > loan_record_rec.due_date)
           OR (loan_record_rec.return_date IS NULL 
               AND loan_record_rec.due_date < CURRENT_DATE) THEN
            SELECT base_amount INTO fee_amount FROM FEE_TYPE WHERE type = 'overdue';
            
            IF loan_record_rec.return_date IS NOT NULL THEN
                overdue_days := loan_record_rec.return_date - loan_record_rec.due_date;
            ELSE
                overdue_days := CURRENT_DATE - loan_record_rec.due_date;
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
        
        -- 遺失費（如果複本狀態為 Lost）
        IF loan_record_rec.copy_status = 'Lost' THEN
            SELECT rate INTO lost_fee_amount FROM FEE_TYPE WHERE type = 'lost';
            lost_fee_amount := floor(loan_record_rec.purchase_price * lost_fee_amount)::INTEGER;
            fee_date := COALESCE(loan_record_rec.return_date, loan_record_rec.due_date + 1);
            
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                    loan_record_rec.copies_serial, 'lost', lost_fee_amount, fee_date)
            ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
        END IF;
        
        -- 損壞費（5% 機率，只在已歸還且未遺失的情況下產生）
        IF loan_record_rec.return_date IS NOT NULL 
           AND loan_record_rec.copy_status != 'Lost' 
           AND random() < 0.05 THEN
            -- 隨機選擇損壞類型
            IF random() < 0.33 THEN
                SELECT rate INTO fee_amount FROM FEE_TYPE WHERE type = 'damage_good_to_fair';
                fee_amount := floor(loan_record_rec.purchase_price * fee_amount)::INTEGER;
                fee_date := loan_record_rec.return_date;
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'damage_good_to_fair', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
            ELSIF random() < 0.66 THEN
                SELECT rate INTO fee_amount FROM FEE_TYPE WHERE type = 'damage_fair_to_poor';
                fee_amount := floor(loan_record_rec.purchase_price * fee_amount)::INTEGER;
                fee_date := loan_record_rec.return_date;
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'damage_fair_to_poor', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ 已生成額外費用記錄';
END $$;

-- ============================================
-- 7. RESERVATION - 預約記錄
-- ============================================
-- 生成預約記錄，確保一個會員只能對同一本書進行一筆預約
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
    existing_reservation_count INTEGER;
BEGIN
    days_range := end_date - start_date;
    
    FOR member_rec IN 
        SELECT member_id FROM MEMBER WHERE status = 'Active'
        ORDER BY RANDOM()
        LIMIT 50
    LOOP
        -- 每個會員生成 0-3 筆預約
        FOR i IN 1..(floor(random() * 4)::INTEGER)
        LOOP
            reservation_date := start_date + (floor(random() * days_range)::INTEGER || ' days')::INTERVAL;
            
            -- 隨機決定狀態
            IF random() < 0.4 THEN
                status_val := 'Active';
                pickup_date := NULL;
            ELSIF random() < 0.8 THEN
                status_val := 'Fulfilled';
                pickup_date := reservation_date + (floor(random() * 7)::INTEGER || ' days')::INTERVAL;
            ELSE
                status_val := 'Cancelled';
                pickup_date := NULL;
            END IF;
            
            INSERT INTO RESERVATION (member_id, reserve_date, pickup_date, status)
            VALUES (member_rec.member_id, reservation_date, pickup_date, status_val)
            RETURNING reservation_id INTO reservation_id_val;
            
            -- 每筆預約 1-3 本書
            books_to_reserve := 1 + floor(random() * 3)::INTEGER;
            
            -- 為每筆預約分配書籍，確保一個會員不會對同一本書重複預約
            FOR book_rec IN 
                SELECT DISTINCT b.book_id
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
                ORDER BY RANDOM()
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
-- 8. 更新 BOOK_COPIES 狀態（根據預約）
-- ============================================
-- 為 Active 預約分配 reserved 複本
DO $$
DECLARE
    book_rec RECORD;
    reservation_rec RECORD;
    available_copy RECORD;
    reserved_count INTEGER;
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
        
        -- 從這本書的 Available 複本中，選擇 reserved_count 個設為 Reserved
        FOR available_copy IN 
            SELECT bc.book_id, bc.copies_serial
            FROM BOOK_COPIES bc
            WHERE bc.book_id = book_rec.book_id
              AND bc.status = 'Available'
            ORDER BY bc.copies_serial
            LIMIT reserved_count
        LOOP
            UPDATE BOOK_COPIES
            SET status = 'Reserved'
            WHERE book_id = available_copy.book_id
              AND copies_serial = available_copy.copies_serial;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ BOOK_COPIES 狀態已根據預約更新';
END $$;

-- ============================================
-- 9. 更新 MEMBER balance
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
        
        -- 計算借閱費用
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
-- 10. 驗證資料一致性
-- ============================================
DO $$
DECLARE
    lost_count INTEGER;
    lost_fee_count INTEGER;
    borrowed_count INTEGER;
    active_loan_count INTEGER;
    reserved_count INTEGER;
    active_reservation_count INTEGER;
    mismatch_count INTEGER;
BEGIN
    -- 驗證 Lost 狀態與遺失費的一致性
    SELECT COUNT(*) INTO lost_count
    FROM BOOK_COPIES
    WHERE status = 'Lost';
    
    SELECT COUNT(DISTINCT (book_id, copies_serial)) INTO lost_fee_count
    FROM ADD_FEE
    WHERE type = 'lost';
    
    IF lost_count != lost_fee_count THEN
        RAISE WARNING '⚠️ Lost 複本數量 (%) 與遺失費記錄數量 (%) 不一致', lost_count, lost_fee_count;
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
    END IF;
    
    RAISE NOTICE '✅ 資料一致性驗證完成';
    RAISE NOTICE '  - Lost 複本: % 個，遺失費記錄: % 筆', lost_count, lost_fee_count;
    RAISE NOTICE '  - Borrowed 複本: % 個，未歸還借閱: % 筆', borrowed_count, active_loan_count;
    RAISE NOTICE '  - Reserved 複本: % 個，Active 預約書籍: % 本', reserved_count, active_reservation_count;
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
    RAISE NOTICE '  - % 位店員', (SELECT COUNT(*) FROM ADMIN);
    RAISE NOTICE '  - % 位會員', (SELECT COUNT(*) FROM MEMBER);
    RAISE NOTICE '  - % 個書籍複本', (SELECT COUNT(*) FROM BOOK_COPIES);
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
