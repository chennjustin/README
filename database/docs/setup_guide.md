# 資料庫設定指南

本指南將幫助您設定「獨立租借書店」系統的資料庫，包括 Supabase (PostgreSQL) 和 MongoDB。

## 目錄

- [Supabase 設定](#supabase-設定)
- [MongoDB 設定](#mongodb-設定)
- [驗證安裝](#驗證安裝)

---

## Supabase 設定

### 1. 建立 Supabase 帳號和專案

1. 訪問 [Supabase](https://supabase.com/)
2. 點擊 "Start your project" 或 "Sign up" 註冊帳號
3. 登入後，點擊 "New Project" 建立新專案
4. 填寫專案資訊：
   - **Name**: 輸入專案名稱（如：book-rental-system）
   - **Database Password**: 設定資料庫密碼（請妥善保存）
   - **Region**: 選擇離您最近的區域
   - **Pricing Plan**: 選擇免費計畫（Free tier）即可
5. 點擊 "Create new project"，等待專案建立完成（約 2 分鐘）

### 2. 取得專案連接資訊

1. 在專案 Dashboard 中，點擊左側選單的 **Settings** → **API**
2. 記錄以下資訊：
   - **Project URL**: 您的專案 URL
   - **anon public key**: 公開 API 密鑰
   - **service_role key**: 服務角色密鑰（請保密）

3. 點擊左側選單的 **Settings** → **Database**
4. 記錄以下資訊：
   - **Connection string**: 資料庫連接字串
   - **Connection pooling**: 連接池字串（可選）

### 3. 執行資料庫 Schema

您有兩種方式執行 schema：

#### 方法 1: 使用 Supabase Dashboard（推薦新手）

1. 在 Supabase Dashboard 中，點擊左側選單的 **SQL Editor**
2. 點擊 "New query"
3. 開啟檔案 `database/relational/migrations/001_initial_schema.sql`
4. 複製全部內容並貼上到 SQL Editor
5. 點擊 "Run" 或按 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac) 執行
6. 確認看到 "Success. No rows returned" 訊息

#### 方法 2: 使用 Supabase CLI（推薦開發者）

1. 安裝 Supabase CLI：
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # 或使用 npm
   npm install -g supabase
   ```

2. 登入 Supabase：
   ```bash
   supabase login
   ```

3. 執行設定腳本：
   ```bash
   ./scripts/setup_relational.sh
   ```

4. 按照提示輸入專案引用 ID（Project Ref）

### 4. 匯入初始資料（可選）

1. 在 SQL Editor 中開啟新查詢
2. 開啟檔案 `database/relational/seed.sql`
3. 複製內容並執行

---

## MongoDB 設定

### 1. 建立 MongoDB Atlas 帳號和叢集

1. 訪問 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 點擊 "Try Free" 註冊帳號
3. 建立組織（Organization）和專案（Project）
4. 建立免費叢集（Free Cluster）：
   - **Cloud Provider**: 選擇雲端服務提供商（AWS, Google Cloud, Azure）
   - **Region**: 選擇離您最近的區域
   - **Cluster Tier**: 選擇 M0 (Free) 免費層
   - **Cluster Name**: 輸入叢集名稱
5. 點擊 "Create Cluster"，等待叢集建立完成（約 3-5 分鐘）

### 2. 配置資料庫訪問

1. **設定資料庫用戶**：
   - 在 Atlas Dashboard 中，點擊左側選單的 **Database Access**
   - 點擊 "Add New Database User"
   - 選擇 "Password" 認證方式
   - 輸入用戶名和密碼（請妥善保存）
   - 設定用戶权限為 "Atlas admin" 或 "Read and write to any database"
   - 點擊 "Add User"

2. **配置網路訪問**：
   - 點擊左側選單的 **Network Access**
   - 點擊 "Add IP Address"
   - 選擇 "Allow Access from Anywhere"（开发环境）或新增特定 IP（生產环境）
   - 點擊 "Confirm"

### 3. 取得連接字串

1. 在 Atlas Dashboard 中，點擊 **Clusters** → 您的叢集名稱
2. 點擊 "Connect" 按钮
3. 選擇 "Connect your application"
4. 選擇 Driver: **Node.js**，Version: **5.5 or later**
5. 複製連接字串，格式如下：
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. 將 `<username>` 和 `<password>` 替換為您建立的資料庫用戶憑證
7. 在連接字串末尾新增資料庫名稱：
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/book_rental_db?retryWrites=true&w=majority
   ```

### 4. 初始化資料庫

#### 方法 1: 使用設定腳本（推薦）

1. 確保已安裝 Node.js（版本 14 或更高）
2. 執行設定腳本：
   ```bash
   ./scripts/setup_non-relational.sh
   ```
3. 按照提示輸入 MongoDB 連接字串和資料庫名稱

#### 方法 2: 手動執行

1. 安裝 MongoDB Node.js 驅動：
   ```bash
   npm install mongodb
   ```

2. 設定環境變數：
   ```bash
   export MONGODB_URI="your_connection_string"
   export DATABASE_NAME="book_rental_db"
   ```

3. 執行初始化腳本：
   ```bash
   node database/non-relational/migrations/init_collections.js
   ```

---

## 驗證安裝

### 驗證 Supabase

1. 在 Supabase Dashboard 中，開啟 **Table Editor**
2. 確認可以看到以下表：
   - `MEMBERSHIP_LEVEL`
   - `ADMIN`
   - `MEMBER`
   - `BOOK`
   - `CATEGORY`
   - `BOOK_CATEGORY`
   - `CONDITION_DISCOUNT`
   - `BOOK_COPIES`
   - `BOOK_LOAN`
   - `LOAN_RECORD`
   - `FEE_TYPE`
   - `ADD_FEE`
   - `RESERVATION`
   - `RESERVATION_RECORD`

3. 檢查 `MEMBERSHIP_LEVEL` 表是否有 3 條記錄（銅、銀、金）
4. 檢查 `CONDITION_DISCOUNT` 表是否有 3 條記錄（Good, Fair, Poor）
5. 檢查 `FEE_TYPE` 表是否有 6 條記錄（renew, overdue, damage_good_to_fair, damage_good_to_poor, damage_fair_to_poor, lost）

### 驗證 MongoDB

1. 在 MongoDB Atlas Dashboard 中，點擊 **Collections**
2. 確認可以看到 `search_history` 集合
3. 點擊集合名稱，查看索引：
   - `member_id_1`
   - `search_date_-1`
   - `member_id_1_search_date_-1`
   - `search_query_text`
   - `book_ids_1`

---

## 連接字串配置

### Supabase 連接字串

在您的應用程式中，使用以下格式的連接字串：

```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

或使用 Supabase 客户端库的連接參數：
- **URL**: `https://[PROJECT-REF].supabase.co`
- **Key**: `anon public key` 或 `service_role key`

### MongoDB 連接字串

使用您在 Atlas 中取得的連接字串：

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/book_rental_db?retryWrites=true&w=majority
```

---

## 常見問題

### Supabase

**Q: 執行 SQL 時出現权限錯誤**
A: 確保您使用的是專案所有者帳號，或具有資料庫管理員权限。

**Q: 如何重置資料庫？**
A: 在 Supabase Dashboard 中，進入 Settings → Database → Reset Database（注意：这將刪除所有資料）

### MongoDB

**Q: 連接失敗，提示認證錯誤**
A: 檢查用戶名和密碼是否正確，確保在連接字串中正確替換了佔位符。

**Q: 連接失敗，提示網路錯誤**
A: 檢查 Network Access 設定，確保您的 IP 地址已被允许訪問。

**Q: 如何查看資料庫中的資料？**
A: 在 Atlas Dashboard 中，點擊 Collections，選擇資料庫和集合即可查看。

---

## 下一步

資料庫設定完成後，您可以：

1. 參考 [資料汇入指南](./data_import_guide.md) 匯入業務資料
2. 查看 [Schema 參考文檔](./schema_reference.md) 了解資料庫結構
3. 開始开发應用程式，連接到資料庫

---

## 技術支援

如遇到問題，請：
1. 查看 Supabase 文檔：https://supabase.com/docs
2. 查看 MongoDB Atlas 文檔：https://docs.atlas.mongodb.com/
3. 聯絡團隊成員取得幫助

