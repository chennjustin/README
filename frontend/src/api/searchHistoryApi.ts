import { api } from '../config/api';

export interface SearchHistoryItem {
  _id: string;
  member_id: number;
  search_query: string;
  search_date: string;
  book_ids: number[];
  filters: {
    category?: number | null;
    author?: string | null;
    publisher?: string | null;
    min_price?: number | null;
    max_price?: number | null;
  };
}

export interface SearchAnalytics {
  period_days: number;
  total_searches: number;
  active_members: number;
  top_keywords: Array<{
    keyword: string;
    count: number;
    last_searched: string;
  }>;
  top_books: Array<{
    book_id: number;
    count: number;
    last_searched: string;
  }>;
  search_trends: Array<{
    date: string;
    count: number;
  }>;
  top_filters: Array<{
    _id: {
      category?: string | null;
      author?: string | null;
      publisher?: string | null;
    };
    count: number;
  }>;
  top_categories: Array<{
    category_id: number;
    count: number;
  }>;
  price_ranges: Array<{
    price_range: string;
    count: number;
    min_price: number;
    max_price: number;
  }>;
}

export const searchHistoryApi = {
  // 獲取會員搜尋歷史
  getMemberHistory(memberId: number, limit: number = 20): Promise<SearchHistoryItem[]> {
    return api.get<SearchHistoryItem[]>(`/api/search-history/member/history?memberId=${memberId}&limit=${limit}`);
  },

  // 管理員：獲取搜尋趨勢分析
  getAnalytics(days: number = 30, limit: number = 20): Promise<SearchAnalytics> {
    return api.get<SearchAnalytics>(`/api/search-history/admin/analytics?days=${days}&limit=${limit}`);
  },
};

