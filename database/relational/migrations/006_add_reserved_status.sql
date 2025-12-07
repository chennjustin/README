-- ============================================
-- Migration: 新增 BOOK_COPIES.status 的 'Reserved' 狀態
-- ============================================
-- 此 migration 腳本用於在現有資料庫中更新 BOOK_COPIES 表的 status 約束
-- 執行前請確保已執行 001_initial_schema.sql
--
-- 更新內容：
-- - 將 BOOK_COPIES.status 的 CHECK 約束從 {Available, Borrowed, Lost}
--   更新為 {Available, Borrowed, Reserved, Lost}

-- ============================================
-- 更新 BOOK_COPIES 表的 status 約束
-- ============================================

-- 刪除舊的約束
ALTER TABLE BOOK_COPIES
DROP CONSTRAINT IF EXISTS chk_copies_status;

-- 新增包含 'Reserved' 的約束
ALTER TABLE BOOK_COPIES
ADD CONSTRAINT chk_copies_status CHECK (status IN ('Available', 'Borrowed', 'Reserved', 'Lost'));

-- ============================================
-- 添加註釋說明
-- ============================================
COMMENT ON COLUMN BOOK_COPIES.status IS '複本狀態：Available(可借), Borrowed(已借出), Reserved(已預約), Lost(遺失)';

