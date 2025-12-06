# 虛擬資料生成說明

本文件說明如何使用 `generate_mock_data.sql` 腳本來生成測試用的虛擬資料。

## 📋 概述

`generate_mock_data.sql` 腳本會為書店系統生成完整的虛擬資料，**不包括 BOOK 表的資料**（假設您已經有書籍資料）。

## ⚠️ 重要提示

1. **執行順序**：
   - 必須先執行 `001_initial_schema.sql`（建立資料表結構）
   - 必須先執行 `seed.sql`（建立基礎資料：會員等級、書況折扣、費用類型）
   - 必須確保 **BOOK 表已經有資料**
   - 最後執行 `generate_mock_data.sql`

2. **資料依賴**：
   - 腳本會自動查詢現有的 BOOK 資料
   - 如果 BOOK 表為空，部分資料可能無法生成

3. **重複執行**：
   - 腳本使用 `ON CONFLICT DO NOTHING`，可以安全地重複執行
   - 但建議在測試環境中使用，避免在生產環境中執行

## 📊 生成的資料

### 1. ADMIN（店員/管理員）
- 生成 5 位店員
- 包含 1 位經理和 4 位店員
- 所有狀態為 'Active'

### 2. MEMBER（會員）
- 生成約 18 位會員
- 包含銅級、銀級、金級會員
- 包含活躍、非活躍、暫停狀態的會員
- 餘額範圍：200-6000 元

### 3. CATEGORY（分類）
- 生成 12 個書籍分類
- 包含：小說、文學、歷史、科學、商業、心理學、旅遊、藝術、電腦科學、哲學、傳記、教育

### 4. BOOK_CATEGORY（書籍分類關聯）
- 為每本現有的書籍分配 1-3 個隨機分類
- 最多處理 50 本書（如果超過，請調整腳本中的 LIMIT）

### 5. BOOK_COPIES（書籍複本）
- 為每本現有的書籍生成 2-5 個複本
- 隨機分配書況（Good 60%, Fair 30%, Poor 10%）
- 隨機分配狀態（Available 70%, Borrowed 25%, Lost 5%）
- 採購日期為過去 6 個月內
- 最多處理 50 本書（如果超過，請調整腳本中的 LIMIT）

### 6. BOOK_LOAN（借閱交易）
- 為每個活躍會員生成 0-5 筆借閱記錄
- 借閱日期為過去 90 天內
- 每筆借閱包含 1-3 本書（不超過會員等級上限）

### 7. LOAN_RECORD（借閱記錄詳情）
- 為每筆借閱交易生成詳細記錄
- 包含借出日期、應還日期、實際歸還日期
- 70% 的借閱已歸還
- 20% 的借閱有續借記錄
- 自動計算租金（考慮會員等級折扣）

### 8. ADD_FEE（額外費用）
- 為續借記錄生成續借費（10 元）
- 為逾期記錄生成逾期費（每日 10 元）
  - **重要**：逾期費有上限限制，最多收取 365 天的費用（3650 元）
  - 超過 365 天不再收取，因為會由店員手動停權
- 5% 的歸還記錄有損壞費
- 自動根據費用類型計算金額

### 9. RESERVATION（預約記錄）
- 為 20 位活躍會員生成預約記錄
- 每個會員 0-2 筆預約
- 包含 Active、Fulfilled、Cancelled 狀態
- 預約日期為過去 30 天內

### 10. RESERVATION_RECORD（預約書籍關聯）
- 為每筆預約分配 1-3 本書
- 隨機選擇現有的書籍

## 🚀 使用方法

### 方法 1: 使用 Supabase Dashboard（推薦）

1. 登入 Supabase Dashboard
2. 前往 **SQL Editor**
3. 點擊 **New query**
4. 開啟 `generate_mock_data.sql` 檔案
5. 複製全部內容並貼上到 SQL Editor
6. 點擊 **Run** 或按 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
7. 等待執行完成，查看結果訊息

### 方法 2: 使用 psql 命令列

```bash
# 設定環境變數
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# 執行腳本
psql $DATABASE_URL -f database/relational/generate_mock_data.sql
```

### 方法 3: 使用 Node.js 腳本

```javascript
const { postgresPool } = require('./config/database');
const fs = require('fs');

async function generateMockData() {
    const pool = postgresPool();
    const sql = fs.readFileSync('database/relational/generate_mock_data.sql', 'utf8');
    
    try {
        await pool.query(sql);
        console.log('✅ 虛擬資料生成完成！');
    } catch (error) {
        console.error('❌ 生成失敗：', error);
    } finally {
        await pool.end();
    }
}

generateMockData();
```

## ✅ 驗證資料

執行完成後，可以使用以下 SQL 查詢驗證資料：

```sql
-- 檢查各表的資料數量
SELECT 
    'ADMIN' as table_name, COUNT(*) as count FROM ADMIN
UNION ALL
SELECT 'MEMBER', COUNT(*) FROM MEMBER
UNION ALL
SELECT 'CATEGORY', COUNT(*) FROM CATEGORY
UNION ALL
SELECT 'BOOK_CATEGORY', COUNT(*) FROM BOOK_CATEGORY
UNION ALL
SELECT 'BOOK_COPIES', COUNT(*) FROM BOOK_COPIES
UNION ALL
SELECT 'BOOK_LOAN', COUNT(*) FROM BOOK_LOAN
UNION ALL
SELECT 'LOAN_RECORD', COUNT(*) FROM LOAN_RECORD
UNION ALL
SELECT 'ADD_FEE', COUNT(*) FROM ADD_FEE
UNION ALL
SELECT 'RESERVATION', COUNT(*) FROM RESERVATION
UNION ALL
SELECT 'RESERVATION_RECORD', COUNT(*) FROM RESERVATION_RECORD;

-- 檢查借閱記錄的完整性
SELECT 
    bl.loan_id,
    COUNT(lr.book_id) as books_count,
    bl.final_price,
    SUM(lr.rental_fee) as calculated_total
FROM BOOK_LOAN bl
LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
GROUP BY bl.loan_id, bl.final_price
LIMIT 10;

-- 檢查會員借閱情況
SELECT 
    m.member_id,
    m.name,
    ml.level_name,
    COUNT(DISTINCT bl.loan_id) as total_loans,
    COUNT(DISTINCT lr.book_id) as total_books_borrowed
FROM MEMBER m
JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
LEFT JOIN BOOK_LOAN bl ON m.member_id = bl.member_id
LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
WHERE m.status = 'Active'
GROUP BY m.member_id, m.name, ml.level_name
ORDER BY total_loans DESC
LIMIT 10;
```

## 🔧 自訂資料

如果需要調整生成的資料量，可以修改腳本中的以下參數：

- **會員數量**：修改 MEMBER 的 INSERT 語句
- **書籍複本數量**：修改 `copies_count := 2 + floor(random() * 4)::INTEGER;`
- **借閱記錄數量**：修改 `FOR i IN 1..(floor(random() * 6)::INTEGER)`
- **處理的書籍數量**：修改 `LIMIT 50` 為您需要的數量

## 📝 注意事項

1. **BOOK 表必須有資料**：腳本會查詢現有的 BOOK 資料，如果表為空，部分資料無法生成
2. **外鍵約束**：所有生成的資料都符合外鍵約束
3. **資料一致性**：借閱記錄的總金額會自動計算並更新到 BOOK_LOAN.final_price
4. **逾期費上限**：逾期費最多收取 365 天的費用（3650 元），超過 365 天不再收取
5. **隨機性**：每次執行生成的資料會有所不同（因為使用了隨機函數）

## 🐛 常見問題

### Q: 執行時出現外鍵約束錯誤
**A:** 請確認已執行 `seed.sql`，並且 BOOK 表有資料。

### Q: 生成的資料量太少
**A:** 可能是 BOOK 表的資料太少，或者需要調整腳本中的 LIMIT 和循環次數。

### Q: 想要清除所有虛擬資料
**A:** 可以使用以下 SQL（注意：這會刪除所有業務資料，保留基礎資料）：

```sql
-- 按順序刪除（注意外鍵約束）
DELETE FROM RESERVATION_RECORD;
DELETE FROM RESERVATION;
DELETE FROM ADD_FEE;
DELETE FROM LOAN_RECORD;
DELETE FROM BOOK_LOAN;
DELETE FROM BOOK_CATEGORY;
DELETE FROM BOOK_COPIES;
DELETE FROM MEMBER;
DELETE FROM CATEGORY;
DELETE FROM ADMIN;
```

## 📚 相關文件

- [Schema 參考](../docs/schema_reference.md)
- [資料匯入指南](../docs/data_import_guide.md)
- [設定指南](../docs/setup_guide.md)

