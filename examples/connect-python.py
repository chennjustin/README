# ============================================
# Python 資料庫連接範例
# ============================================
# 此檔案示範如何在 Python 中連接 Supabase 和 MongoDB

import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient

# 載入環境變數
load_dotenv()

# ============================================
# Supabase (PostgreSQL) 連接
# ============================================

def get_postgres_connection():
    """建立 PostgreSQL 連接"""
    connection_string = os.getenv('DATABASE_URL') or os.getenv('DATABASE_POOL_URL')
    
    if not connection_string:
        raise ValueError('缺少 DATABASE_URL 或 DATABASE_POOL_URL 環境變數')
    
    conn = psycopg2.connect(
        connection_string,
        sslmode='require'
    )
    return conn

def test_postgres_connection():
    """測試 PostgreSQL 連接"""
    try:
        print('🔌 正在測試 PostgreSQL 連接...\n')
        
        conn = get_postgres_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # 測試查詢
        cursor.execute('SELECT * FROM MEMBERSHIP_LEVEL LIMIT 5')
        results = cursor.fetchall()
        
        print('✅ PostgreSQL 連接成功！')
        print(f'📊 找到 {len(results)} 筆會員等級資料：\n')
        
        for level in results:
            print(f"  - {level['level_name']} (ID: {level['level_id']})")
            print(f"    折扣率: {level['discount_rate']}, 可借書數: {level['max_book_allowed']}")
        
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f'❌ PostgreSQL 連接失敗：{e}')
        return False

# ============================================
# MongoDB 連接
# ============================================

def get_mongodb_client():
    """建立 MongoDB 客戶端"""
    mongo_uri = os.getenv('MONGODB_URI')
    
    if not mongo_uri:
        raise ValueError('缺少 MONGODB_URI 環境變數')
    
    client = MongoClient(mongo_uri)
    return client

def test_mongodb_connection():
    """測試 MongoDB 連接"""
    try:
        print('🔌 正在測試 MongoDB 連接...\n')
        
        client = get_mongodb_client()
        db_name = os.getenv('MONGODB_DATABASE', 'book_rental_db')
        db = client[db_name]
        
        # 檢查集合
        collections = db.list_collection_names()
        
        print('✅ MongoDB 連接成功！')
        print(f'📊 資料庫: {db_name}')
        print(f'   集合數量: {len(collections)}')
        
        if 'search_history' in collections:
            collection = db['search_history']
            count = collection.count_documents({})
            print(f'   search_history 文件數量: {count}')
        
        client.close()
        return True
    except Exception as e:
        print(f'❌ MongoDB 連接失敗：{e}')
        return False

# ============================================
# 範例查詢函數
# ============================================

def get_all_books():
    """取得所有書籍"""
    conn = get_postgres_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('SELECT * FROM BOOK')
    books = cursor.fetchall()
    cursor.close()
    conn.close()
    return books

def get_member(member_id):
    """取得會員資訊"""
    conn = get_postgres_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT 
            m.*,
            ml.level_name,
            ml.discount_rate,
            ml.max_book_allowed
        FROM MEMBER m
        JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
        WHERE m.member_id = %s
    """, (member_id,))
    member = cursor.fetchone()
    cursor.close()
    conn.close()
    return member

# ============================================
# 執行測試
# ============================================

if __name__ == '__main__':
    print('=' * 50)
    print('資料庫連接測試')
    print('=' * 50 + '\n')
    
    # 測試 PostgreSQL
    postgres_ok = test_postgres_connection()
    print()
    
    # 測試 MongoDB
    mongodb_ok = test_mongodb_connection()
    print()
    
    if postgres_ok and mongodb_ok:
        print('✅ 所有連接測試完成！')
    else:
        print('❌ 部分連接測試失敗，請檢查配置。')

