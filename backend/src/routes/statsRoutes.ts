import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { ApiResponse } from '../types';

export const statsRouter = Router();

// 輔助函數：解析日期範圍
function parseDateRange(req: Request): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (req.query.startDate && req.query.endDate) {
    // 使用提供的日期範圍
    startDate = new Date(req.query.startDate as string);
    endDate = new Date(req.query.endDate as string);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // 預設：本月
    const year = now.getFullYear();
    const month = now.getMonth();
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  }

  return { startDate, endDate };
}

// A10: 熱門書籍（支援時間範圍）
statsRouter.get(
  '/top-books',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const { startDate, endDate } = parseDateRange(req);

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
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        limit
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A10: 熱門類別（支援時間範圍）
statsRouter.get(
  '/top-categories',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const { startDate, endDate } = parseDateRange(req);

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
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        limit
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A10: 按會員等級統計借閱次數
statsRouter.get(
  '/by-membership-level',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { startDate, endDate } = parseDateRange(req);

      const sql = `
        SELECT 
          ml.level_id,
          ml.level_name,
          COUNT(*) AS borrow_count,
          COUNT(DISTINCT bl.member_id) AS member_count
        FROM LOAN_RECORD lr
        JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
        JOIN MEMBER m ON bl.member_id = m.member_id
        JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
        WHERE lr.date_out >= $1::date
          AND lr.date_out <= $2::date
        GROUP BY ml.level_id, ml.level_name
        ORDER BY ml.level_id
      `;

      const result = await query(sql, [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A10: 熱門類別按會員等級分組
statsRouter.get(
  '/categories-by-level',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const { startDate, endDate } = parseDateRange(req);

      const sql = `
        SELECT 
          c.category_id,
          c.name AS category_name,
          ml.level_id,
          ml.level_name,
          COUNT(*) AS borrow_count
        FROM LOAN_RECORD lr
        JOIN BOOK b ON lr.book_id = b.book_id
        JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
        JOIN CATEGORY c ON bc.category_id = c.category_id
        JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
        JOIN MEMBER m ON bl.member_id = m.member_id
        JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
        WHERE lr.date_out >= $1::date
          AND lr.date_out <= $2::date
        GROUP BY c.category_id, c.name, ml.level_id, ml.level_name
        ORDER BY borrow_count DESC, c.category_id, ml.level_id
        LIMIT $3
      `;

      const result = await query(sql, [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        limit
      ]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A10: 綜合統計報告
statsRouter.get(
  '/summary',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { startDate, endDate } = parseDateRange(req);

      // 總借閱次數
      const totalBorrowsSql = `
        SELECT COUNT(*) AS total_borrows
        FROM LOAN_RECORD lr
        WHERE lr.date_out >= $1::date
          AND lr.date_out <= $2::date
      `;

      // 總借閱金額（通過 LOAN_RECORD 的 date_out 來篩選，每個 loan_id 只計算一次）
      const totalRevenueSql = `
        SELECT COALESCE(SUM(bl.final_price), 0) AS total_revenue
        FROM (
          SELECT DISTINCT bl.loan_id, bl.final_price
          FROM BOOK_LOAN bl
          WHERE EXISTS (
            SELECT 1
            FROM LOAN_RECORD lr
            WHERE lr.loan_id = bl.loan_id
              AND lr.date_out >= $1::date
              AND lr.date_out <= $2::date
          )
        ) bl
      `;

      // 參與借閱的會員數（通過 LOAN_RECORD 的 date_out 來篩選）
      const activeMembersSql = `
        SELECT COUNT(DISTINCT bl.member_id) AS active_members
        FROM BOOK_LOAN bl
        WHERE EXISTS (
          SELECT 1
          FROM LOAN_RECORD lr
          WHERE lr.loan_id = bl.loan_id
            AND lr.date_out >= $1::date
            AND lr.date_out <= $2::date
        )
      `;

      // 借閱的書籍種類數
      const uniqueBooksSql = `
        SELECT COUNT(DISTINCT lr.book_id) AS unique_books
        FROM LOAN_RECORD lr
        WHERE lr.date_out >= $1::date
          AND lr.date_out <= $2::date
      `;

      const dateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const [totalBorrows, totalRevenue, activeMembers, uniqueBooks] = await Promise.all([
        query(totalBorrowsSql, [dateStr, endDateStr]),
        query(totalRevenueSql, [dateStr, endDateStr]),
        query(activeMembersSql, [dateStr, endDateStr]),
        query(uniqueBooksSql, [dateStr, endDateStr])
      ]);

      return res.json({
        success: true,
        data: {
          period: {
            start_date: dateStr,
            end_date: endDateStr
          },
          summary: {
            total_borrows: Number(totalBorrows.rows[0].total_borrows),
            total_revenue: Number(totalRevenue.rows[0].total_revenue),
            active_members: Number(activeMembers.rows[0].active_members),
            unique_books: Number(uniqueBooks.rows[0].unique_books)
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
);


