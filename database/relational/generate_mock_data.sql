-- ============================================
-- 獨立租借書店系統 - 虛擬資料生成腳本
-- PostgreSQL (Supabase)
-- ============================================
-- 此腳本生成測試用的虛擬資料
-- 注意：此腳本假設 BOOK 表已經有資料，不會生成 BOOK 資料
-- 執行前請確保已執行 001_initial_schema.sql 和 seed.sql

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
-- 生成更多會員以支援 1000+ 筆借閱記錄
-- 假設 level_id: 1=銅, 2=銀, 3=金（從 seed.sql）
-- 注意：初始 balance 設為 0，之後會根據 TOP_UP 和借閱費用更新
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
        
        -- 隨機分配管理員（從已存在的管理員中選擇）
        -- 先取得管理員數量，然後隨機選擇
        SELECT admin_id INTO admin_id_val
        FROM ADMIN
        ORDER BY RANDOM()
        LIMIT 1;
        
        -- 如果沒有管理員，設為 NULL
        IF admin_id_val IS NULL THEN
            admin_id_val := NULL;
        END IF;
        
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
        
        -- 初始 balance 設為 0，之後會根據 TOP_UP 和借閱費用更新
        INSERT INTO MEMBER (name, level_id, admin_id, join_date, email, phone, balance, status)
        VALUES (member_name, level_id_val, admin_id_val, join_date_val, email_val, phone_val, 0, status_val)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================
-- 3. BOOK_COPIES - 書籍複本資料
-- ============================================
-- 為每一本書生成複本
-- 邏輯：每一本書都至少有一個複本
-- - 60% 的書只有 1 個複本
-- - 40% 的書有 2-5 個複本
-- 初始狀態全部設為 'Available'，之後根據借閱記錄更新
DO $$
DECLARE
    book_rec RECORD;
    copies_count INTEGER;
    i INTEGER;
    purchase_date DATE;
    purchase_price INTEGER;
    condition_val VARCHAR(20);  -- 重命名變數避免與表欄位名衝突
    rental_price INTEGER;
BEGIN
    FOR book_rec IN SELECT book_id, price FROM BOOK ORDER BY book_id
    LOOP
        -- 每一本書都至少有一個複本
        -- 60% 的書只有 1 個複本，40% 的書有 2-5 個複本
        IF random() < 0.6 THEN
            copies_count := 1; -- 60% 的書只有 1 個複本
        ELSE
            copies_count := 2 + floor(random() * 4)::INTEGER; -- 40% 的書有 2-5 個複本
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
            
            -- 計算租金（定價 × 折扣因子 × 0.1）
            SELECT cd.discount_factor INTO rental_price 
            FROM CONDITION_DISCOUNT cd
            WHERE cd.book_condition = condition_val;
            rental_price := floor(book_rec.price * rental_price * 0.1)::INTEGER;
            
            -- 初始狀態全部設為 'Available'，之後根據借閱記錄更新
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
END $$;

-- ============================================
-- 4. BOOK_LOAN - 借閱交易資料
-- ============================================
-- 生成超過 1000 筆借閱記錄，時間範圍：2023/1/1 ~ 2025/12/5
DO $$
DECLARE
    member_rec RECORD;
    admin_ids INTEGER[];
    random_admin_id INTEGER;
    loan_date DATE;
    books_to_borrow INTEGER;
    i INTEGER;
    loan_id_val BIGINT;
    total_loans INTEGER := 0;
    target_loans INTEGER := 1200; -- 目標生成 1200 筆借閱記錄
    start_date DATE := '2023-01-01'::DATE;
    end_date DATE := '2025-12-05'::DATE;
    days_range INTEGER;
BEGIN
    -- 取得所有管理員 ID
    SELECT ARRAY_AGG(admin_id) INTO admin_ids FROM ADMIN WHERE status = 'Active';
    days_range := end_date - start_date;
    
    -- 持續生成直到達到目標數量
    WHILE total_loans < target_loans
    LOOP
        -- 隨機選擇一個活躍會員
        FOR member_rec IN 
            SELECT m.member_id, ml.max_book_allowed 
            FROM MEMBER m 
            JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id 
            WHERE m.status = 'Active'
            ORDER BY RANDOM()
            LIMIT 1
        LOOP
            -- 隨機借閱日期（2023/1/1 ~ 2025/12/5）
            loan_date := start_date + (floor(random() * days_range)::INTEGER || ' days')::INTERVAL;
            
            -- 隨機選擇管理員（確保索引不超出範圍）
            IF array_length(admin_ids, 1) > 0 THEN
                random_admin_id := admin_ids[1 + floor(random() * array_length(admin_ids, 1))::INTEGER];
            ELSE
                RAISE EXCEPTION '沒有可用的管理員';
            END IF;
            
            -- 每筆借閱 1-3 本書（不超過會員上限）
            books_to_borrow := LEAST(1 + floor(random() * 3)::INTEGER, member_rec.max_book_allowed);
            
            -- 插入借閱交易（final_price 稍後更新）
            INSERT INTO BOOK_LOAN (admin_id, member_id, final_price)
            VALUES (random_admin_id, member_rec.member_id, 0)
            RETURNING loan_id INTO loan_id_val;
            
            total_loans := total_loans + 1;
            
            -- 如果達到目標，退出
            IF total_loans >= target_loans THEN
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '已生成 % 筆借閱交易', total_loans;
END $$;

-- ============================================
-- 5. LOAN_RECORD - 借閱記錄詳情
-- ============================================
-- 為每筆借閱交易生成詳細記錄
DO $$
DECLARE
    loan_rec RECORD;
    available_copies RECORD;
    copies_to_borrow INTEGER;
    i INTEGER;
    date_out_val DATE;
    due_date_val DATE;
    return_date_val DATE;
    rental_fee_val INTEGER;
    renew_cnt_val INTEGER;
    total_fee INTEGER := 0;
    member_level_id INTEGER;
    discount_rate_val DECIMAL(3,2);
    hold_days_val INTEGER;
    start_date DATE := '2023-01-01'::DATE;
    end_date DATE := '2025-12-05'::DATE;
    days_range INTEGER;
BEGIN
    days_range := end_date - start_date;
    
    FOR loan_rec IN 
        SELECT bl.loan_id, bl.member_id, bl.admin_id, bl.final_price
        FROM BOOK_LOAN bl
        ORDER BY bl.loan_id
    LOOP
        -- 取得會員等級折扣率和持有天數
        SELECT m.level_id, ml.discount_rate, ml.hold_days
        INTO member_level_id, discount_rate_val, hold_days_val
        FROM MEMBER m
        JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
        WHERE m.member_id = loan_rec.member_id;
        
        -- 隨機借閱日期（2023/1/1 ~ 2025/12/5）
        date_out_val := start_date + (floor(random() * days_range)::INTEGER || ' days')::INTERVAL;
        
        -- 每筆借閱 1-3 本書
        copies_to_borrow := 1 + floor(random() * 3)::INTEGER;
        
        -- 取得可借閱的書籍複本（狀態為 Available）
        FOR available_copies IN 
            SELECT bc.book_id, bc.copies_serial, bc.rental_price
            FROM BOOK_COPIES bc
            WHERE bc.status = 'Available'
            ORDER BY RANDOM()
            LIMIT copies_to_borrow
        LOOP
            -- 計算租金（考慮會員折扣）
            rental_fee_val := floor(available_copies.rental_price * discount_rate_val)::INTEGER;
            total_fee := total_fee + rental_fee_val;
            
            -- 計算應還日期（根據會員等級的 hold_days）
            due_date_val := date_out_val + (hold_days_val || ' days')::INTERVAL;
            
            -- 隨機決定是否已歸還（70% 已歸還，30% 未歸還）
            IF random() < 0.7 THEN
                -- 已歸還：歸還日期在借出日期到應還日期+30天之間
                return_date_val := date_out_val + (floor(random() * (hold_days_val + 30))::INTEGER || ' days')::INTERVAL;
            ELSE
                -- 未歸還
                return_date_val := NULL;
            END IF;
            
            -- 隨機決定是否續借（20% 續借，且只有在已歸還的情況下才可能續借）
            IF return_date_val IS NULL AND random() < 0.2 THEN
                renew_cnt_val := 1;
                -- 續借則延長 7 天
                due_date_val := due_date_val + 7;
            ELSE
                renew_cnt_val := 0;
            END IF;
            
            -- 插入借閱記錄
            INSERT INTO LOAN_RECORD (
                loan_id, book_id, copies_serial, date_out, 
                due_date, return_date, rental_fee, renew_cnt
            )
            VALUES (
                loan_rec.loan_id, available_copies.book_id, 
                available_copies.copies_serial, date_out_val,
                due_date_val, return_date_val, rental_fee_val, renew_cnt_val
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
        
        -- 更新借閱交易的總金額
        UPDATE BOOK_LOAN 
        SET final_price = total_fee 
        WHERE loan_id = loan_rec.loan_id;
        
        total_fee := 0;
    END LOOP;
END $$;

-- ============================================
-- 6. 更新 BOOK_COPIES 狀態
-- ============================================
-- 根據借閱記錄更新書籍複本狀態
-- 邏輯：
-- - 如果有進行中的借閱記錄（return_date IS NULL 且 due_date >= CURRENT_DATE）：狀態為 'Borrowed'
-- - 如果沒有進行中的借閱記錄：狀態為 'Available'（除非是 Lost）
-- - Lost 狀態：隨機分配（1% 機率），但不會覆蓋正在借閱中的
-- 注意：需要先處理 Borrowed，再處理 Available，避免狀態衝突
DO $$
BEGIN
    -- 先將所有有進行中借閱記錄的複本設為 Borrowed（不包括 Lost）
    UPDATE BOOK_COPIES bc
    SET status = 'Borrowed'
    WHERE EXISTS (
        SELECT 1 
        FROM LOAN_RECORD lr 
        WHERE lr.book_id = bc.book_id 
          AND lr.copies_serial = bc.copies_serial
          AND lr.return_date IS NULL
          AND lr.due_date >= CURRENT_DATE
    )
    AND bc.status != 'Lost'; -- 保留 Lost 狀態
    
    -- 將沒有進行中借閱記錄的複本設為 Available（不包括 Lost 和已經設為 Borrowed 的）
    UPDATE BOOK_COPIES bc
    SET status = 'Available'
    WHERE bc.status != 'Lost'
      AND bc.status != 'Borrowed'  -- 避免覆蓋剛剛設為 Borrowed 的
      AND NOT EXISTS (
          SELECT 1 
          FROM LOAN_RECORD lr 
          WHERE lr.book_id = bc.book_id 
            AND lr.copies_serial = bc.copies_serial
            AND lr.return_date IS NULL
            AND lr.due_date >= CURRENT_DATE
      );
    
    -- 隨機將 1% 的 Available 複本設為 Lost（不包括正在借閱中的）
    UPDATE BOOK_COPIES bc
    SET status = 'Lost'
    WHERE bc.status = 'Available'
      AND NOT EXISTS (
          SELECT 1 
          FROM LOAN_RECORD lr 
          WHERE lr.book_id = bc.book_id 
            AND lr.copies_serial = bc.copies_serial
            AND lr.return_date IS NULL
            AND lr.due_date >= CURRENT_DATE
      )
      AND random() < 0.01;
END $$;

-- ============================================
-- 7. ADD_FEE - 額外費用記錄
-- ============================================
-- 為借閱記錄生成額外費用（續借費、逾期費、損壞費等）
-- 
-- 重要邏輯說明：
-- 1. 同一筆借閱的同一本書，同一類型的費用只能有一筆（由主鍵約束保證）
-- 2. 逾期費：如果 return_date > due_date（已還書）或 return_date IS NULL 且 due_date < CURRENT_DATE（未還書但已逾期）
-- 3. 逾期費在還書時結清，但對於未還書的逾期情況，系統會每天更新這筆費用
-- 4. 續借費：在續借時產生（renew_cnt > 0）
-- 5. 損壞費：在還書時檢查並產生
DO $$
DECLARE
    loan_record_rec RECORD;
    fee_amount INTEGER;
    fee_date DATE;
    overdue_days INTEGER;
BEGIN
    FOR loan_record_rec IN 
        SELECT lr.loan_id, lr.book_id, lr.copies_serial, 
               lr.date_out, lr.due_date, lr.return_date, lr.renew_cnt,
               bc.purchase_price
        FROM LOAN_RECORD lr
        JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
    LOOP
        -- 如果續借，生成續借費
        -- 注意：同一筆借閱的同一本書，只能有一筆 renew 類型的費用
        IF loan_record_rec.renew_cnt > 0 THEN
            SELECT base_amount INTO fee_amount FROM FEE_TYPE WHERE type = 'renew';
            fee_date := loan_record_rec.due_date - 7; -- 續借日期（假設續借延長 7 天）
            
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                    loan_record_rec.copies_serial, 'renew', fee_amount, fee_date)
            ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
        END IF;
        
        -- 如果逾期，生成逾期費（每逾期一天 10 元）
        -- 逾期判斷：return_date > due_date（已還書）或 return_date IS NULL 且 due_date < CURRENT_DATE（未還書但已逾期）
        IF (loan_record_rec.return_date IS NOT NULL 
            AND loan_record_rec.return_date > loan_record_rec.due_date)
           OR (loan_record_rec.return_date IS NULL 
               AND loan_record_rec.due_date < CURRENT_DATE) THEN
            SELECT base_amount INTO fee_amount FROM FEE_TYPE WHERE type = 'overdue';
            
            -- 計算逾期天數
            IF loan_record_rec.return_date IS NOT NULL THEN
                -- 已還書：計算到還書日期的逾期天數
                overdue_days := loan_record_rec.return_date - loan_record_rec.due_date;
            ELSE
                -- 未還書但已逾期：計算到今天的逾期天數（模擬系統每天更新的情況）
                overdue_days := CURRENT_DATE - loan_record_rec.due_date;
            END IF;
            
            -- 限制逾期費：最多收取 365 天的費用（3650 元）
            -- 超過 365 天不再收取，因為會由店員手動停權
            IF overdue_days > 365 THEN
                overdue_days := 365;
            END IF;
            
            fee_amount := fee_amount * overdue_days;
            fee_date := loan_record_rec.due_date + 1; -- 逾期開始日期
            
            -- 插入或更新逾期費（同一筆借閱的同一本書，同一類型費用只能有一筆）
            -- 使用 ON CONFLICT 確保不會產生多筆同類型的費用
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                    loan_record_rec.copies_serial, 'overdue', fee_amount, fee_date)
            ON CONFLICT (loan_id, book_id, copies_serial, type) 
            DO UPDATE SET 
                amount = EXCLUDED.amount,  -- 更新金額（模擬每天更新的情況）
                date = EXCLUDED.date;      -- 更新日期
        END IF;
        
        -- 隨機生成損壞費（5% 機率，只在還書時產生）
        -- 注意：同一筆借閱的同一本書，只能有一筆損壞費（damage_* 類型）
        IF random() < 0.05 AND loan_record_rec.return_date IS NOT NULL THEN
            -- 隨機選擇損壞類型
            IF random() < 0.33 THEN
                SELECT rate INTO fee_amount FROM FEE_TYPE WHERE type = 'damage_good_to_fair';
                fee_amount := floor(loan_record_rec.purchase_price * fee_amount)::INTEGER;
                fee_date := loan_record_rec.return_date; -- 損壞費在還書時產生
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'damage_good_to_fair', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
            ELSIF random() < 0.66 THEN
                SELECT rate INTO fee_amount FROM FEE_TYPE WHERE type = 'damage_fair_to_poor';
                fee_amount := floor(loan_record_rec.purchase_price * fee_amount)::INTEGER;
                fee_date := loan_record_rec.return_date; -- 損壞費在還書時產生
                
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES (loan_record_rec.loan_id, loan_record_rec.book_id, 
                        loan_record_rec.copies_serial, 'damage_fair_to_poor', fee_amount, fee_date)
                ON CONFLICT (loan_id, book_id, copies_serial, type) DO NOTHING;
            END IF;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 8. RESERVATION - 預約記錄
-- ============================================
-- 生成預約記錄
DO $$
DECLARE
    member_rec RECORD;
    reservation_date DATE;
    pickup_date DATE;
    status_val VARCHAR(15);
    reservation_id_val BIGINT;
    books_to_reserve INTEGER;
    i INTEGER;
    start_date DATE := '2023-01-01'::DATE;
    end_date DATE := '2025-12-05'::DATE;
    days_range INTEGER;
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
            -- 隨機預約日期（2023/1/1 ~ 2025/12/5）
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
            
            -- 生成預約書籍記錄（在下一步處理）
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- 9. RESERVATION_RECORD - 預約書籍關聯
-- ============================================
-- 為每筆預約分配書籍
DO $$
DECLARE
    reservation_rec RECORD;
    book_rec RECORD;
    books_to_reserve INTEGER;
    i INTEGER;
BEGIN
    FOR reservation_rec IN 
        SELECT reservation_id FROM RESERVATION
    LOOP
        -- 每筆預約 1-3 本書
        books_to_reserve := 1 + floor(random() * 3)::INTEGER;
        
        -- 隨機選擇書籍
        FOR book_rec IN 
            SELECT book_id FROM BOOK 
            ORDER BY RANDOM() 
            LIMIT books_to_reserve
        LOOP
            INSERT INTO RESERVATION_RECORD (reservation_id, book_id)
            VALUES (reservation_rec.reservation_id, book_rec.book_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- 10. TOP_UP - 儲值記錄
-- ============================================
-- 為會員生成儲值記錄
-- 注意：會員等級應該依據單次儲值金額判定，而不是累積 balance
-- 銅級：單次儲值 500-1499, 銀級：1500-2999, 金級：3000+
-- 邏輯：先生成所有儲值記錄，之後統一更新 MEMBER 的 balance
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
    -- 取得所有管理員 ID
    SELECT ARRAY_AGG(admin_id) INTO admin_ids FROM ADMIN WHERE status = 'Active';
    
    -- 為每個會員生成 1-5 筆儲值記錄
    FOR member_rec IN 
        SELECT member_id, join_date FROM MEMBER
    LOOP
        join_date_val := member_rec.join_date;
        days_since_join := end_date - join_date_val;
        
        -- 每個會員生成 1-5 筆儲值記錄
        FOR i IN 1..(1 + floor(random() * 5)::INTEGER)
        LOOP
            -- 隨機儲值日期（在會員加入日期之後，到 2025/12/5）
            top_up_date_val := join_date_val + (floor(random() * days_since_join)::INTEGER || ' days')::INTERVAL;
            
            -- 隨機選擇管理員（確保索引不超出範圍）
            IF array_length(admin_ids, 1) > 0 THEN
                random_admin_id := admin_ids[1 + floor(random() * array_length(admin_ids, 1))::INTEGER];
            ELSE
                RAISE EXCEPTION '沒有可用的管理員';
            END IF;
            
            -- 隨機儲值金額（100-10000 元）
            -- 注意：會員等級應該依據單次儲值金額判定
            top_up_amount := 100 + floor(random() * 9900)::INTEGER;
            
            INSERT INTO TOP_UP (member_id, admin_id, amount, top_up_date)
            VALUES (member_rec.member_id, random_admin_id, top_up_amount, top_up_date_val)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- 11. 更新 MEMBER balance
-- ============================================
-- 根據儲值記錄、借閱記錄和額外費用更新會員餘額
-- balance = 總儲值金額 - 借閱費用 - 額外費用
-- 此步驟在所有借閱記錄和額外費用生成後執行
DO $$
DECLARE
    member_rec RECORD;
    total_spent INTEGER;
    total_top_up INTEGER;
    new_balance INTEGER;
    loan_fee INTEGER;
    add_fee_amount INTEGER;
BEGIN
    FOR member_rec IN 
        SELECT member_id FROM MEMBER
    LOOP
        -- 計算總儲值金額（所有 TOP_UP 的總和）
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
    
    RAISE NOTICE '✅ 會員餘額已更新（根據儲值記錄和借閱費用）';
END $$;

-- ============================================
-- 完成訊息
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '✅ 虛擬資料生成完成！';
    RAISE NOTICE '已生成：';
    RAISE NOTICE '  - % 位店員', (SELECT COUNT(*) FROM ADMIN);
    RAISE NOTICE '  - % 位會員', (SELECT COUNT(*) FROM MEMBER);
    RAISE NOTICE '  - % 筆儲值記錄', (SELECT COUNT(*) FROM TOP_UP);
    RAISE NOTICE '  - % 個書籍複本', (SELECT COUNT(*) FROM BOOK_COPIES);
    RAISE NOTICE '  - % 筆借閱交易', (SELECT COUNT(*) FROM BOOK_LOAN);
    RAISE NOTICE '  - % 筆借閱記錄', (SELECT COUNT(*) FROM LOAN_RECORD);
    RAISE NOTICE '  - % 筆額外費用', (SELECT COUNT(*) FROM ADD_FEE);
    RAISE NOTICE '  - % 筆預約記錄', (SELECT COUNT(*) FROM RESERVATION);
    RAISE NOTICE '  - % 筆預約書籍關聯', (SELECT COUNT(*) FROM RESERVATION_RECORD);
END $$;
