# 搜尋趨勢分析計算說明

## 概述
搜尋趨勢分析頁面顯示的數據是從 MongoDB 的 `search_history` 集合中統計計算得出的。每次會員進行書籍搜尋時，系統會自動將搜尋記錄保存到 MongoDB。

## 數據來源
- **集合名稱**: `search_history`
- **記錄時機**: 當會員在「書籍搜尋」頁面執行搜尋時（需登入會員）
- **記錄內容**:
  - `member_id`: 會員 ID
  - `search_query`: 搜尋關鍵詞（書名關鍵字）
  - `search_date`: 搜尋日期時間
  - `book_ids`: 搜尋結果的書籍 ID 列表
  - `filters`: 篩選條件（分類、作者、出版社、價格範圍等）

## 統計指標說明

### 1. 總搜尋次數 (total_searches)
**計算方式**:
```javascript
countDocuments({
  search_date: { $gte: startDate }  // 在指定時間範圍內的所有搜尋記錄
})
```
- 統計在選定時間範圍內（7/30/60/90 天）的所有搜尋記錄總數
- 包含所有會員的搜尋行為

### 2. 活躍會員數 (active_members)
**計算方式**:
```javascript
distinct('member_id', {
  search_date: { $gte: startDate }
})
```
- 統計在選定時間範圍內有進行搜尋的**不重複會員數量**
- 例如：如果會員 A 搜尋了 10 次，會員 B 搜尋了 5 次，活躍會員數為 2

### 3. 最熱門的搜尋關鍵詞 (top_keywords)
**計算方式**:
```javascript
aggregate([
  { $match: { search_date: { $gte: startDate }, search_query: { $exists: true, $ne: '' } } },
  { $group: { _id: '$search_query', count: { $sum: 1 }, last_searched: { $max: '$search_date' } } },
  { $sort: { count: -1 } },
  { $limit: 20 }
])
```
- 將相同關鍵詞的搜尋記錄分組
- 統計每個關鍵詞的搜尋次數
- 記錄最後一次搜尋時間
- 按搜尋次數降序排列，取前 20 名

**範例**:
- 如果「Python」被搜尋了 50 次，「JavaScript」被搜尋了 30 次
- 則「Python」會排在「JavaScript」前面

### 4. 最常被搜尋的書籍 (top_books)
**計算方式**:
```javascript
aggregate([
  { $match: { search_date: { $gte: startDate }, book_ids: { $exists: true, $ne: [] } } },
  { $unwind: '$book_ids' },  // 將 book_ids 陣列展開
  { $group: { _id: '$book_ids', count: { $sum: 1 }, last_searched: { $max: '$search_date' } } },
  { $sort: { count: -1 } },
  { $limit: 20 }
])
```
- 將每筆搜尋記錄中的 `book_ids` 陣列展開（`$unwind`）
- 統計每個 `book_id` 出現在搜尋結果中的次數
- 記錄最後一次出現在搜尋結果的時間
- 按出現次數降序排列，取前 20 名

**範例**:
- 如果書籍 ID 101 出現在 30 次搜尋結果中，書籍 ID 102 出現在 20 次搜尋結果中
- 則書籍 101 會排在書籍 102 前面

### 5. 搜尋趨勢（按日期）(search_trends)
**計算方式**:
```javascript
aggregate([
  { $match: { search_date: { $gte: startDate } } },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$search_date' } },
      count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
])
```
- 將搜尋記錄按日期分組（格式：YYYY-MM-DD）
- 統計每天的搜尋次數
- 按日期升序排列，顯示時間範圍內每天的搜尋量變化

**範例**:
```
2025-12-01: 15 次
2025-12-02: 23 次
2025-12-03: 18 次
...
```

### 6. 最常用的篩選條件 (top_filters)
**計算方式**:
```javascript
aggregate([
  { $match: { search_date: { $gte: startDate }, filters: { $exists: true } } },
  {
    $project: {
      category: '$filters.category',
      author: '$filters.author',
      publisher: '$filters.publisher'
    }
  },
  {
    $group: {
      _id: { category: '$category', author: '$author', publisher: '$publisher' },
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } },
  { $limit: 20 }
])
```
- 統計各種篩選條件的組合使用頻率
- 按使用次數降序排列，取前 20 名

**範例**:
- 如果「分類：程式設計 + 作者：無 + 出版社：無」被使用了 25 次
- 則這個組合會顯示在列表中

## 時間範圍選擇
- **7 天**: 分析最近一週的搜尋行為
- **30 天**: 分析最近一個月的搜尋行為（預設）
- **60 天**: 分析最近兩個月的搜尋行為
- **90 天**: 分析最近三個月的搜尋行為

選擇不同的時間範圍會影響所有統計指標的計算基礎。

## 注意事項
1. **僅記錄登入會員的搜尋**: 訪客（未登入）的搜尋不會被記錄
2. **即時性**: 搜尋記錄會立即保存，但統計數據是即時計算的
3. **性能考量**: 如果搜尋記錄量很大，統計查詢可能需要一些時間
4. **空值處理**: 空的搜尋關鍵詞或空的書籍 ID 列表會被過濾掉

