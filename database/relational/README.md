# 關聯式資料庫目錄

本目錄包含關聯式資料庫 (PostgreSQL/Supabase) 的 schema 和遷移檔案。

## 檔案說明

- `migrations/001_initial_schema.sql` - 初始資料庫 schema，包含所有 14 個關聯表的定義
- `seed.sql` - 初始資料檔案，包含會員等級、書況折扣和費用類型的基礎資料

## 使用方法

### 1. 使用 Supabase Dashboard

1. 登入 Supabase Dashboard
2. 進入 SQL Editor
3. 依序執行：
   - `migrations/001_initial_schema.sql`
   - `seed.sql`（可選）

### 2. 使用 Supabase CLI

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 登入
supabase login

# 連結專案
supabase link --project-ref your-project-ref

# 推送遷移
supabase db push
```

### 3. 使用設定腳本

```bash
./scripts/setup_relational.sh
```

## 更多資訊

- [設定指南](../docs/setup_guide.md)
- [Schema 參考](../docs/schema_reference.md)
- [資料匯入指南](../docs/data_import_guide.md)

