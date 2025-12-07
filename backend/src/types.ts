export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    hint?: string;
    detail?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface AuthAdmin {
  admin_id: number;
}

export interface AuthMember {
  member_id: number;
}


