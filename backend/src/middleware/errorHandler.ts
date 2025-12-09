import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../types';

export function errorHandler(err: any, _req: Request, res: Response<ApiError>, _next: NextFunction) {
  // 錯誤處理邏輯（已移除詳細日誌輸出）

  // 資料庫連線錯誤
  if (err && err.code === 'ECONNREFUSED') {
    return res.status(500).json({
      success: false,
      error: {
        code: 'DB_CONNECTION_ERROR',
        message: '資料庫連線失敗',
        details: err.message,
      },
    });
  }

  // 業務邏輯錯誤（已處理的錯誤）
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

  // PostgreSQL 錯誤處理
  if (err && err.code && err.code.startsWith('23')) {
    // 23xxx 是完整性約束違反
    let message = '資料完整性錯誤';
    if (err.code === '23505') {
      message = '資料重複：此記錄已存在';
    } else if (err.code === '23503') {
      message = '外鍵約束錯誤：相關資料不存在';
    } else if (err.code === '23514') {
      message = '檢查約束錯誤：資料不符合規則';
    }
    
    return res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_CONSTRAINT_ERROR',
        message: message,
        details: err.detail || err.message,
        hint: err.hint,
      },
    });
  }

  // PostgreSQL 語法錯誤
  if (err && err.code && err.code.startsWith('42')) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_SYNTAX_ERROR',
        message: '資料庫查詢語法錯誤',
        details: err.message,
        hint: err.hint,
      },
    });
  }

  // 其他 PostgreSQL 錯誤
  if (err && err.code && err.code.length === 5) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: `資料庫錯誤 (${err.code})`,
        details: err.message || '資料庫操作失敗',
        hint: err.hint,
        detail: err.detail,
      },
    });
  }

  // 一般錯誤（有 message 的）
  if (err && err.message) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || '伺服器發生未預期錯誤',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    });
  }

  // 未知錯誤
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '伺服器發生未預期錯誤',
      details: process.env.NODE_ENV === 'development' ? JSON.stringify(err) : undefined,
    },
  });
}


