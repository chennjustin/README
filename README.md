# 獨立租借書店系統 - 資料庫專案

本倉庫包含「獨立租借書店」系統的完整資料庫架構，支援 Supabase (PostgreSQL) 和 MongoDB。

## 專案結構

```
README/
├── database/
│   ├── relational/        # 關聯式資料庫 (PostgreSQL/Supabase)
│   │   ├── migrations/    # 資料庫遷移檔案
│   │   ├── seed.sql       # 初始資料
│   │   └── README.md
│   ├── non-relational/    # 非關聯式資料庫 (MongoDB)
│   │   ├── schema/        # Schema 定義
│   │   ├── migrations/    # 遷移腳本
│   │   └── README.md
│   └── docs/              # 文檔
│       ├── setup_guide.md          # 設定指南
│       ├── schema_reference.md     # Schema 參考
│       └── data_import_guide.md     # 資料匯入指南
├── scripts/                # 自動化腳本
│   ├── setup_relational.sh      # 關聯式資料庫設定腳本
│   └── setup_non-relational.sh  # 非關聯式資料庫設定腳本
├── config/                 # 配置檔案
│   └── database.js        # 資料庫連接配置模組
├── examples/               # 範例與工具腳本
│   ├── connect-supabase.js         # Supabase 連接範例
│   ├── connect-postgres.js        # PostgreSQL 連接範例
│   ├── connect-mongodb.js         # MongoDB 連接範例
│   ├── connect-python.py           # Python 連接範例
│   ├── test-connections.js        # 連接測試腳本
│   ├── diagnose-postgres.js       # PostgreSQL 連接診斷工具
│   ├── diagnose-mongodb.js         # MongoDB 連接診斷工具
│   ├── run-mock-data.js            # 執行虛擬資料生成
│   ├── verify-data-consistency.js  # 驗證資料一致性
│   └── verify-deployment.sql       # 部署驗證查詢
├── docs/                   # 文檔
│   └── CONNECTION_GUIDE.md    # 資料庫連接指南
├── backend/               # 後端應用 (Express + TypeScript)
│   ├── src/               # 原始碼
│   ├── dist/              # 編譯後的程式碼
│   └── package.json
├── frontend/              # 前端應用 (React + TypeScript)
│   ├── src/               # 原始碼
│   ├── dist/              # 編譯後的程式碼
│   └── package.json
├── .env.example           # 環境變數範例
├── package.json            # Node.js 依賴配置
├── LICENSE                # 許可證檔案
└── README.md              # 本檔案
```

## 快速開始

### 📊 資料庫設定

#### 1. Supabase 設定

1. 建立 Supabase 帳號和專案
2. 執行 schema 遷移：
   ```bash
   # 方法 1: 使用腳本
   ./scripts/setup_relational.sh
   
   # 方法 2: 在 Supabase Dashboard 的 SQL Editor 中執行
   # database/relational/migrations/001_initial_schema.sql
   ```
3. 匯入初始資料（可選）：
   ```sql
   -- 在 SQL Editor 中執行
   -- database/relational/seed.sql
   ```

#### 2. MongoDB 設定

1. 建立 MongoDB Atlas 帳號和叢集
2. 初始化資料庫：
   ```bash
   # 方法 1: 使用腳本
   ./scripts/setup_non-relational.sh
   
   # 方法 2: 手動執行
   node database/non-relational/migrations/init_collections.js
   ```

### 🚀 啟動應用程式

#### 前置準備

1. **設定環境變數**：
   ```bash
   # 在專案根目錄（用於資料庫連接腳本）
   cp .env.example .env
   # 編輯 .env 檔案，填入資料庫連接資訊（Supabase 和 MongoDB）
   
   # 後端和前端通常會從根目錄的 .env 讀取配置
   # 如果需要單獨配置，請在對應目錄下創建 .env 檔案
   ```

2. **安裝依賴**：
   ```bash
   # 安裝根目錄依賴（用於資料庫腳本）
   npm install
   
   # 安裝後端依賴
   cd backend
   npm install
   
   # 安裝前端依賴
   cd ../frontend
   npm install
   ```

#### 啟動後端

```bash
cd backend

# 開發模式（自動重啟）
npm run dev

# 或生產模式
npm run build
npm start
```

後端預設運行在 `http://localhost:3000`

#### 啟動前端

```bash
cd frontend

# 開發模式
npm run dev

# 或編譯後預覽
npm run build
npm run preview
```

前端預設運行在 `http://localhost:5173`（Vite 預設端口）

#### 同時啟動前後端

建議開啟兩個終端視窗：
- **終端 1**：運行後端
  ```bash
  cd backend
  npm run dev
  ```
- **終端 2**：運行前端
  ```bash
  cd frontend
  npm run dev
  ```

然後在瀏覽器中訪問 `http://localhost:5173` 即可使用系統。

## 資料庫架構

### Supabase (PostgreSQL)

包含 14 個關聯表：
- `MEMBERSHIP_LEVEL` - 會員等級
- `ADMIN` - 管理員/店員
- `MEMBER` - 會員
- `BOOK` - 書籍基本資訊
- `CATEGORY` - 書籍分類
- `BOOK_CATEGORY` - 書籍與分類關係
- `CONDITION_DISCOUNT` - 書況折扣
- `BOOK_COPIES` - 書籍複本
- `BOOK_LOAN` - 借閱交易
- `LOAN_RECORD` - 借閱記錄詳情
- `FEE_TYPE` - 費用類型
- `ADD_FEE` - 額外費用
- `RESERVATION` - 預約記錄
- `RESERVATION_RECORD` - 預約與書籍關係

### MongoDB

包含 1 個集合：
- `search_history` - 搜尋記錄（NoSQL）

## 文檔

- [設定指南](database/docs/setup_guide.md) - 詳細的資料庫設定步驟
- [Schema 參考](database/docs/schema_reference.md) - 完整的資料庫結構說明
- [資料匯入指南](database/docs/data_import_guide.md) - 如何匯入業務資料
- [**連接指南**](docs/CONNECTION_GUIDE.md) - 如何在應用程式中連接資料庫 ⭐

## 系統要求

- **Supabase**: 免費帳號即可
- **MongoDB Atlas**: 免費 M0 叢集即可
- **Node.js**: 14+ (用於腳本和連接範例)
- **Supabase CLI**: (可選，用於自動化部署)

## 連接資料庫

### 快速開始

1. **安裝依賴**：
   ```bash
   npm install
   ```

2. **設定環境變數**：
   ```bash
   cp .env.example .env
   # 編輯 .env 檔案，填入您的資料庫連接資訊
   ```

3. **測試連接**：
   ```bash
   npm run test:connection
   ```

### 詳細說明

請參考 [連接指南](docs/CONNECTION_GUIDE.md) 了解：
- 如何取得連接資訊
- Node.js / Python 連接範例
- 前端框架（React、Vue）連接範例
- 常見問題解答

## 資料匯入順序

為避免外鍵約束錯誤，建議按以下順序匯入資料：

1. 基礎資料：`MEMBERSHIP_LEVEL`, `CONDITION_DISCOUNT`, `FEE_TYPE`
2. 基礎實體：`ADMIN`, `CATEGORY`, `BOOK`
3. 關係資料：`BOOK_CATEGORY`, `BOOK_COPIES`
4. 會員資料：`MEMBER`
5. 業務資料：`RESERVATION`, `RESERVATION_RECORD`, `BOOK_LOAN`, `LOAN_RECORD`, `ADD_FEE`
6. NoSQL 資料：`search_history`

詳細說明請參考 [資料匯入指南](database/docs/data_import_guide.md)。

## 許可證

MIT License

Copyright (c) 2025 陳竑齊

## 聯絡方式

如有問題，請聯絡團隊成員。

