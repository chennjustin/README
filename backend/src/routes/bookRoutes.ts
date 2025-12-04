import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { ApiResponse } from '../types';

export const bookRouter = Router();

// M2: 搜尋 / 列出書籍
bookRouter.get(
  '/',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { keyword, author, publisher, categoryId, memberId } = req.query;
      const conditions: string[] = [];
      const params: any[] = [];

      if (keyword) {
        params.push(`%${keyword}%`);
        conditions.push(`(b.name ILIKE $${params.length})`);
      }
      if (author) {
        params.push(`%${author}%`);
        conditions.push(`b.author ILIKE $${params.length}`);
      }
      if (publisher) {
        params.push(`%${publisher}%`);
        conditions.push(`b.publisher ILIKE $${params.length}`);
      }
      if (categoryId) {
        params.push(Number(categoryId));
        conditions.push(`EXISTS (
          SELECT 1 FROM BOOK_CATEGORY bc2
          WHERE bc2.book_id = b.book_id AND bc2.category_id = $${params.length}
        )`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 若有 memberId，取會員折扣
      let discountJoin = '';
      let discountSelect = 'NULL::DECIMAL AS discount_rate';
      if (memberId) {
        const idx = params.push(Number(memberId));
        discountJoin = `
          LEFT JOIN MEMBER m ON m.member_id = $${idx}
          LEFT JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
        `;
        discountSelect = 'COALESCE(ml.discount_rate, 1.0) AS discount_rate';
      }

      const sql = `
        SELECT 
          b.book_id,
          b.name,
          b.author,
          b.publisher,
          b.price,
          json_agg(DISTINCT jsonb_build_object(
            'category_id', c.category_id,
            'name', c.name
          )) AS categories,
          COALESCE(available_stats.available_count, 0) AS available_count,
          ${discountSelect},
          CASE 
            WHEN COALESCE(ml.discount_rate, 1.0) IS NULL THEN NULL
            ELSE COALESCE(available_stats.min_rental_price, 0) * COALESCE(ml.discount_rate, 1.0)
          END AS estimated_min_rental_price
        FROM BOOK b
        LEFT JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
        LEFT JOIN CATEGORY c ON bc.category_id = c.category_id
        LEFT JOIN (
          SELECT 
            book_id,
            COUNT(*) FILTER (WHERE status = 'Available') AS available_count,
            MIN(rental_price) AS min_rental_price
          FROM BOOK_COPIES
          GROUP BY book_id
        ) AS available_stats ON available_stats.book_id = b.book_id
        ${discountJoin}
        ${whereClause}
        GROUP BY 
          b.book_id,
          b.name,
          b.author,
          b.publisher,
          b.price,
          available_stats.available_count,
          available_stats.min_rental_price,
          ml.discount_rate
        ORDER BY b.book_id
      `;

      const result = await query(sql, params);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// M3: 查看單一本書詳細資訊
bookRouter.get(
  '/:bookId',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookId = Number(req.params.bookId);
      const memberId = req.query.memberId ? Number(req.query.memberId) : undefined;

      if (!Number.isFinite(bookId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BOOK_ID', message: 'bookId 格式錯誤' },
        });
      }

      // 基本資訊與類別
      const baseSql = `
        SELECT 
          b.book_id,
          b.name,
          b.author,
          b.publisher,
          b.price,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'category_id', c.category_id,
                'name', c.name
              )
            ) FILTER (WHERE c.category_id IS NOT NULL),
            '[]'::json
          ) AS categories
        FROM BOOK b
        LEFT JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
        LEFT JOIN CATEGORY c ON bc.category_id = c.category_id
        WHERE b.book_id = $1
        GROUP BY b.book_id
      `;

      const baseRes = await query(baseSql, [bookId]);
      if (baseRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOK_NOT_FOUND', message: '找不到此書籍' },
        });
      }

      // 各書況下可借本數與 rental_price
      let discountRate = 1.0;
      if (memberId) {
        const dsql = `
          SELECT ml.discount_rate
          FROM MEMBER m
          JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
          WHERE m.member_id = $1
        `;
        const dres = await query(dsql, [memberId]);
        if (dres.rowCount && dres.rowCount > 0) {
          discountRate = Number(dres.rows[0].discount_rate) || 1.0;
        }
      }

      const copiesSql = `
        SELECT 
          book_condition,
          rental_price,
          COUNT(*) FILTER (WHERE status = 'Available') AS available_count,
          $2::DECIMAL AS discount_rate,
          rental_price * $2::DECIMAL AS discounted_rental_price
        FROM BOOK_COPIES
        WHERE book_id = $1
        GROUP BY book_condition, rental_price
        ORDER BY book_condition, rental_price
      `;
      const copiesRes = await query(copiesSql, [bookId, discountRate]);

      const data = {
        ...baseRes.rows[0],
        copies: copiesRes.rows,
      };

      return res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);


