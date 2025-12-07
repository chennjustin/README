# 資料庫 Schema 參考文檔

本文檔詳細說明「獨立租借書店」系統的資料庫結構。

## 目錄

- [Supabase (PostgreSQL) Schema](#supabase-postgresql-schema)
- [MongoDB Schema](#mongodb-schema)
- [關係图說明](#關係图說明)

---

## Supabase (PostgreSQL) Schema

### 表結構總览

系統包含 12 個關係表：

1. **MEMBERSHIP_LEVEL** - 會員等級
2. **ADMIN** - 管理員/店員
3. **MEMBER** - 會員
4. **BOOK** - 書籍基本資訊
5. **CATEGORY** - 書籍分類
6. **BOOK_CATEGORY** - 書籍與分類關係（M:N）
7. **CONDITION_DISCOUNT** - 書況折扣
8. **BOOK_COPIES** - 書籍複本
9. **BOOK_LOAN** - 借閱交易
10. **LOAN_RECORD** - 借閱記錄詳情
11. **RESERVATION** - 預約記錄
12. **RESERVATION_RECORD** - 預約與書籍關係（M:N）

---

### 1. MEMBERSHIP_LEVEL（會員等級表）

定義會員等級及其權益。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| level_id | BIGSERIAL | 等級ID（主鍵） | PRIMARY KEY |
| level_name | VARCHAR(20) | 等級名稱 | NOT NULL, UNIQUE, 值：'金', '銀', '銅' |
| discount_rate | DECIMAL(3,2) | 租借折扣比例 | NOT NULL, 範圍：0-1 |
| min_balance_required | INTEGER | 最低儲值門檻 | DEFAULT 0 |
| max_book_allowed | INTEGER | 可借閱上限 | DEFAULT 5, > 0 |
| loan_period | INTEGER | 歸還期限（天） | NOT NULL, > 0 |

**預設資料**：
- 銅：折扣 1.0，門檻 500，上限 3 本，期限 7 天
- 銀：折扣 0.92，門檻 1500，上限 8 本，期限 14 天
- 金：折扣 0.79，門檻 3000，上限 15 本，期限 30 天

---

### 2. ADMIN（管理員表）

儲存系統管理員/店員資訊。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| admin_id | BIGSERIAL | 管理員ID（主鍵） | PRIMARY KEY |
| name | VARCHAR(30) | 姓名 | NOT NULL |
| phone | VARCHAR(15) | 聯絡電話 | NOT NULL |
| role | VARCHAR(15) | 角色 | NOT NULL, 值：'Manager', 'Clerk' |
| status | VARCHAR(10) | 狀態 | NOT NULL, 值：'Active', 'Left' |

---

### 3. MEMBER（會員表）

儲存會員基本資訊。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| member_id | BIGSERIAL | 會員ID（主鍵） | PRIMARY KEY |
| name | VARCHAR(30) | 姓名 | NOT NULL |
| level_id | BIGINT | 會員等級 | NOT NULL, FK → MEMBERSHIP_LEVEL |
| admin_id | BIGINT | 建立者店員 | FK → ADMIN, ON DELETE SET NULL |
| join_date | DATE | 加入日期 | NOT NULL |
| email | VARCHAR(50) | 電子郵箱 | NOT NULL, UNIQUE |
| phone | VARCHAR(15) | 聯絡電話 | NOT NULL |
| balance | INTEGER | 帳戶餘額 | DEFAULT 0, >= 0 |
| status | VARCHAR(15) | 會員狀態 | NOT NULL, 值：'Active', 'Inactive', 'Suspended' |

**外鍵關係**：
- `level_id` → `MEMBERSHIP_LEVEL.level_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- `admin_id` → `ADMIN.admin_id` (ON DELETE SET NULL, ON UPDATE CASCADE)

---

### 4. BOOK（書籍表）

儲存書籍基本資訊。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| book_id | BIGSERIAL | 書籍ID（主鍵） | PRIMARY KEY |
| sequence_name | VARCHAR(50) | 所屬系列名稱 | NULL |
| name | VARCHAR(100) | 書名 | NOT NULL |
| author | VARCHAR(50) | 作者 | NOT NULL |
| publisher | VARCHAR(50) | 出版社 | NULL |
| price | INTEGER | 書籍定價 | NOT NULL, > 0 |

---

### 5. CATEGORY（分類表）

定義書籍分類。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| category_id | BIGSERIAL | 分類ID（主鍵） | PRIMARY KEY |
| name | VARCHAR(30) | 分類名稱 | NOT NULL, UNIQUE |

---

### 6. BOOK_CATEGORY（書籍分類關係表）

書籍與分類的多對多關係。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| book_id | BIGINT | 書籍ID | PRIMARY KEY, FK → BOOK |
| category_id | BIGINT | 分類ID | PRIMARY KEY, FK → CATEGORY |

**外鍵關係**：
- `book_id` → `BOOK.book_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- `category_id` → `CATEGORY.category_id` (ON DELETE CASCADE, ON UPDATE CASCADE)

---

### 7. CONDITION_DISCOUNT（書況折扣表）

定義不同書況的租金折扣。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| book_condition | VARCHAR(20) | 書況（主鍵） | PRIMARY KEY, 值：'Good', 'Fair', 'Poor' |
| discount_factor | DECIMAL(3,2) | 租金折扣乘數 | NOT NULL, 範圍：0-1 |

**預設資料**：
- Good: 1.0
- Fair: 0.9
- Poor: 0.6

---

### 8. BOOK_COPIES（書籍複本表）

儲存每本實體書的詳細資訊（弱實體）。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| book_id | BIGINT | 書籍ID | PRIMARY KEY, FK → BOOK |
| copies_serial | INTEGER | 複本序號 | PRIMARY KEY |
| status | VARCHAR(15) | 狀態 | NOT NULL, 值：'Available', 'Borrowed', 'Reserved', 'Lost' |
| purchase_date | DATE | 採購日期 | NOT NULL |
| purchase_price | INTEGER | 採購價格 | NOT NULL, > 0 |
| book_condition | VARCHAR(20) | 書況 | NOT NULL, FK → CONDITION_DISCOUNT |
| rental_price | INTEGER | 單次租金定價 | NOT NULL, > 0 |

**計算規則**：`rental_price = BOOK.price × 0.1`

**外鍵關係**：
- `book_id` → `BOOK.book_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- `book_condition` → `CONDITION_DISCOUNT.book_condition` (ON DELETE RESTRICT, ON UPDATE CASCADE)

---

### 9. BOOK_LOAN（借閱交易表）

記錄每次借閱交易。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| loan_id | BIGSERIAL | 借閱ID（主鍵） | PRIMARY KEY |
| admin_id | BIGINT | 处理店員 | NOT NULL, FK → ADMIN |
| member_id | BIGINT | 借閱會員 | NOT NULL, FK → MEMBER |
| final_price | INTEGER | 總租金 | NOT NULL, >= 0 |

**說明**：`final_price` 是該交易下所有 `LOAN_RECORD` 費用的總和。

**外鍵關係**：
- `admin_id` → `ADMIN.admin_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- `member_id` → `MEMBER.member_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)

---

### 10. LOAN_RECORD（借閱記錄詳情表）

記錄每本書在每次借閱中的詳細資訊（弱實體）。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| loan_id | BIGINT | 借閱ID | PRIMARY KEY, FK → BOOK_LOAN |
| book_id | BIGINT | 書籍ID | PRIMARY KEY, FK → BOOK_COPIES |
| copies_serial | INTEGER | 複本序號 | PRIMARY KEY, FK → BOOK_COPIES |
| date_out | DATE | 借出日期 | NOT NULL |
| due_date | DATE | 應還期限 | NOT NULL, >= date_out |
| return_date | DATE | 實際歸還日期 | NULL, >= date_out |
| overdue_fee | INTEGER | 逾期罰金 | DEFAULT 0, >= 0 |
| damage_fee | INTEGER | 損壞費 | DEFAULT 0, >= 0 |
| lost_fee | INTEGER | 遺失費 | DEFAULT 0, >= 0 |
| rental_fee | INTEGER | 單本租金 | NOT NULL, >= 0 |
| renew_cnt | INTEGER | 續借次數 | DEFAULT 0, >= 0 |

**計算規則**：
- `rental_fee = rental_price × discount_rate`（會員等級折扣）
- `overdue_fee = 逾期天數 × 10`（每逾期 1 天罰 10 元）

**外鍵關係**：
- `loan_id` → `BOOK_LOAN.loan_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- `(book_id, copies_serial)` → `BOOK_COPIES(book_id, copies_serial)` (ON DELETE CASCADE, ON UPDATE CASCADE)

---

### 11. RESERVATION（預約記錄表）

記錄會員的預約資訊。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| reservation_id | BIGSERIAL | 預約ID（主鍵） | PRIMARY KEY |
| member_id | BIGINT | 預約會員 | NOT NULL, FK → MEMBER |
| book_id | BIGINT | 預約書籍 | NOT NULL, FK → BOOK |
| reserve_date | DATE | 預約日期 | NOT NULL |
| pickup_date | DATE | 取書日期 | NULL, >= reserve_date |
| status | VARCHAR(15) | 狀態 | NOT NULL, 值：'Active', 'Fulfilled', 'Cancelled' |

**外鍵關係**：
- `member_id` → `MEMBER.member_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)
- `book_id` → `BOOK.book_id` (ON DELETE RESTRICT, ON UPDATE CASCADE)

---

### 12. RESERVATION_RECORD（預約書籍關係表）

預約與書籍的多對多關係（支援一次預約多本書）。

| 欄位名 | 類型 | 說明 | 約束 |
|--------|------|------|------|
| reservation_id | BIGINT | 預約ID | PRIMARY KEY, FK → RESERVATION |
| book_id | BIGINT | 書籍ID | PRIMARY KEY, FK → BOOK |

**外鍵關係**：
- `reservation_id` → `RESERVATION.reservation_id` (ON DELETE CASCADE, ON UPDATE CASCADE)
- `book_id` → `BOOK.book_id` (ON DELETE CASCADE, ON UPDATE CASCADE)

---

## MongoDB Schema

### search_history（搜尋記錄集合）

儲存會員的搜尋歷史記錄。

#### 文檔結構

```javascript
{
  member_id: Number,           // 會員ID（對應 PostgreSQL MEMBER.member_id）
  search_query: String,        // 搜尋關鍵詞
  search_date: Date,           // 搜尋日期時間
  book_ids: [Number],          // 搜尋結果相關的書籍ID列表
  filters: {                   // 搜尋篩選條件（可選）
    category: String,          // 分類篩選
    author: String,            // 作者篩選
    publisher: String,         // 出版社篩選
    min_price: Number,         // 最低價格
    max_price: Number          // 最高價格
  }
}
```

#### 索引

1. **member_id** (升序) - 快速查詢特定會員的搜尋歷史
2. **search_date** (降序) - 按時间排序
3. **member_id + search_date** (複合索引) - 查詢特定會員的搜尋歷史並按時间排序
4. **search_query** (文字索引) - 全文搜尋搜尋關鍵詞
5. **book_ids** (升序) - 查詢包含特定書籍的搜尋記錄

---

## 關係图說明

### 主要關係

1. **會員等級關係**
   - `MEMBER` ← `MEMBERSHIP_LEVEL` (多對一)
   - 每個會員屬於一個等級

2. **會員註冊關係**
   - `MEMBER` ← `ADMIN` (多對一)
   - 每個會員由一位店員註冊

3. **書籍分類關係**
   - `BOOK` ↔ `CATEGORY` (多對多，通過 `BOOK_CATEGORY`)

4. **書籍複本關係**
   - `BOOK` ← `BOOK_COPIES` (一對多，弱實體)
   - 每本書可以有多個複本

5. **借閱關係**
   - `MEMBER` → `BOOK_LOAN` (一對多)
   - `BOOK_LOAN` → `LOAN_RECORD` (一對多，弱實體)
   - `LOAN_RECORD` → `BOOK_COPIES` (多對一)

6. **預約關係**
   - `MEMBER` → `RESERVATION` (一對多)
   - `RESERVATION` ↔ `BOOK` (多對多，通過 `RESERVATION_RECORD`)

---

## 資料完整性約束

### 外鍵約束

- 所有外鍵都設定了適當的 `ON DELETE` 和 `ON UPDATE` 行為
- 關鍵資料（如會員、書籍）使用 `RESTRICT` 防止誤刪
- 關聯資料（如借閱記錄）使用 `CASCADE` 自動清理

### 檢查約束

- 狀態欄位使用枚舉值限制
- 數值欄位（價格、餘額等）使用範圍檢查
- 日期欄位使用邏輯檢查（如 `due_date >= date_out`）

### 唯一約束

- 會員郵箱唯一
- 會員等級名稱唯一
- 分類名稱唯一

---

## 索引策略

### 主鍵索引

所有表的主鍵自動建立索引。

### 外鍵索引

為所有外鍵欄位建立索引，提高關聯查詢效能。

### 業務索引

- `MEMBER.status` - 快速篩選活躍會員
- `BOOK_COPIES.status` - 快速查詢可借書籍
- `LOAN_RECORD.due_date` - 快速查詢即將到期的借閱
- `RESERVATION.status` - 快速查詢活躍預約

---

## 資料計算規則

### 租金計算

1. 基礎租金：`rental_price = BOOK.price × 0.1`
2. 會員折扣：`rental_fee = rental_price × discount_rate`
3. 書況折扣：實際租金 = `rental_fee × discount_factor`

### 罰金計算

- 逾期罰金：`overdue_fee = 逾期天數 × 10`
- 損壞費和遺失費：由管理員手動設定

### 會員等級判定

根據 `MEMBER.balance` 和 `MEMBERSHIP_LEVEL.min_balance_required` 自動判定：
- 餘額 >= 3000 → 金級
- 餘額 >= 1500 → 銀級
- 餘額 >= 500 → 銅級

---

## 注意事項

1. **弱實體**：`BOOK_COPIES` 和 `LOAN_RECORD` 是弱實體，依賴父實體存在
2. **級聯刪除**：刪除書籍会級聯刪除所有複本和關聯記錄
3. **資料一致性**：`BOOK_LOAN.final_price` 应與 `LOAN_RECORD` 費用總和一致（建議使用觸發器或應用層保證）
4. **MongoDB 關聯**：`search_history.member_id` 应與 PostgreSQL `MEMBER.member_id` 保持一致

