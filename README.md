# 獨立租借書店系統

## **專案簡介**

想租書又怕手忙腳亂？ReadMe! 是你的閱讀好幫手！會員可查書況、預約、續借、查罰金、看歷史紀錄，還有搜尋紀錄與熱門排行榜超貼心。店員也能輕鬆管理書籍、處理借還書與儲值，營運分析一次搞定！

## **系統截圖**

![系統截圖](G1系統截圖.png)

## 📋 目錄

- [系統要求](#系統要求)
- [快速開始](#快速開始)
- [詳細安裝步驟](#詳細安裝步驟)
- [環境變數設定](#環境變數設定)
- [資料庫設定](#資料庫設定)
- [啟動應用程式](#啟動應用程式)
- [使用範例](#使用範例)
- [專案結構](#專案結構)
- [常見問題](#常見問題)

## 系統要求

在開始之前，請確保您的系統已安裝以下軟體：

- **Node.js**: 14.0 或更高版本（建議使用 18+）
- **npm**: 隨 Node.js 一起安裝
- **PostgreSQL 資料庫**: 使用 Supabase（免費）或本地 PostgreSQL
- **MongoDB**: 使用 MongoDB Atlas（免費）或本地 MongoDB

### 檢查安裝

```bash
# 檢查 Node.js 版本
node --version

# 檢查 npm 版本
npm --version

# 檢查 Git 版本
git --version
```

## 快速開始

### 1. 複製專案

```bash
git clone <repository-url>
cd README
```

### 2. 安裝依賴套件

本專案包含三個 `package.json` 檔案，分別用於不同用途：

- **根目錄 `package.json`**：用於資料庫腳本和範例程式碼（僅用於測試連接）
- **`backend/package.json`**：後端應用程式依賴（必需）
- **`frontend/package.json`**：前端應用程式依賴（必需）

```bash
# 安裝後端依賴（必需）
cd backend
npm install

# 安裝前端依賴（必需）
cd ../frontend
npm install

# 安裝根目錄依賴（可選，僅用於資料庫連接測試腳本）
cd ..
npm install
```

### 3. 設定環境變數

在專案根目錄複製 `.env.example` 為 `.env` 檔案：

```bash
cp .env.example .env
```

然後編輯 `.env` 檔案，填入實際的資料庫連接資訊。詳細說明請參考 [環境變數設定](#環境變數設定) 章節。

### 4. 設定資料庫

請參考 [詳細安裝步驟](#詳細安裝步驟) 章節完成資料庫初始化。

### 5. 啟動應用程式

開啟兩個終端視窗：

**終端 1 - 啟動後端：**

```bash
cd backend
npm run dev
```

**終端 2 - 啟動前端：**

```bash
cd frontend
npm run dev
```

### 6. 訪問系統

在瀏覽器中打開：`http://localhost:5173`

---

## 詳細安裝步驟

### 步驟 1: 準備資料庫

請先完成資料庫帳號註冊和專案建立：

- **Supabase**: 前往 [Supabase](https://supabase.com/) 註冊並建立新專案
- **MongoDB Atlas**（可選）: 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 註冊並建立免費 M0 叢集

然後參考 [環境變數設定](#環境變數設定) 章節取得連接字串並填入 `.env` 檔案。

### 步驟 2: 初始化資料庫 Schema

#### PostgreSQL/Supabase

1. 登入 Supabase Dashboard
2. 進入專案的 **SQL Editor**
3. 依序執行以下遷移檔案（複製檔案內容到 SQL Editor 並執行）：
   - `database/relational/migrations/001_initial_schema.sql`
   - `database/relational/migrations/002_alter_book_publisher.sql`
   - `database/relational/migrations/003_add_top_up_table.sql`
   - `database/relational/migrations/004_fix_rental_price.sql`
   - `database/relational/migrations/005_fix_loan_rental_fee.sql`
   - `database/relational/migrations/006_add_reserved_status.sql`
   - `database/relational/migrations/007_fix_member_sequence.sql`

> 如果使用 `.backup` 檔案還原資料（步驟 3），通常已包含 Schema，可跳過此步驟。但建議先執行migration 確保 Schema 正確，再還原資料。

#### MongoDB（可選）

```bash
# 確保已設定 MONGODB_URI 環境變數
node database/non-relational/migrations/init_collections.js
```

### 步驟 3: 匯入資料

**本專案根目錄已包含 `.backup` 檔案。**

#### 使用 .backup 檔案還原資料

`.backup` 檔案是 PostgreSQL 的備份檔案，包含完整的資料庫結構和資料。還原方式如下：

**方法 1: 使用 Supabase Dashboard（推薦）**

1. 登入 Supabase Dashboard
2. 進入專案的 **SQL Editor**
3. 在 SQL Editor 中，點擊右上角的 **...** 選單
4. 選擇 **Restore from backup** 或 **Import SQL**
5. 上傳 `.backup` 檔案（如果 Supabase 支援直接上傳）
6. 或使用以下 SQL 命令（如果備份是 SQL 格式）：
   ```sql
   -- 在 SQL Editor 中貼上 .backup 檔案的內容並執行
   ```

**方法 2: 使用命令列**

```bash
# 確保已設定 DATABASE_URL 環境變數
# 或在命令中直接使用連接字串

# 方法 A: 使用 pg_restore（適用於 .backup 格式）
pg_restore -d "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --clean --if-exists .backup

# 方法 B: 使用 psql（適用於 SQL 格式的備份）
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" < .backup

# 方法 C: 如果已設定環境變數
pg_restore -d $DATABASE_URL --clean --if-exists .backup
# 或
psql $DATABASE_URL < .backup
```

> **重要提示**：
>
> - 還原備份會覆蓋現有資料，請在還原前確認
> - 如果 `.backup` 檔案是 SQL 格式，使用 `psql`；如果是二進位格式，使用 `pg_restore`
> - 如果還原失敗，請確認資料庫 Schema 已初始化（步驟 2）

#### 其他匯入方式

如果不想使用 `.backup` 檔案，也可以：

**匯入初始資料：**

```bash
# 在 Supabase SQL Editor 中執行 database/relational/seed.sql
# 或使用命令列
psql $DATABASE_URL -f database/relational/seed.sql
```

**生成測試資料：**

```bash
# 在 Supabase SQL Editor 中執行 database/relational/generate_mock_data.sql
# 或使用命令列
psql $DATABASE_URL -f database/relational/generate_mock_data.sql
```

> `generate_mock_data.sql` 會生成約 12,000 筆借閱記錄，執行時間可能較長。

## 環境變數設定

在專案根目錄建立 `.env` 檔案，包含以下變數：

```env
# DATABASE_URL 的 key
# 從 Supabase Dashboard → Settings → Database → Connection string (URI) 取得
# 將 [YOUR-PASSWORD] 替換為您的資料庫密碼
# 將 [PROJECT-REF] 替換為您的 Supabase 專案參考 ID
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

```env
# MongoDB 連接字串（搜尋歷史功能需要）
# 從 MongoDB Atlas Dashboard → Connect → Connect your application 取得
# 將 XXXX 替換為您的 MongoDB 使用者名稱和密碼
MONGODB_URI=mongodb+srv://XXXX@read-me.XXXX.mongodb.net/?appName=read-me&retryWrites=true&w=majority

# MongoDB 資料庫名稱
MONGODB_DATABASE=read-me
```

### 取得連接字串

#### Supabase

1. 登入 Supabase Dashboard
2. 選擇您的專案
3. 進入 **Settings** → **Database**
4. 在 **Connection string** 區塊選擇 **URI**
5. 複製連接字串（格式：`postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`）
6. 將 `[YOUR-PASSWORD]` 替換為您的資料庫密碼（在建立專案時設定的密碼）
7. 將 `[PROJECT-REF]` 替換為您的 Supabase 專案 ID（連接字串中已包含，通常是專案名稱的一部分）

#### MongoDB Atlas

1. 登入 MongoDB Atlas Dashboard
2. 選擇您的叢集
3. 點擊 **Connect** → **Connect your application**
4. 複製連接字串（格式：`mongodb+srv://username:password@cluster.mongodb.net/`）
5. 將連接字串中的使用者名稱和密碼替換為實際值
6. 根據您的 MongoDB 設定，連接字串可能包含額外參數（如 `appName`、`retryWrites` 等）
7. 確認 `MONGODB_DATABASE` 設定為 `read-me`（或您使用的資料庫名稱）

## 資料庫設定

### PostgreSQL Schema

系統使用以下主要資料表：

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
- `ADD_FEE` - 額外費用
- `RESERVATION` - 預約記錄
- `RESERVATION_RECORD` - 預約與書籍關係
- `TOP_UP` - 儲值記錄

詳細 Schema 說明請參考：`database/docs/schema_reference.md`

### MongoDB Collections

- `search_history` - 搜尋記錄（用於分析搜尋趨勢）

## 啟動應用程式

建議使用兩個終端視窗同時啟動前後端：

**終端 1 - 啟動後端：**

```bash
cd backend
npm run dev
```

後端將運行在：`http://localhost:3000`

**終端 2 - 啟動前端：**

```bash
cd frontend
npm run dev
```

前端將運行在：`http://localhost:5173`

啟動完成後，在瀏覽器中訪問 `http://localhost:5173` 即可使用系統。

## 使用範例

### 1. 登入系統

#### 會員登入

1. 訪問 `http://localhost:5173`
2. 選擇「會員登入」
3. 輸入會員 ID（例如：`1`）
4. 輸入密碼

#### 管理員登入

1. 訪問 `http://localhost:5173`
2. 選擇「管理員登入」
3. 輸入管理員 ID（例如：`1`）
4. 輸入密碼

### 2. 會員功能

- **搜尋書籍**：在搜尋頁面輸入書名、作者或關鍵字
- **查看書籍詳情**：點擊書籍查看詳細資訊、可借複本和租金
- **加入預約購物車**：將想借的書籍加入購物車
- **送出預約**：在預約購物車頁面一次送出多本書的預約
- **查看我的預約**：查看所有預約記錄，可取消預約
- **查看借閱中**：查看目前借閱的書籍，可續借
- **查看借閱歷史**：查看過去的借閱記錄
- **查看熱門排行榜**：查看當月最受歡迎的書籍

### 3. 管理員功能

- **會員管理**：新增、搜尋、查看會員資料，為會員儲值
- **書籍管理**：新增、編輯書籍，管理書籍分類
- **複本管理**：查看、更新書籍複本狀態和書況
- **櫃檯借書**：為會員辦理借書手續
- **櫃檯還書**：單筆或批次還書，計算額外費用
- **預約管理**：查看所有預約記錄
- **統計報表**：查看月營收、借書狀況、熱門書籍等統計

## 專案結構

```
EADME/
├── backend/                 # 後端應用 (Express + TypeScript)
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── middleware/     # 中間件
│   │   ├── db.ts          # PostgreSQL 連接
│   │   ├── mongodb.ts     # MongoDB 連接
│   │   └── server.ts      # 伺服器進入點
│   ├── dist/              # 編譯後的程式碼
│   └── package.json
├── frontend/               # 前端應用 (React + TypeScript)
│   ├── src/
│   │   ├── pages/         # 頁面元件
│   │   ├── components/   # 共用元件
│   │   ├── api/          # API 調用
│   │   ├── context/     # React Context
│   │   └── config/      # 配置檔案
│   └── package.json
├── database/              # 資料庫相關檔案
│   ├── relational/       # PostgreSQL 相關
│   │   ├── migrations/  # 資料庫遷移檔案
│   │   └── seed.sql     # 初始資料
│   └── non-relational/  # MongoDB 相關
│       └── migrations/  # 遷移腳本
├── docs/                 # 文檔
├── examples/             # 範例程式碼
├── .env                  # 環境變數（自己建立）
└── .backup               # 資料庫備份檔案
```

## 常見問題

### Q1: 後端啟動失敗，顯示「缺少 DATABASE_URL」

**解決方法：**

1. 確認已在專案根目錄創建 `.env` 檔案
2. 確認 `.env` 檔案中包含 `DATABASE_URL`
3. 確認連接字串格式正確

### Q2: 前端無法連接到後端 API

**解決方法：**

1. 確認後端已啟動並運行在 `http://localhost:3000`
2. 檢查 `.env` 檔案中的 `VITE_API_BASE_URL`（如果已設定）
3. 檢查瀏覽器控制台是否有 CORS 錯誤

### Q3: MongoDB 連接失敗

**解決方法：**

1. 確認 MongoDB Atlas 的 Network Access 已允許您的 IP
2. 確認連接字串中的密碼已正確替換
3. 如果不需要搜尋歷史功能，可以跳過 MongoDB 設定

### Q4: 資料庫遷移失敗

**解決方法：**

1. 確認已按順序執行所有遷移檔案
2. 檢查是否有外鍵約束錯誤
3. 確認資料庫使用者有足夠權限

### Q5: 前端頁面空白或載入錯誤

**解決方法：**

1. 檢查瀏覽器控制台的錯誤訊息
2. 確認後端 API 正常運行
3. 清除瀏覽器快取並重新載入

### Q6: 如何重置資料庫？

**解決方法：**

1. 在 Supabase Dashboard 的 SQL Editor 中執行：
   ```sql
   -- 刪除所有資料表（注意：這會刪除所有資料）
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```
2. 重新執行所有遷移檔案

### Q7: 如何使用 .backup 檔案還原資料？

**解決方法：**

請參考 [步驟 3: 匯入資料](#步驟-3-匯入資料) 章節的詳細說明。本專案根目錄已包含 `.backup` 檔案，建議使用該檔案還原資料。

## 技術棧

- **後端**: Node.js + Express + TypeScript
- **前端**: React + TypeScript + Vite
- **資料庫**: PostgreSQL (Supabase) + MongoDB (Atlas)

## 文檔

- [資料庫設定指南](database/docs/setup_guide.md)
- [Schema 參考](database/docs/schema_reference.md)
- [資料匯入指南](database/docs/data_import_guide.md)
- [連接指南](docs/CONNECTION_GUIDE.md)

## 許可證

MIT License

Copyright (c) 2025 陳竑齊、曾文儀、莊孟芸

## 聯絡方式

如有問題，請聯絡團隊成員。
