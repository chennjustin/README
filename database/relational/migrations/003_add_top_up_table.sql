-- ============================================
-- 新增 TOP_UP 儲值記錄表
-- ============================================
-- 此 migration 腳本用於在現有資料庫中新增 TOP_UP 表
-- 執行前請確保已執行 001_initial_schema.sql

-- ============================================
-- 建立 TOP_UP 表
-- ============================================
CREATE TABLE TOP_UP (
    top_up_id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL,
    admin_id BIGINT NOT NULL,
    amount INTEGER NOT NULL,
    top_up_date DATE NOT NULL,
    CONSTRAINT chk_top_up_amount CHECK (amount >= 0),
    CONSTRAINT fk_top_up_member FOREIGN KEY (member_id) 
        REFERENCES MEMBER(member_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_top_up_admin FOREIGN KEY (admin_id) 
        REFERENCES ADMIN(admin_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

-- ============================================
-- 建立索引
-- ============================================
CREATE INDEX idx_top_up_member_id ON TOP_UP(member_id);
CREATE INDEX idx_top_up_admin_id ON TOP_UP(admin_id);
CREATE INDEX idx_top_up_date ON TOP_UP(top_up_date);

-- ============================================
-- 添加註釋
-- ============================================
COMMENT ON TABLE TOP_UP IS '儲值記錄表：記錄會員的每次儲值記錄，會員等級依據單次儲值金額判定';
COMMENT ON COLUMN TOP_UP.top_up_id IS '儲值代號：主鍵，自動遞增';
COMMENT ON COLUMN TOP_UP.member_id IS '會員代號：外鍵參考 MEMBER 表';
COMMENT ON COLUMN TOP_UP.admin_id IS '處理店員：外鍵參考 ADMIN 表';
COMMENT ON COLUMN TOP_UP.amount IS '儲值金額：單次儲值金額，用於判定會員等級';
COMMENT ON COLUMN TOP_UP.top_up_date IS '儲值日期：記錄儲值發生的日期';

