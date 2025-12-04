import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { ApiResponse } from '../types';

export const statsRouter = Router();

// M8 / A10: 熱門書籍
statsRouter.get(
  '/top-books',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const sql = `
        SELECT 
          lr.book_id,
          b.name,
          b.author,
          b.publisher,
          COUNT(*) AS borrow_count
        FROM LOAN_RECORD lr
        JOIN BOOK b ON lr.book_id = b.book_id
        GROUP BY lr.book_id, b.name, b.author, b.publisher
        ORDER BY borrow_count DESC, lr.book_id
        LIMIT $1
      `;

      const result = await query(sql, [limit]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// M8 / A10: 熱門類別
statsRouter.get(
  '/top-categories',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const sql = `
        SELECT 
          c.category_id,
          c.name,
          COUNT(*) AS borrow_count
        FROM LOAN_RECORD lr
        JOIN BOOK b ON lr.book_id = b.book_id
        JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
        JOIN CATEGORY c ON bc.category_id = c.category_id
        GROUP BY c.category_id, c.name
        ORDER BY borrow_count DESC, c.category_id
        LIMIT $1
      `;

      const result = await query(sql, [limit]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);


