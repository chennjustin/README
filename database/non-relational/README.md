# 非關聯式資料庫目錄

本目錄包含非關聯式資料庫 (MongoDB) 的 schema 和遷移檔案。

## 檔案說明

- `schema/search_history.js` - 搜尋記錄集合的 schema 定義
- `migrations/init_collections.js` - 資料庫初始化腳本，建立集合和索引

## 使用方法

### 1. 使用初始化腳本

```bash
# 設定環境變數
export MONGODB_URI="your_connection_string"
export DATABASE_NAME="book_rental_db"

# 執行初始化腳本
node migrations/init_collections.js
```

### 2. 使用設定腳本

```bash
./scripts/setup_non-relational.sh
```

### 3. 手動執行

使用 MongoDB Compass 或 mongo shell 手動建立集合和索引。

## 依賴

需要安裝 MongoDB Node.js 驅動：

```bash
npm install mongodb
```

## 更多資訊

- [設定指南](../docs/setup_guide.md)
- [Schema 參考](../docs/schema_reference.md)
- [資料匯入指南](../docs/data_import_guide.md)

