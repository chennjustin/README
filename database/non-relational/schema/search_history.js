// ============================================
// 獨立租借書店系統 - MongoDB Schema
// 搜尋記錄集合 (Search History Collection)
// ============================================

/**
 * 搜尋記錄文檔結構
 * 
 * @typedef {Object} SearchHistory
 * @property {Number} member_id - 會員ID（對應 PostgreSQL MEMBER.member_id）
 * @property {String} search_query - 搜尋關鍵詞
 * @property {Date} search_date - 搜尋日期時間
 * @property {Number[]} book_ids - 搜尋結果相關的書籍ID列表
 * @property {Object} filters - 搜尋篩選條件
 * @property {String} [filters.category] - 分類篩選
 * @property {String} [filters.author] - 作者篩選
 * @property {String} [filters.publisher] - 出版社篩選
 * @property {Number} [filters.min_price] - 最低價格
 * @property {Number} [filters.max_price] - 最高價格
 */

// 範例文檔結構
const exampleDocument = {
    member_id: 1,
    search_query: "Python 编程",
    search_date: new Date("2025-01-15T10:30:00Z"),
    book_ids: [101, 102, 103],
    filters: {
        category: "计算机科学",
        author: null,
        publisher: "清华大学出版社",
        min_price: 100,
        max_price: 500
    }
};

// 索引定義
const indexes = [
    // 會員ID索引 - 用於快速查詢特定會員的搜尋歷史
    { member_id: 1 },
    
    // 搜尋日期索引 - 用於按時間排序和查詢
    { search_date: -1 },
    
    // 複合索引 - 會員ID + 搜尋日期，用於查詢特定會員的搜尋歷史並按時間排序
    { member_id: 1, search_date: -1 },
    
    // 文字索引 - 用於全文搜尋搜尋關鍵詞
    { search_query: "text" },
    
    // 書籍ID索引 - 用於查詢包含特定書籍的搜尋記錄
    { book_ids: 1 }
];

module.exports = {
    collectionName: 'search_history',
    exampleDocument,
    indexes
};

