# 資料庫連接指南

本指南說明如何在您的前端/後端應用程式中連接到雲端資料庫。

## 📋 目錄

- [快速開始](#快速開始)
- [環境變數設定](#環境變數設定)
- [Node.js 連接範例](#nodejs-連接範例)
- [Python 連接範例](#python-連接範例)
- [前端連接範例](#前端連接範例)
- [常見問題](#常見問題)

---

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

這會安裝以下套件：
- `@supabase/supabase-js` - Supabase 客戶端
- `pg` - PostgreSQL 驅動
- `mongodb` - MongoDB 驅動
- `dotenv` - 環境變數管理

### 2. 設定環境變數

1. 複製環境變數範例檔案：
   ```bash
   cp .env.example .env
   ```

2. 編輯 `.env` 檔案，填入您的資料庫連接資訊：
   - 從 Supabase Dashboard → Settings → API 取得 URL 和 Keys
   - 從 Supabase Dashboard → Settings → Database 取得連接字串
   - 從 MongoDB Atlas Dashboard → Connect 取得連接字串

### 3. 測試連接

```bash
# 測試所有連接
npm run test:connection

# 或分別測試
npm run test:supabase
npm run test:postgres
npm run test:mongodb
```

---

## 環境變數設定

### Supabase 連接資訊

在 Supabase Dashboard 中取得：

1. **Settings → API**：
   - `SUPABASE_URL`: 專案 URL
   - `SUPABASE_ANON_KEY`: 公開 API 密鑰（用於前端）
   - `SUPABASE_SERVICE_ROLE_KEY`: 服務角色密鑰（僅用於後端，請保密）

2. **Settings → Database**：
   - `DATABASE_URL`: PostgreSQL 連接字串（**後端開發必備**）
     - 在 **Connection string** 區塊，選擇 **URI** 格式
     - **方式 A：直接連接（port 5432）**
       - 格式：`postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres`
       - 將 `[YOUR-PASSWORD]` 替換為您的資料庫密碼
     - **方式 B：連接池連接（port 6543，推薦）**
       - 格式：`postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20`
       - 注意：必須包含 `?pgbouncer=true&connection_limit=1&pool_timeout=20` 參數
       - 如果直接連接（5432）失敗，建議使用連接池連接（6543）
     - 如果忘記密碼，可以在 **Settings → Database → Reset database password** 重置
   - `DATABASE_POOL_URL`: 連接池字串（可選，與 DATABASE_URL 設定連接池 URL 效果相同）

### MongoDB 連接資訊

在 MongoDB Atlas Dashboard 中取得：

1. **Connect → Connect your application**：
   - `MONGODB_URI`: 連接字串
   - `MONGODB_DATABASE`: 資料庫名稱（預設：book_rental_db）

---

## Node.js 連接範例

### 方法 1: 使用 Supabase Client（推薦）

適用於前端和後端，提供自動類型檢查和即時功能。

```javascript
// 使用 Supabase Client
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 查詢範例
const { data, error } = await supabase
  .from('BOOK')
  .select('*')
  .limit(10);

// 詳細範例請參考：examples/connect-supabase.js
```

### 方法 2: 使用 PostgreSQL 直接連接（推薦後端使用）

**適用於後端開發**，提供完整的 SQL 功能和更好的控制權。

#### 方式 A: 使用配置模組（推薦）

```javascript
// 使用專案提供的配置模組
const { postgresPool } = require('../config/database');
require('dotenv').config();

// 取得連接池
const pool = postgresPool();

// 查詢範例
const result = await pool.query('SELECT * FROM BOOK LIMIT 10');

// 複雜查詢範例（JOIN、子查詢等）
const memberWithLoans = await pool.query(`
  SELECT 
    m.member_id,
    m.name,
    m.email,
    ml.level_name,
    COUNT(lr.loan_id) as total_loans
  FROM MEMBER m
  JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
  LEFT JOIN LOAN_RECORD lr ON m.member_id = (
    SELECT member_id FROM BOOK_LOAN WHERE loan_id = lr.loan_id
  )
  WHERE m.status = 'Active'
  GROUP BY m.member_id, m.name, m.email, ml.level_name
`);

// 事務範例
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // 執行多個操作
  await client.query('INSERT INTO BOOK ...');
  await client.query('INSERT INTO BOOK_COPIES ...');
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

#### 方式 B: 直接使用 pg 套件

```javascript
// 使用 pg 套件
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase 需要 SSL
});

// 查詢範例
const result = await pool.query('SELECT * FROM BOOK LIMIT 10');

// 詳細範例請參考：examples/connect-postgres.js
```

**取得 DATABASE_URL**：
1. 登入 Supabase Dashboard
2. 前往 **Settings → Database**
3. 在 **Connection string** 區塊，選擇 **URI** 格式
4. **推薦使用連接池連接（port 6543）**：
   - 複製連接字串（格式：`postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres`）
   - 將 `[YOUR-PASSWORD]` 替換為您的資料庫密碼
   - **重要**：在連接字串末尾加上 `?pgbouncer=true&connection_limit=1&pool_timeout=20`
   - 完整範例：`postgresql://postgres.xxxxx:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20`
5. 如果連接池連接失敗，可以嘗試直接連接（port 5432）：
   - 格式：`postgresql://postgres:[YOUR-PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres`
6. 將連接字串設定到 `.env` 檔案的 `DATABASE_URL` 變數

### 方法 3: 使用 MongoDB

```javascript
// 使用 MongoDB 驅動
const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const db = client.db(process.env.MONGODB_DATABASE);
const collection = db.collection('search_history');

// 查詢範例
const results = await collection.find({ member_id: 1 }).toArray();

// 詳細範例請參考：examples/connect-mongodb.js
```

---

## Python 連接範例

### 安裝依賴

```bash
pip install psycopg2-binary pymongo python-dotenv
```

### 使用範例

```python
import os
from dotenv import load_dotenv
import psycopg2
from pymongo import MongoClient

load_dotenv()

# PostgreSQL 連接
conn = psycopg2.connect(
    os.getenv('DATABASE_URL'),
    sslmode='require'
)

# MongoDB 連接
client = MongoClient(os.getenv('MONGODB_URI'))
db = client[os.getenv('MONGODB_DATABASE', 'book_rental_db')]

# 詳細範例請參考：examples/connect-python.py
```

---

## 前端連接範例

### React / Next.js

```javascript
// 安裝 Supabase 客戶端
// npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 在元件中使用
function BookList() {
  const [books, setBooks] = useState([]);

  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase
        .from('BOOK')
        .select('*');
      
      if (error) console.error(error);
      else setBooks(data);
    }
    
    fetchBooks();
  }, []);

  return (
    <div>
      {books.map(book => (
        <div key={book.book_id}>{book.name}</div>
      ))}
    </div>
  );
}
```

### Vue.js

```javascript
// 安裝 Supabase 客戶端
// npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// 在元件中使用
export default {
  data() {
    return {
      books: []
    }
  },
  async mounted() {
    const { data, error } = await supabase
      .from('BOOK')
      .select('*');
    
    if (error) console.error(error);
    else this.books = data;
  }
}
```

---

## 使用配置模組

專案提供了統一的配置模組，方便管理連接：

```javascript
// 使用配置模組
const dbConfig = require('./config/database');
require('dotenv').config();

// 驗證配置
if (!dbConfig.validate()) {
  process.exit(1);
}

// 後端開發：使用 PostgreSQL 連接池（推薦）
const pool = dbConfig.postgresPool();

// 執行查詢
const result = await pool.query('SELECT * FROM MEMBER WHERE member_id = $1', [1]);

// 前端開發：使用 Supabase Client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  dbConfig.supabase.url,
  dbConfig.supabase.anonKey
);

// MongoDB 連接
const { MongoClient } = require('mongodb');
const mongoClient = new MongoClient(dbConfig.mongodb.uri);
await mongoClient.connect();
const db = mongoClient.db(dbConfig.mongodb.database);
```

---

## 常見問題

### Q: 應該使用 Supabase Client 還是直接連接 PostgreSQL？

**A:** 
- **Supabase Client**：推薦用於前端和簡單的後端操作，提供自動類型檢查、即時訂閱等功能
- **PostgreSQL 直接連接（DATABASE_URL）**：**強烈推薦用於後端開發**，原因：
  - ✅ 更靈活：可以執行任意複雜的 SQL 查詢、JOIN、子查詢、存儲過程
  - ✅ 更直觀：直接使用 SQL，不需要學習 Supabase Client 的 API
  - ✅ 更高效：避免 Client 層的額外開銷，直接與資料庫通訊
  - ✅ 更易除錯：SQL 錯誤訊息更清晰，可以直接在 Supabase Dashboard 的 SQL Editor 測試
  - ✅ 支援事務：更容易處理複雜的業務邏輯和資料一致性
  - ✅ 連接池管理：自動管理連接，適合高併發場景

**建議**：
- 前端：使用 Supabase Client（`SUPABASE_URL` + `SUPABASE_ANON_KEY`）
- 後端：使用 PostgreSQL 直接連接（`DATABASE_URL`）

### Q: 如何選擇使用哪個 Key？

**A:**
- **ANON KEY**：用於前端和公開 API，有 Row Level Security (RLS) 保護
- **SERVICE_ROLE KEY**：僅用於後端，繞過 RLS，請勿在前端使用

### Q: 連接失敗怎麼辦？

**A:**
1. 檢查環境變數是否正確設定
2. 確認連接字串格式正確
3. 檢查網路訪問權限（MongoDB Atlas）
4. 確認 SSL 設定（Supabase 需要 SSL）

### Q: 如何保護敏感資訊？

**A:**
- 使用 `.env` 檔案（已加入 `.gitignore`）
- 不要在程式碼中硬編碼連接資訊
- 使用環境變數管理服務（如 Vercel、Netlify 的環境變數功能）

---

## 更多資源

- [Supabase 文檔](https://supabase.com/docs)
- [PostgreSQL 文檔](https://www.postgresql.org/docs/)
- [MongoDB Node.js 驅動文檔](https://www.mongodb.com/docs/drivers/node/)
- [專案範例程式碼](./examples/)

---

## 下一步

連接設定完成後，您可以：

1. 查看 [Schema 參考](../database/docs/schema_reference.md) 了解資料庫結構
2. 參考 [資料匯入指南](../database/docs/data_import_guide.md) 匯入業務資料
3. 開始開發您的應用程式功能

