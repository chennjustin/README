#!/bin/bash

# ============================================
# Supabase 資料庫設定腳本
# ============================================

set -e  # 遇到錯誤立即退出

# 顏色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 取得腳本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
MIGRATIONS_DIR="$PROJECT_ROOT/database/relational/migrations"
SEED_FILE="$PROJECT_ROOT/database/relational/seed.sql"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Supabase 資料庫設定${NC}"
echo -e "${GREEN}========================================${NC}\n"

# 檢查是否安裝了 Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}警告: 未檢測到 Supabase CLI${NC}"
    echo -e "請访问 https://supabase.com/docs/guides/cli 安裝 Supabase CLI"
    echo -e "\n或者您可以使用以下方法手動執行 SQL:"
    echo -e "1. 登入 Supabase Dashboard"
    echo -e "2. 进入 SQL Editor"
    echo -e "3. 複製并執行: ${MIGRATIONS_DIR}/001_initial_schema.sql"
    echo -e "4. (可選) 執行: ${SEED_FILE}\n"
    exit 1
fi

# 檢查是否已登入
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}請先登入 Supabase:${NC}"
    echo -e "執行: supabase login\n"
    exit 1
fi

# 提示用户输入專案引用 ID
echo -e "${YELLOW}請输入您的 Supabase 專案引用 ID (Project Ref):${NC}"
read -r PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}錯誤: 專案引用 ID 不能为空${NC}"
    exit 1
fi

echo -e "\n${GREEN}开始執行遷移...${NC}\n"

# 方法 1: 使用 Supabase CLI 連結專案并推送遷移
if supabase link --project-ref "$PROJECT_REF" 2>/dev/null; then
    echo -e "${GREEN}✓ 已連結到專案${NC}"
    
    # 推送遷移
    if supabase db push; then
        echo -e "${GREEN}✓ 遷移已成功推送${NC}"
    else
        echo -e "${RED}✗ 遷移推送失败${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}无法自动連結專案，請手動執行以下步骤:${NC}"
    echo -e "1. 在 Supabase Dashboard 中開啟 SQL Editor"
    echo -e "2. 複製以下檔案内容并執行:"
    echo -e "   ${MIGRATIONS_DIR}/001_initial_schema.sql"
    echo -e "3. (可選) 執行初始資料:"
    echo -e "   ${SEED_FILE}\n"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}設定完成！${NC}"
echo -e "${GREEN}========================================${NC}\n"

