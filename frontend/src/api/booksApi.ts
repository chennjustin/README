import { api } from '../config/api';
import { BookDetail, BookSummary, TopBook, TopCategory } from '../types';

export const booksApi = {
  search(params: {
    keyword?: string;
    author?: string;
    publisher?: string;
    categoryId?: number;
    memberId?: number | null;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const query = new URLSearchParams();
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.author) query.set('author', params.author);
    if (params.publisher) query.set('publisher', params.publisher);
    if (params.categoryId != null) query.set('categoryId', String(params.categoryId));
    if (params.memberId != null) query.set('memberId', String(params.memberId));
    if (params.minPrice != null) query.set('minPrice', String(params.minPrice));
    if (params.maxPrice != null) query.set('maxPrice', String(params.maxPrice));
    const qs = query.toString();
    return api.get<BookSummary[]>(`/api/books${qs ? `?${qs}` : ''}`);
  },
  getCategories() {
    return api.get<{ category_id: number; name: string }[]>(`/api/books/categories`);
  },
  getDetail(bookId: number, memberId?: number | null) {
    const qs = memberId != null ? `?memberId=${memberId}` : '';
    return api.get<BookDetail>(`/api/books/${bookId}${qs}`);
  },
  getTopBooks(limit = 10) {
    return api.get<TopBook[]>(`/api/stats/top-books?limit=${limit}`);
  },
  getTopCategories(limit = 10) {
    return api.get<TopCategory[]>(`/api/stats/top-categories?limit=${limit}`);
  },
};


