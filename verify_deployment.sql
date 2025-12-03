-- ============================================
-- 資料庫部署驗證查詢
-- ============================================
-- 在 Supabase SQL Editor 中執行此檔案來驗證部署是否成功

-- ============================================
-- 1. 檢查所有表
-- ============================================
SELECT 
    '表檢查' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 14 THEN '✓ 正確 (14 個表)'
        ELSE '✗ 錯誤：應該有 14 個表'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 列出所有表名稱
SELECT 
    '表清單' as info,
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- 2. 檢查初始資料
-- ============================================

-- 會員等級（應該有 3 筆）
SELECT 
    '會員等級' as data_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 3 THEN '✓ 正確'
        ELSE '✗ 錯誤：應該有 3 筆'
    END as status
FROM MEMBERSHIP_LEVEL;

-- 書況折扣（應該有 3 筆）
SELECT 
    '書況折扣' as data_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 3 THEN '✓ 正確'
        ELSE '✗ 錯誤：應該有 3 筆'
    END as status
FROM CONDITION_DISCOUNT;

-- 費用類型（應該有 6 筆）
SELECT 
    '費用類型' as data_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 6 THEN '✓ 正確'
        ELSE '✗ 錯誤：應該有 6 筆'
    END as status
FROM FEE_TYPE;

-- ============================================
-- 3. 檢查索引
-- ============================================
SELECT 
    '索引檢查' as check_type,
    COUNT(*) as index_count,
    CASE 
        WHEN COUNT(*) >= 20 THEN '✓ 索引建立成功'
        ELSE '⚠ 索引數量可能不足'
    END as status
FROM pg_indexes 
WHERE schemaname = 'public';

-- ============================================
-- 4. 檢查外鍵約束
-- ============================================
SELECT 
    '外鍵約束' as check_type,
    COUNT(*) as fk_count,
    CASE 
        WHEN COUNT(*) >= 15 THEN '✓ 外鍵約束建立成功'
        ELSE '⚠ 外鍵約束可能不足'
    END as status
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
AND table_schema = 'public';

-- ============================================
-- 5. 檢查檢查約束
-- ============================================
SELECT 
    '檢查約束' as check_type,
    COUNT(*) as check_count,
    CASE 
        WHEN COUNT(*) >= 20 THEN '✓ 檢查約束建立成功'
        ELSE '⚠ 檢查約束可能不足'
    END as status
FROM information_schema.table_constraints 
WHERE constraint_type = 'CHECK' 
AND table_schema = 'public';

-- ============================================
-- 6. 詳細資料檢查
-- ============================================

-- 查看會員等級資料
SELECT '會員等級資料' as info, * FROM MEMBERSHIP_LEVEL ORDER BY level_id;

-- 查看書況折扣資料
SELECT '書況折扣資料' as info, * FROM CONDITION_DISCOUNT;

-- 查看費用類型資料
SELECT '費用類型資料' as info, * FROM FEE_TYPE ORDER BY type;

-- ============================================
-- 7. 測試插入（可選，測試後請刪除）
-- ============================================
-- 取消註釋以下程式碼來測試插入功能
/*
-- 測試插入管理員
INSERT INTO ADMIN (name, phone, role, status) 
VALUES ('測試管理員', '0912345678', 'Manager', 'Active')
RETURNING *;

-- 測試插入分類
INSERT INTO CATEGORY (name) 
VALUES ('測試分類')
RETURNING *;

-- 測試後刪除測試資料
DELETE FROM ADMIN WHERE name = '測試管理員';
DELETE FROM CATEGORY WHERE name = '測試分類';
*/

-- ============================================
-- 部署驗證完成
-- ============================================
-- 如果以上所有檢查都顯示 ✓，表示部署成功！

