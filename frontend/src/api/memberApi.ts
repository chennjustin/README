import { api } from '../config/api';
import { LoanItem, MemberLoginResult, MemberProfile, ReservationItem } from '../types';

export function memberHeaders(memberId: number | null): Record<string, string> {
  return memberId ? { 'x-member-id': String(memberId) } : {};
}

export const memberApi = {
  async login(name: string, phone: string): Promise<MemberLoginResult> {
    return api.post<MemberLoginResult>('/api/member/login', { name, phone });
  },
  getProfile(memberId: number) {
    return api.get<MemberProfile>('/api/member/profile', memberHeaders(memberId));
  },
  getReservations(memberId: number) {
    return api.get<ReservationItem[]>('/api/member/reservations', memberHeaders(memberId));
  },
  cancelReservation(memberId: number, reservationId: number) {
    return api.del(`/api/member/reservations/${reservationId}`, memberHeaders(memberId));
  },
  getActiveLoans(memberId: number) {
    return api.get<LoanItem[]>('/api/member/loans/active', memberHeaders(memberId));
  },
  getHistoryLoans(memberId: number) {
    return api.get<LoanItem[]>('/api/member/loans/history', memberHeaders(memberId));
  },
  renewLoan(memberId: number, loanId: number, bookId: number, copiesSerial: number) {
    return api.post(
      `/api/member/loans/${loanId}/items/${bookId}/${copiesSerial}/renew`,
      {},
      memberHeaders(memberId)
    );
  },
};


