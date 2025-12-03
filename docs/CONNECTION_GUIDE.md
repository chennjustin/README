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
   - `DATABASE_URL`: PostgreSQL 連接字串
   - `DATABASE_POOL_URL`: 連接池字串（推薦用於生產環境）

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

### 方法 2: 使用 PostgreSQL 直接連接

適用於需要執行複雜 SQL 查詢的後端應用。

```javascript
// 使用 pg 套件
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 查詢範例
const result = await pool.query('SELECT * FROM BOOK LIMIT 10');

// 詳細範例請參考：examples/connect-postgres.js
```

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

// 驗證配置
if (!dbConfig.validate()) {
  process.exit(1);
}

// 使用配置
const { supabase, postgres, mongodb } = dbConfig;
```

---

## 常見問題

### Q: 應該使用 Supabase Client 還是直接連接 PostgreSQL？

**A:** 
- **Supabase Client**：推薦用於前端和簡單的後端操作，提供自動類型檢查、即時訂閱等功能
- **PostgreSQL 直接連接**：適用於需要執行複雜 SQL、存儲過程、或需要更多控制權的場景

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

