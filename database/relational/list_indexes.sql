-- ============================================
-- 查看所有索引的查詢
-- ============================================

-- 方法 1：查看所有手動創建的索引（不包括主鍵和唯一約束的自動索引）
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
  AND indexname NOT LIKE '%_key'
ORDER BY tablename, indexname;

-- 方法 2：查看所有索引（包括主鍵和唯一約束）
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 方法 3：只查看索引名稱和表名
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
  AND indexname NOT LIKE '%_key'
ORDER BY tablename, indexname;

