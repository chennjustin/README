export interface MemberProfile {
  member_id: number;
  name: string;
  email: string;
  phone: string;
  join_date: string;
  balance: number;
  status: string;
  level_id: number;
  discount_rate: number;
  max_book_allowed: number;
  hold_days: number;
  active_loans: number;
}

export interface BookCategory {
  category_id: number;
  name: string;
}

export interface BookSummary {
  book_id: number;
  name: string;
  author: string;
  publisher?: string;
  price: number;
  categories: BookCategory[];
  available_count: number;
  discount_rate?: number;
  estimated_min_rental_price?: number;
}

export interface BookConditionInfo {
  book_condition: string;
  rental_price: number;
  available_count: number;
  discount_rate: number;
  discounted_rental_price: number;
}

export interface BookDetail extends BookSummary {
  copies: BookConditionInfo[];
}

export interface ReservationItem {
  reservation_id: number;
  member_id: number;
  reserve_date: string;
  pickup_date?: string;
  status: string;
  books: {
    book_id: number;
    name: string;
    author: string;
    publisher?: string;
  }[];
}

export interface LoanItem {
  loan_id: number;
  final_price: number;
  book_id: number;
  copies_serial: number;
  date_out: string;
  due_date: string;
  return_date?: string;
  rental_fee: number;
  renew_cnt: number;
  book_name: string;
  author: string;
  publisher?: string;
  book_condition: string;
  add_fee_total: number;
}

export interface MemberHistoryLoanRecord {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  book_name: string;
  author: string;
  publisher?: string;
  date_out: string;
  due_date: string;
  return_date: string;
  rental_fee: number;
  renew_cnt: number;
  book_condition: string;
  add_fee_total: number;
}

export interface MemberHistoryLoan {
  loan_id: number;
  final_price: number;
  loan_date: string;
  return_date: string;
  records: MemberHistoryLoanRecord[];
}

export interface TopBook {
  book_id: number;
  name: string;
  author: string;
  publisher?: string;
  borrow_count: number;
}

export interface TopCategory {
  category_id: number;
  name: string;
  borrow_count: number;
}

export interface StatsByMembershipLevel {
  level_id: number;
  level_name: string;
  borrow_count: number;
  member_count: number;
}

export interface CategoryByLevel {
  category_id: number;
  category_name: string;
  level_id: number;
  level_name: string;
  borrow_count: number;
}

export interface StatsSummary {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_borrows: number;
    total_revenue: number;
    active_members: number;
    unique_books: number;
  };
}

export interface AdminLoginResult {
  token: string;
  admin: {
    admin_id: number;
    name: string;
    phone: string;
    role: string;
  };
}

export interface MemberLoginResult {
  member_id: number;
  name: string;
  phone: string;
}

export interface MemberSearchResult {
  member_id: number;
  name: string;
  phone: string;
  email: string;
  status: string;
  balance: number;
  join_date: string;
}

export interface TopUpRecord {
  top_up_id: number;
  amount: number;
  top_up_date: string;
  admin_name: string;
}

export interface MemberDetail {
  member_id: number;
  name: string;
  phone: string;
  email: string;
  join_date: string;
  balance: number;
  status: string;
  level_id: number;
  level_name: string;
  discount_rate: number;
  max_book_allowed: number;
  hold_days: number;
  min_balance_required: number;
  top_ups: TopUpRecord[];
}

export interface LoanSummary {
  loan_id: number;
  final_price: number;
  member_id: number;
  admin_name: string;
  loan_date: string;
  item_count: number;
  active_count: number;
}

export interface AddFee {
  type: string;
  amount: number;
  date: string;
}

export interface LoanRecordDetail {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  date_out: string;
  due_date: string;
  return_date?: string;
  rental_fee: number;
  renew_cnt: number;
  book_name: string;
  author: string;
  publisher?: string;
  book_condition: string;
  add_fees: AddFee[];
}

export interface BorrowPreview {
  book_id: number;
  copies_serial: number;
  book_name: string;
  status: string;
  rental_fee: number;
}

// Return search related types
export interface LoanSearchRecord {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  book_name: string;
  original_condition: string;
  date_out: string;
  due_date: string;
  return_date: string | null;
  rental_fee: number;
  purchase_price: number;
}

export interface LoanSearchResult {
  loan_id: number;
  member_id: number;
  member_name: string;
  loan_date: string;
  max_due_date: string;
  records: LoanSearchRecord[];
}

export interface LoanSearchResponse {
  loans: LoanSearchRecord[];
}

// Fine calculation related types
export interface FineBreakdown {
  overdue_fee: number;
  damage_fee: number;
  lost_fee: number;
  total: number;
}

export interface FineCalculationItem {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  fine_breakdown: FineBreakdown;
  overdue_days: number;
}

export interface FineCalculationRequest {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  final_condition?: string;
  lost: boolean;
  due_date: string;
  purchase_price: number;
  original_condition: string;
}

export interface FineCalculationResponse {
  items: FineCalculationItem[];
}

// Batch return related types
export interface BatchReturnItem {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  final_condition?: string;
  lost: boolean;
  immediateCharge: boolean;
}

export interface BatchReturnResult {
  loan_id: number;
  book_id: number;
  copies_serial: number;
  success: boolean;
  error?: string;
  total_add_fee?: number;
}

export interface BatchReturnResponse {
  success_count: number;
  fail_count: number;
  results: BatchReturnResult[];
  member_info?: Array<{
    member_id: number;
    name: string;
    balance: number;
  }>;
}

// Book management related types
export interface BookCopyInfo {
  copies_serial: number;
  status: string;
  book_condition: string;
  purchase_date: string;
  purchase_price: number;
  rental_price: number;
}

export interface BookSearchResult {
  book_id: number;
  name: string;
  author: string;
  publisher?: string;
  price: number;
  copies: BookCopyInfo[];
}

export interface BookListResult {
  book_id: number;
  name: string;
  author: string;
  publisher?: string;
  price: number;
  total_copies: number;
  available_count: number;
  borrowed_count: number;
  lost_count: number;
}

export interface BookListResponse {
  books: BookListResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


