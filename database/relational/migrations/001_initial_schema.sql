-- ============================================
-- 獨立租借書店系統 - 資料庫 Schema
-- PostgreSQL (Supabase)
-- ============================================

-- 啟用必要的擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. MEMBERSHIP_LEVEL - 會員等級表
-- ============================================
CREATE TABLE MEMBERSHIP_LEVEL (
    level_id BIGSERIAL PRIMARY KEY,
    level_name VARCHAR(20) NOT NULL UNIQUE,
    discount_rate DECIMAL(3,2) NOT NULL,
    min_balance_required INTEGER DEFAULT 0,
    max_book_allowed INTEGER DEFAULT 5,
    hold_days INTEGER NOT NULL,
    CONSTRAINT chk_level_name CHECK (level_name IN ('金', '銀', '銅')),
    CONSTRAINT chk_discount_rate CHECK (discount_rate >= 0 AND discount_rate <= 1),
    CONSTRAINT chk_max_book_allowed CHECK (max_book_allowed > 0),
    CONSTRAINT chk_hold_days CHECK (hold_days > 0)
);

-- ============================================
-- 2. ADMIN - 管理員/店員表
-- ============================================
CREATE TABLE ADMIN (
    admin_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    role VARCHAR(15) NOT NULL,
    status VARCHAR(10) NOT NULL,
    CONSTRAINT chk_role CHECK (role IN ('Manager', 'Clerk')),
    CONSTRAINT chk_admin_status CHECK (status IN ('Active', 'Left'))
);

-- ============================================
-- 3. MEMBER - 會員表
-- ============================================
CREATE TABLE MEMBER (
    member_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    level_id BIGINT NOT NULL,
    admin_id BIGINT,
    join_date DATE NOT NULL,
    email VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL,
    balance INTEGER DEFAULT 0,
    status VARCHAR(15) NOT NULL,
    CONSTRAINT chk_member_status CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    CONSTRAINT chk_balance CHECK (balance >= 0),
    CONSTRAINT fk_member_level FOREIGN KEY (level_id) 
        REFERENCES MEMBERSHIP_LEVEL(level_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_member_admin FOREIGN KEY (admin_id) 
        REFERENCES ADMIN(admin_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
);

-- ============================================
-- 4. TOP_UP - 儲值記錄表
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
-- 5. BOOK - 書籍基本資訊表
-- ============================================
CREATE TABLE BOOK (
    book_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    author VARCHAR(60) NOT NULL,
    publisher VARCHAR(100),
    price INTEGER NOT NULL,
    CONSTRAINT chk_price CHECK (price > 0)
);

-- ============================================
-- 6. CATEGORY - 書籍分類表
-- ============================================
CREATE TABLE CATEGORY (
    category_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);

-- ============================================
-- 7. BOOK_CATEGORY - 書籍與分類的 M:N 關係表
-- ============================================
CREATE TABLE BOOK_CATEGORY (
    book_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    PRIMARY KEY (book_id, category_id),
    CONSTRAINT fk_book_category_book FOREIGN KEY (book_id) 
        REFERENCES BOOK(book_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_book_category_category FOREIGN KEY (category_id) 
        REFERENCES CATEGORY(category_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- ============================================
-- 8. CONDITION_DISCOUNT - 書況折扣表
-- ============================================
CREATE TABLE CONDITION_DISCOUNT (
    book_condition VARCHAR(20) PRIMARY KEY,
    discount_factor DECIMAL(3,2) NOT NULL,
    CONSTRAINT chk_condition CHECK (book_condition IN ('Good', 'Fair', 'Poor')),
    CONSTRAINT chk_discount_factor CHECK (discount_factor >= 0 AND discount_factor <= 1)
);

-- ============================================
-- 9. BOOK_COPIES - 書籍複本表（弱實體）
-- ============================================
CREATE TABLE BOOK_COPIES (
    book_id BIGINT NOT NULL,
    copies_serial INTEGER NOT NULL,
    status VARCHAR(15) NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_price INTEGER NOT NULL,
    book_condition VARCHAR(20) NOT NULL,
    rental_price INTEGER NOT NULL,
    PRIMARY KEY (book_id, copies_serial),
    CONSTRAINT chk_copies_status CHECK (status IN ('Available', 'Borrowed', 'Lost')),
    CONSTRAINT chk_purchase_price CHECK (purchase_price > 0),
    CONSTRAINT chk_rental_price CHECK (rental_price > 0),
    CONSTRAINT fk_copies_book FOREIGN KEY (book_id) 
        REFERENCES BOOK(book_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_copies_condition FOREIGN KEY (book_condition) 
        REFERENCES CONDITION_DISCOUNT(book_condition) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

-- ============================================
-- 10. BOOK_LOAN - 借閱交易表
-- ============================================
CREATE TABLE BOOK_LOAN (
    loan_id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    final_price INTEGER NOT NULL,
    CONSTRAINT chk_final_price CHECK (final_price >= 0),
    CONSTRAINT fk_loan_admin FOREIGN KEY (admin_id) 
        REFERENCES ADMIN(admin_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    CONSTRAINT fk_loan_member FOREIGN KEY (member_id) 
        REFERENCES MEMBER(member_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

-- ============================================
-- 11. LOAN_RECORD - 借閱記錄詳情表（弱實體）
-- ============================================
CREATE TABLE LOAN_RECORD (
    loan_id BIGINT NOT NULL,
    book_id BIGINT NOT NULL,
    copies_serial INTEGER NOT NULL,
    date_out DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE,
    rental_fee INTEGER NOT NULL,
    renew_cnt INTEGER DEFAULT 0,
    PRIMARY KEY (loan_id, book_id, copies_serial),
    CONSTRAINT chk_rental_fee CHECK (rental_fee >= 0),
    CONSTRAINT chk_renew_cnt CHECK (renew_cnt >= 0 AND renew_cnt <= 1),
    CONSTRAINT chk_due_date CHECK (due_date >= date_out),
    CONSTRAINT chk_return_date CHECK (return_date IS NULL OR return_date >= date_out),
    CONSTRAINT fk_loan_record_loan FOREIGN KEY (loan_id) 
        REFERENCES BOOK_LOAN(loan_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_loan_record_copies FOREIGN KEY (book_id, copies_serial) 
        REFERENCES BOOK_COPIES(book_id, copies_serial) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- ============================================
-- 12. RESERVATION - 預約記錄表
-- ============================================
CREATE TABLE RESERVATION (
    reservation_id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL,
    reserve_date DATE NOT NULL,
    pickup_date DATE,
    status VARCHAR(15) NOT NULL,
    CONSTRAINT chk_reservation_status CHECK (status IN ('Active', 'Fulfilled', 'Cancelled')),
    CONSTRAINT chk_pickup_date CHECK (pickup_date IS NULL OR pickup_date >= reserve_date),
    CONSTRAINT fk_reservation_member FOREIGN KEY (member_id) 
        REFERENCES MEMBER(member_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

-- ============================================
-- 13. RESERVATION_RECORD - 預約與書籍的 M:N 關係表
-- ============================================
CREATE TABLE RESERVATION_RECORD (
    reservation_id BIGINT NOT NULL,
    book_id BIGINT NOT NULL,
    PRIMARY KEY (reservation_id, book_id),
    CONSTRAINT fk_reservation_record_reservation FOREIGN KEY (reservation_id) 
        REFERENCES RESERVATION(reservation_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_reservation_record_book FOREIGN KEY (book_id) 
        REFERENCES BOOK(book_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- ============================================
-- 14. FEE_TYPE - 費用類型表
-- ============================================
CREATE TABLE FEE_TYPE (
    type VARCHAR(30) PRIMARY KEY,
    base_amount INTEGER,
    rate DECIMAL(4,3),
    CONSTRAINT chk_fee_type_name CHECK (type IN ('renew', 'overdue', 'damage_good_to_fair', 'damage_good_to_poor', 'damage_fair_to_poor', 'lost')),
    CONSTRAINT chk_base_amount CHECK (base_amount IS NULL OR base_amount >= 0),
    CONSTRAINT chk_rate CHECK (rate IS NULL OR (rate >= 0 AND rate <= 1))
);

-- ============================================
-- 15. ADD_FEE - 額外費用表（弱實體）
-- ============================================
CREATE TABLE ADD_FEE (
    loan_id BIGINT NOT NULL,
    book_id BIGINT NOT NULL,
    copies_serial INTEGER NOT NULL,
    type VARCHAR(30) NOT NULL,
    amount INTEGER NOT NULL,
    date DATE NOT NULL,
    PRIMARY KEY (loan_id, book_id, copies_serial, type),
    CONSTRAINT chk_fee_amount CHECK (amount >= 0),
    CONSTRAINT fk_add_fee_loan_record FOREIGN KEY (loan_id, book_id, copies_serial) 
        REFERENCES LOAN_RECORD(loan_id, book_id, copies_serial) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_add_fee_type FOREIGN KEY (type) 
        REFERENCES FEE_TYPE(type) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

-- ============================================
-- 索引建立
-- ============================================

-- MEMBER 表索引
CREATE INDEX idx_member_level_id ON MEMBER(level_id);
CREATE INDEX idx_member_admin_id ON MEMBER(admin_id);
CREATE INDEX idx_member_email ON MEMBER(email);
CREATE INDEX idx_member_phone ON MEMBER(phone);
CREATE INDEX idx_member_status ON MEMBER(status);

-- TOP_UP 表索引
CREATE INDEX idx_top_up_member_id ON TOP_UP(member_id);
CREATE INDEX idx_top_up_admin_id ON TOP_UP(admin_id);
CREATE INDEX idx_top_up_date ON TOP_UP(top_up_date);

-- BOOK_COPIES 表索引
CREATE INDEX idx_copies_status ON BOOK_COPIES(status);
CREATE INDEX idx_copies_condition ON BOOK_COPIES(book_condition);

-- BOOK_LOAN 表索引
CREATE INDEX idx_loan_admin_id ON BOOK_LOAN(admin_id);
CREATE INDEX idx_loan_member_id ON BOOK_LOAN(member_id);

-- LOAN_RECORD 表索引
CREATE INDEX idx_loan_record_date_out ON LOAN_RECORD(date_out);
CREATE INDEX idx_loan_record_due_date ON LOAN_RECORD(due_date);
CREATE INDEX idx_loan_record_return_date ON LOAN_RECORD(return_date);

-- RESERVATION 表索引
CREATE INDEX idx_reservation_member_id ON RESERVATION(member_id);
CREATE INDEX idx_reservation_status ON RESERVATION(status);
CREATE INDEX idx_reservation_reserve_date ON RESERVATION(reserve_date);

-- BOOK_CATEGORY 表索引
CREATE INDEX idx_book_category_category_id ON BOOK_CATEGORY(category_id);

-- RESERVATION_RECORD 表索引
CREATE INDEX idx_reservation_record_book_id ON RESERVATION_RECORD(book_id);

-- ADD_FEE 表索引
CREATE INDEX idx_add_fee_loan_record ON ADD_FEE(loan_id, book_id, copies_serial);
CREATE INDEX idx_add_fee_type ON ADD_FEE(type);
CREATE INDEX idx_add_fee_date ON ADD_FEE(date);

-- ============================================
-- 註釋說明
-- ============================================

COMMENT ON TABLE MEMBERSHIP_LEVEL IS '會員等級表：定義金、銀、銅三個等級及其權益';
COMMENT ON TABLE ADMIN IS '管理員/店員表：記錄系統管理員資訊';
COMMENT ON TABLE MEMBER IS '會員表：記錄所有註冊會員的基本資訊和帳戶狀態';
COMMENT ON TABLE TOP_UP IS '儲值記錄表：記錄會員的每次儲值記錄，會員等級依據單次儲值金額判定';
COMMENT ON TABLE BOOK IS '書籍基本資訊表：記錄書籍的基本屬性';
COMMENT ON TABLE CATEGORY IS '書籍分類表：定義書籍的分類';
COMMENT ON TABLE BOOK_CATEGORY IS '書籍與分類關係表：多對多關係';
COMMENT ON TABLE CONDITION_DISCOUNT IS '書況折扣表：定義不同書況的租金折扣';
COMMENT ON TABLE BOOK_COPIES IS '書籍複本表：記錄每本實體書的詳細資訊';
COMMENT ON TABLE BOOK_LOAN IS '借閱交易表：記錄每次借閱交易';
COMMENT ON TABLE LOAN_RECORD IS '借閱記錄詳情表：記錄每本書在每次借閱中的詳細資訊';
COMMENT ON TABLE RESERVATION IS '預約記錄表：記錄會員的預約資訊';
COMMENT ON TABLE RESERVATION_RECORD IS '預約與書籍關係表：多對多關係';
COMMENT ON TABLE FEE_TYPE IS '費用類型表：定義各種額外費用的計算規則（續借、逾期、損壞、遺失等）';
COMMENT ON TABLE ADD_FEE IS '額外費用表：記錄借閱記錄的各種額外費用（續借費、逾期罰金、損壞賠償、遺失賠償等）';
COMMENT ON COLUMN BOOK_LOAN.final_price IS '總租金：由所有 LOAN_RECORD 的 rental_fee 加總，不包含後續於 ADD_FEE 產生的續借費與罰金';

