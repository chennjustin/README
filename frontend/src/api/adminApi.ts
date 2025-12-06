import { api } from '../config/api';
import {
  AdminLoginResult,
  MemberSearchResult,
  MemberDetail,
  LoanSummary,
  LoanRecordDetail,
  BorrowPreview,
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
  createBook(token: string, payload: { name: string; author: string; publisher?: string; price: number; sequence_name?: string }) {
    return api.post('/api/admin/books', payload, this.headers(token));
  },
  createCategory(token: string, name: string) {
    return api.post('/api/admin/categories', { name }, this.headers(token));
  },
  addCopy(token: string, bookId: number, payload: { purchase_date?: string; purchase_price: number; book_condition?: string }) {
    return api.post(`/api/admin/books/${bookId}/copies`, payload, this.headers(token));
  },
  borrow(token: string, payload: { member_id: number; items: { book_id: number; copies_serial: number }[] }) {
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
  getReservations(token: string, status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
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
  searchMembers(token: string, params: { memberId?: string; name?: string }): Promise<MemberSearchResult[]> {
    const queryParams = new URLSearchParams();
    if (params.memberId) queryParams.append('memberId', params.memberId);
    if (params.name) queryParams.append('name', params.name);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return api.get<MemberSearchResult[]>(`/api/admin/members/search${qs}`, this.headers(token));
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
};


