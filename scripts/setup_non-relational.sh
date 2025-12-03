#!/bin/bash

# ============================================
# MongoDB 資料庫設定腳本
# ============================================

set -e  # 遇到錯誤立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取腳本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
INIT_SCRIPT="$PROJECT_ROOT/database/non-relational/migrations/init_collections.js"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MongoDB 資料庫設定${NC}"
echo -e "${GREEN}========================================${NC}\n"

# 檢查是否安裝了 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}錯誤: 未檢測到 Node.js${NC}"
    echo -e "請先安裝 Node.js: https://nodejs.org/\n"
    exit 1
fi

# 檢查是否安裝了 MongoDB Node.js driver
if [ ! -d "$PROJECT_ROOT/node_modules" ] || [ ! -d "$PROJECT_ROOT/node_modules/mongodb" ]; then
    echo -e "${YELLOW}檢測到未安裝 MongoDB 依賴${NC}"
    echo -e "正在安裝 mongodb 包...\n"
    cd "$PROJECT_ROOT"
    npm install mongodb --save
    echo -e "${GREEN}✓ 依賴安裝完成${NC}\n"
fi

# 提示使用者输入連接字串
echo -e "${YELLOW}請输入 MongoDB 連接字串 (MongoDB URI):${NC}"
echo -e "格式: mongodb+srv://username:password@cluster.mongodb.net/database"
echo -e "或: mongodb://localhost:27017"
read -r MONGODB_URI

if [ -z "$MONGODB_URI" ]; then
    echo -e "${RED}錯誤: 連接字串不能為空${NC}"
    exit 1
fi

# 提示使用者输入資料庫名称
echo -e "\n${YELLOW}請输入資料庫名称 (預設: book_rental_db):${NC}"
read -r DATABASE_NAME

if [ -z "$DATABASE_NAME" ]; then
    DATABASE_NAME="book_rental_db"
fi

echo -e "\n${GREEN}开始初始化資料庫...${NC}\n"

# 設定環境變數并執行初始化腳本
export MONGODB_URI="$MONGODB_URI"
export DATABASE_NAME="$DATABASE_NAME"

if node "$INIT_SCRIPT"; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}初始化完成！${NC}"
    echo -e "${GREEN}========================================${NC}\n"
else
    echo -e "\n${RED}========================================${NC}"
    echo -e "${RED}初始化失敗！${NC}"
    echo -e "${RED}========================================${NC}\n"
    exit 1
fi

