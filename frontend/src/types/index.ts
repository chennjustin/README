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


