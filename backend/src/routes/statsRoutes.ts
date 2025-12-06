import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { ApiResponse } from '../types';

export const statsRouter = Router();

// M8 / A10: 熱門書籍（本月）
statsRouter.get(
  '/top-books',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      // 計算本月的開始和結束日期
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const sql = `
        SELECT 
          lr.book_id,
          b.name,
          b.author,
          b.publisher,
          COUNT(*) AS borrow_count
        FROM LOAN_RECORD lr
        JOIN BOOK b ON lr.book_id = b.book_id
        WHERE lr.date_out >= $1::date
          AND lr.date_out <= $2::date
        GROUP BY lr.book_id, b.name, b.author, b.publisher
        ORDER BY borrow_count DESC, lr.book_id
        LIMIT $3
      `;

      const result = await query(sql, [
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0],
        limit
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// M8 / A10: 熱門類別（本月）
statsRouter.get(
  '/top-categories',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      // 計算本月的開始和結束日期
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const sql = `
        SELECT 
          c.category_id,
          c.name,
          COUNT(*) AS borrow_count
        FROM LOAN_RECORD lr
        JOIN BOOK b ON lr.book_id = b.book_id
        JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
        JOIN CATEGORY c ON bc.category_id = c.category_id
        WHERE lr.date_out >= $1::date
          AND lr.date_out <= $2::date
        GROUP BY c.category_id, c.name
        ORDER BY borrow_count DESC, c.category_id
        LIMIT $3
      `;

      const result = await query(sql, [
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0],
        limit
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);


