import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../types';

export function errorHandler(err: any, _req: Request, res: Response<ApiError>, _next: NextFunction) {
  console.error(err);

  if (err && err.code === 'ECONNREFUSED') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'DB_CONNECTION_ERROR',
        message: '資料庫連線失敗',
      },
    });
  }

  if (err && err.type === 'business') {
    return res.status(err.status || 400).json({
      success: false,
      error: {
        code: err.code || 'BUSINESS_ERROR',
        message: err.message || '業務邏輯錯誤',
        details: err.details,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '伺服器發生未預期錯誤',
    },
  });
}


