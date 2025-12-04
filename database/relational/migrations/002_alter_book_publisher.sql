-- ============================================
-- Migration: 更新 BOOK 表的欄位長度
-- publisher: VARCHAR(50) → VARCHAR(100)
-- author: VARCHAR(50) → VARCHAR(60)
-- name: VARCHAR(100) → VARCHAR(150)
-- ============================================

-- 修改 BOOK 表的多個欄位長度（使用逗號分隔）
ALTER TABLE BOOK 
    ALTER COLUMN publisher TYPE VARCHAR(100),
    ALTER COLUMN author TYPE VARCHAR(60),
    ALTER COLUMN name TYPE VARCHAR(150);


-- 添加註釋說明
COMMENT ON COLUMN BOOK.publisher IS '出版社 (長度: 100)';
COMMENT ON COLUMN BOOK.author IS '作者 (長度: 60)';
COMMENT ON COLUMN BOOK.name IS '書名 (長度: 150)';
