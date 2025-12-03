# 資料汇入指南

本指南說明如何將業務資料匯入「獨立租借書店」系統的資料庫。

## 目錄

- [準備工作](#準備工作)
- [Supabase 資料匯入](#supabase-資料匯入)
- [MongoDB 資料匯入](#mongodb-資料匯入)
- [資料模板](#資料模板)
- [驗證資料](#驗證資料)

---

## 準備工作

### 1. 確認資料庫已設定

确保您已经：
- ✅ 完成 Supabase 資料庫 schema 部署
- ✅ 完成 MongoDB 資料庫初始化
- ✅ 已匯入基礎資料（會員等級、書況折扣）

參考：[設定指南](./setup_guide.md)

### 2. 準備資料檔案

根據您的資料來源，準備以下格式的檔案：
- **CSV 檔案**：用於批次匯入
- **SQL 檔案**：用於直接執行 SQL 語句
- **JSON 檔案**：用於 MongoDB 匯入

---

## Supabase 資料匯入

### 方法 1: 使用 Supabase Dashboard（推薦）

#### 匯入 CSV 檔案

1. 登入 Supabase Dashboard
2. 進入 **Table Editor**
3. 選擇要匯入資料的表
4. 點擊右上角的 **"Insert"** → **"Import data via CSV"**
5. 上傳 CSV 檔案
6. 確認列映射和資料類型
7. 點擊 **"Import"**

**注意事项**：
- CSV 檔案第一行應為列名
- 确保列名與資料庫表欄位名一致
- 日期格式：`YYYY-MM-DD`
- 外鍵欄位應使用已存在的 ID 值

#### 使用 SQL Editor

1. 進入 **SQL Editor**
2. 編寫 INSERT 語句或使用提供的 SQL 腳本
3. 執行 SQL

範例：
```sql
-- 插入管理員
INSERT INTO ADMIN (name, phone, role, status) VALUES
('張經理', '0912345678', 'Manager', 'Active'),
('李店員', '0923456789', 'Clerk', 'Active');

-- 插入分類
INSERT INTO CATEGORY (name) VALUES
('小說'),
('文學'),
('歷史');
```

### 方法 2: 使用 psql 命令行工具

1. 取得資料庫連接字串（在 Supabase Dashboard → Settings → Database）
2. 使用 psql 連接：
   ```bash
   psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```
3. 執行 SQL 檔案：
   ```bash
   \i path/to/your/data.sql
   ```
   或
   ```bash
   psql "connection_string" -f path/to/your/data.sql
   ```

### 方法 3: 使用 Python 腳本

建立 Python 腳本批次匯入資料：

```python
import psycopg2
import csv
from supabase import create_client, Client

# 連接 Supabase
url = "https://[PROJECT-REF].supabase.co"
key = "your-anon-key"
supabase: Client = create_client(url, key)

# 讀取 CSV 並插入資料
with open('books.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        data = {
            'name': row['name'],
            'author': row['author'],
            'publisher': row['publisher'],
            'price': int(row['price'])
        }
        supabase.table('BOOK').insert(data).execute()
```

---

## MongoDB 資料匯入

### 方法 1: 使用 MongoDB Compass

1. 下載並安裝 [MongoDB Compass](https://www.mongodb.com/products/compass)
2. 使用連接字串連接到您的 MongoDB Atlas 叢集
3. 選擇 `book_rental_db` 資料庫
4. 選擇 `search_history` 集合
5. 點擊 **"Add Data"** → **"Import File"**
6. 選擇 JSON 或 CSV 檔案
7. 確認欄位映射
8. 點擊 **"Import"**

### 方法 2: 使用 mongoimport

```bash
mongoimport --uri "mongodb+srv://username:password@cluster.mongodb.net/book_rental_db" \
  --collection search_history \
  --file search_history.json \
  --jsonArray
```

### 方法 3: 使用 Node.js 腳本

```javascript
const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGODB_URI = 'mongodb+srv://username:password@cluster.mongodb.net/book_rental_db';
const client = new MongoClient(MONGODB_URI);

async function importData() {
    try {
        await client.connect();
        const db = client.db('book_rental_db');
        const collection = db.collection('search_history');
        
        // 讀取 JSON 檔案
        const data = JSON.parse(fs.readFileSync('search_history.json', 'utf8'));
        
        // 批次插入
        await collection.insertMany(data);
        console.log(`成功匯入 ${data.length} 條記錄`);
    } finally {
        await client.close();
    }
}

importData();
```

---

## 資料模板

### 1. 管理員資料 (ADMIN.csv)

```csv
name,phone,role,status
張經理,0912345678,Manager,Active
李店員,0923456789,Clerk,Active
王店員,0934567890,Clerk,Active
```

### 2. 會員資料 (MEMBER.csv)

```csv
name,level_id,admin_id,join_date,email,phone,balance,status
張三,1,1,2025-01-01,zhang@example.com,0911111111,1000,Active
李四,2,1,2025-01-02,li@example.com,0922222222,2000,Active
王五,3,1,2025-01-03,wang@example.com,0933333333,5000,Active
```

**注意**：
- `level_id`: 1=銅, 2=銀, 3=金（需先查詢 MEMBERSHIP_LEVEL 表取得實際 ID）
- `admin_id`: 需使用已存在的管理員 ID
- `join_date`: 格式為 `YYYY-MM-DD`

### 3. 書籍資料 (BOOK.csv)

```csv
sequence_name,name,author,publisher,price
哈利波特系列,哈利波特：神秘的魔法石,J.K. 羅琳,皇冠文化,350
哈利波特系列,哈利波特：消失的密室,J.K. 羅琳,皇冠文化,350
,Python 程式設計入門,張三,科技出版社,500
```

### 4. 分類資料 (CATEGORY.csv)

```csv
name
小說
文學
歷史
科學
商業
心理學
旅遊
藝術
```

### 5. 書籍分類關係 (BOOK_CATEGORY.csv)

```csv
book_id,category_id
1,1
1,2
2,1
3,4
```

### 6. 書籍複本資料 (BOOK_COPIES.csv)

```csv
book_id,copies_serial,status,purchase_date,purchase_price,book_condition,rental_price
1,1,Available,2025-01-01,280,Good,35
1,2,Available,2025-01-01,280,Fair,35
1,3,Borrowed,2025-01-01,280,Good,35
```

**注意**：
- `rental_price = BOOK.price × 0.1`
- `book_condition`: 'Good', 'Fair', 'Poor'

### 7. 搜尋記錄資料 (search_history.json)

```json
[
  {
    "member_id": 1,
    "search_query": "Python 程式設計",
    "search_date": "2025-01-15T10:30:00Z",
    "book_ids": [3, 5, 7],
    "filters": {
      "category": "科學",
      "min_price": 100,
      "max_price": 500
    }
  },
  {
    "member_id": 1,
    "search_query": "小說",
    "search_date": "2025-01-16T14:20:00Z",
    "book_ids": [1, 2],
    "filters": {
      "category": "小說"
    }
  }
]
```

---

## 匯入順序建議

为避免外鍵約束錯誤，建議按以下順序匯入資料：

### 1. 基礎資料（必需）
1. ✅ `MEMBERSHIP_LEVEL` - 會員等級（已在 seed.sql 中）
2. ✅ `CONDITION_DISCOUNT` - 書況折扣（已在 seed.sql 中）

### 2. 基礎實體
3. `ADMIN` - 管理員
4. `CATEGORY` - 分類
5. `BOOK` - 書籍

### 3. 關係資料
6. `BOOK_CATEGORY` - 書籍分類關係
7. `BOOK_COPIES` - 書籍複本

### 4. 會員資料
8. `MEMBER` - 會員（需要 ADMIN 和 MEMBERSHIP_LEVEL 已存在）

### 5. 業務資料
9. `RESERVATION` - 預約（需要 MEMBER 和 BOOK 已存在）
10. `RESERVATION_RECORD` - 預約書籍關係
11. `BOOK_LOAN` - 借閱交易（需要 MEMBER、ADMIN 已存在）
12. `LOAN_RECORD` - 借閱記錄（需要 BOOK_LOAN 和 BOOK_COPIES 已存在）

### 6. NoSQL 資料
13. `search_history` - 搜尋記錄（MongoDB，需要 MEMBER 已存在）

---

## 資料驗證

### 驗證 Supabase 資料

#### 1. 檢查資料完整性

```sql
-- 檢查會員等級資料
SELECT * FROM MEMBERSHIP_LEVEL;

-- 檢查會員資料
SELECT m.member_id, m.name, m.balance, ml.level_name 
FROM MEMBER m 
JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id;

-- 檢查書籍資料
SELECT b.book_id, b.name, COUNT(bc.copies_serial) as copies_count
FROM BOOK b
LEFT JOIN BOOK_COPIES bc ON b.book_id = bc.book_id
GROUP BY b.book_id, b.name;

-- 檢查外鍵完整性
SELECT COUNT(*) as total_members FROM MEMBER;
SELECT COUNT(*) as members_with_valid_level 
FROM MEMBER m 
WHERE EXISTS (SELECT 1 FROM MEMBERSHIP_LEVEL ml WHERE ml.level_id = m.level_id);
```

#### 2. 檢查資料一致性

```sql
-- 檢查會員余额是否足夠
SELECT member_id, name, balance, level_id 
FROM MEMBER 
WHERE balance < 0;

-- 檢查借閱記錄完整性
SELECT bl.loan_id, COUNT(lr.loan_id) as record_count, bl.final_price
FROM BOOK_LOAN bl
LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
GROUP BY bl.loan_id, bl.final_price;

-- 檢查書籍複本状态
SELECT status, COUNT(*) as count
FROM BOOK_COPIES
GROUP BY status;
```

### 驗證 MongoDB 資料

```javascript
// 使用 MongoDB Compass 或 mongo shell

// 檢查文檔數量
db.search_history.countDocuments()

// 檢查索引
db.search_history.getIndexes()

// 查詢特定會員的搜尋記錄
db.search_history.find({ member_id: 1 }).sort({ search_date: -1 })

// 檢查資料格式
db.search_history.findOne()
```

---

## 常见問題

### Supabase

**Q: 匯入時出現外鍵約束錯誤**
A: 确保先匯入被引用的表（如先匯入 ADMIN 再匯入 MEMBER）

**Q: 日期格式錯誤**
A: 使用 `YYYY-MM-DD` 格式，例如：`2025-01-15`

**Q: 如何批次更新資料**
A: 使用 UPDATE 語句配合 WHERE 條件，或使用 Supabase Dashboard 的批次編輯功能

### MongoDB

**Q: 匯入 JSON 時格式錯誤**
A: 确保 JSON 格式正確，使用 `--jsonArray` 參數匯入陣列格式

**Q: 如何更新現有資料**
A: 使用 `updateOne()` 或 `updateMany()` 方法，或使用 MongoDB Compass 的編輯功能

**Q: member_id 與 PostgreSQL 不一致**
A: 确保 MongoDB 中的 `member_id` 與 Supabase `MEMBER.member_id` 保持一致

---

## 資料備份

### Supabase 備份

1. 在 Supabase Dashboard 中，進入 **Settings** → **Database**
2. 點擊 **Backups** 查看自动備份
3. 或使用 `pg_dump` 手動備份：
   ```bash
   pg_dump "connection_string" > backup.sql
   ```

### MongoDB 備份

```bash
mongodump --uri "connection_string" --out /path/to/backup
```

---

## 下一步

資料匯入完成後：

1. ✅ 驗證資料完整性和一致性
2. ✅ 測試應用程式連接
3. ✅ 進行功能測試
4. ✅ 設定定期備份

---

## 技術支援

如遇到問題：
1. 檢查錯誤訊息，確認資料類型和約束
2. 參考 [Schema 參考文檔](./schema_reference.md) 了解表結構
3. 聯絡團隊成員取得幫助

