import { api } from '../config/api';
import {
  AdminLoginResult,
  MemberSearchResult,
  MemberDetail,
  LoanSummary,
  LoanRecordDetail,
  BorrowPreview,
  LoanSearchResult,
  FineCalculationRequest,
  FineCalculationResponse,
  BatchReturnItem,
  BatchReturnResponse,
  BookSearchResult,
  BookListResponse,
} from '../types';

export const adminApi = {
  async login(name: string, phone: string): Promise<AdminLoginResult> {
    return api.post<AdminLoginResult>('/api/admin/login', { name, phone });
  },
  headers(token: string | null): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  createMember(token: string, payload: { name: string; phone: string; email: string; initialBalance: number }) {
    return api.post('/api/admin/members', payload, this.headers(token));
  },
  adjustMemberBalance(token: string, memberId: number, amount: number) {
    return api.patch(`/api/admin/members/${memberId}/balance`, { amount }, this.headers(token));
  },
  updateMemberStatus(token: string, memberId: number, status: string) {
    return api.patch(`/api/admin/members/${memberId}/status`, { status }, this.headers(token));
  },
  createBookWithCopies(
    token: string,
    payload: {
      name: string;
      author: string;
      publisher?: string;
      price: number;
      category_id?: number;
      copies_count: number;
      sequence_name?: string;
    }
  ) {
    return api.post('/api/admin/books', payload, this.headers(token));
  },
  createCategory(token: string, name: string) {
    return api.post('/api/admin/categories', { name }, this.headers(token));
  },
  addCopy(token: string, bookId: number, payload: { purchase_date?: string; purchase_price: number; book_condition?: string }) {
    return api.post(`/api/admin/books/${bookId}/copies`, payload, this.headers(token));
  },
  borrow(token: string, payload: { member_id: number; items: { book_id: number; copies_serial: number }[]; reservation_id?: number }) {
    return api.post('/api/admin/loans', payload, this.headers(token));
  },
  returnItem(
    token: string,
    payload: {
      loan_id: number;
      book_id: number;
      copies_serial: number;
      final_condition?: string;
      lost?: boolean;
      immediateCharge?: boolean;
    }
  ) {
    const { loan_id, book_id, copies_serial, ...body } = payload;
    return api.post(
      `/api/admin/loans/${loan_id}/items/${book_id}/${copies_serial}/return`,
      body,
      this.headers(token)
    );
  },
  renewItem(token: string, loanId: number, bookId: number, copiesSerial: number) {
    return api.post(
      `/api/admin/loans/${loanId}/items/${bookId}/${copiesSerial}/renew`,
      {},
      this.headers(token)
    );
  },
  getReservations(
    token: string,
    status?: string,
    searchParams?: { member_id?: number; book_name?: string }
  ) {
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (searchParams?.member_id !== undefined) {
      queryParams.append('member_id', String(searchParams.member_id));
    }
    if (searchParams?.book_name) {
      queryParams.append('book_name', searchParams.book_name);
    }
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return api.get('/api/admin/reservations' + qs, this.headers(token));
  },
  fulfillReservation(token: string, reservationId: number, items: { book_id: number; copies_serial: number }[]) {
    return api.post(
      `/api/admin/reservations/${reservationId}/fulfill`,
      { items },
      this.headers(token)
    );
  },
  getFeeTypes(token: string) {
    return api.get('/api/admin/fee-types', this.headers(token));
  },
  searchMembers(
    token: string,
    params: { memberId?: string; name?: string; page?: number; limit?: number }
  ): Promise<{ members: MemberSearchResult[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const queryParams = new URLSearchParams();
    if (params.memberId) queryParams.append('memberId', params.memberId);
    if (params.name) queryParams.append('name', params.name);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return api.get<{ members: MemberSearchResult[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      `/api/admin/members/search${qs}`,
      this.headers(token)
    );
  },
  getMemberDetail(token: string, memberId: number): Promise<MemberDetail> {
    return api.get<MemberDetail>(`/api/admin/members/${memberId}`, this.headers(token));
  },
  createTopUp(token: string, memberId: number, amount: number) {
    return api.post(`/api/admin/members/${memberId}/top-up`, { amount }, this.headers(token));
  },
  getMemberLoans(token: string, memberId: number): Promise<LoanSummary[]> {
    return api.get<LoanSummary[]>(`/api/admin/members/${memberId}/loans`, this.headers(token));
  },
  getLoanRecords(token: string, loanId: number): Promise<LoanRecordDetail[]> {
    return api.get<LoanRecordDetail[]>(`/api/admin/loans/${loanId}/records`, this.headers(token));
  },
  getBorrowPreview(
    token: string,
    memberId: number,
    bookId: number,
    copiesSerial: number
  ): Promise<BorrowPreview> {
    const params = new URLSearchParams();
    params.append('member_id', String(memberId));
    params.append('book_id', String(bookId));
    params.append('copies_serial', String(copiesSerial));
    return api.get<BorrowPreview>(
      `/api/admin/borrow/preview?${params.toString()}`,
      this.headers(token)
    );
  },
  unlockCopy(token: string, bookId: number, copiesSerial: number) {
    return api.post(
      '/api/admin/borrow/unlock-copy',
      { book_id: bookId, copies_serial: copiesSerial },
      this.headers(token)
    );
  },
  searchLoans(
    token: string,
    type: 'loan_id' | 'member_id',
    value: number
  ): Promise<{ loans: LoanSearchResult[] }> {
    const params = new URLSearchParams();
    params.append('type', type);
    if (type === 'loan_id') {
      params.append('loan_id', String(value));
    } else {
      params.append('member_id', String(value));
    }
    return api.get<{ loans: LoanSearchResult[] }>(
      `/api/admin/loans/search?${params.toString()}`,
      this.headers(token)
    );
  },
  calculateFines(
    token: string,
    items: FineCalculationRequest[]
  ): Promise<FineCalculationResponse> {
    return api.post<FineCalculationResponse>(
      '/api/admin/loans/calculate-fines',
      { items },
      this.headers(token)
    );
  },
  batchReturn(
    token: string,
    items: BatchReturnItem[]
  ): Promise<BatchReturnResponse> {
    return api.post<BatchReturnResponse>(
      '/api/admin/loans/batch-return',
      { items },
      this.headers(token)
    );
  },
  searchBooks(
    token: string,
    params: { bookId?: string; name?: string; categoryId?: string; status?: string }
  ): Promise<BookSearchResult[]> {
    const queryParams = new URLSearchParams();
    if (params.bookId) queryParams.append('bookId', params.bookId);
    if (params.name) queryParams.append('name', params.name);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.status) queryParams.append('status', params.status);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return api.get<BookSearchResult[]>(`/api/admin/books/search${qs}`, this.headers(token));
  },
  getBooksList(
    token: string,
    page: number = 1,
    limit: number = 100
  ): Promise<BookListResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(page));
    queryParams.append('limit', String(limit));
    return api.get<BookListResponse>(
      `/api/admin/books?${queryParams.toString()}`,
      this.headers(token)
    );
  },
  updateBookCondition(
    token: string,
    bookId: number,
    copiesSerial: number,
    bookCondition: string
  ) {
    return api.patch(
      `/api/admin/books/${bookId}/copies/${copiesSerial}`,
      { book_condition: bookCondition },
      this.headers(token)
    );
  },
  getAvailableCopies(token: string, bookId: number, memberId?: number): Promise<{
    book_id: number;
    book_name: string | null;
    copies: Array<{
      copies_serial: number;
      status: string;
      book_condition: string;
      rental_price: number;
    }>;
  }> {
    const params = new URLSearchParams();
    if (memberId) {
      params.append('member_id', String(memberId));
    }
    const queryString = params.toString();
    return api.get(
      `/api/admin/books/${bookId}/available-copies${queryString ? `?${queryString}` : ''}`,
      this.headers(token)
    );
  },
};


