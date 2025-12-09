import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { getSearchHistoryCollection } from '../mongodb';
import { ApiResponse } from '../types';

export const bookRouter = Router();

// M2: 搜尋 / 列出書籍
bookRouter.get(
  '/',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { keyword, author, publisher, categoryId, memberId, minPrice, maxPrice } = req.query;
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
      // 價格篩選需要篩選租金價格，不是定價，所以先不加入 conditions
      // 等子查詢建立後，在 HAVING 子句中處理

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 若有 memberId，取會員折扣
      let discountJoin = '';
      let discountSelect = 'NULL::DECIMAL AS discount_rate';
      let discountGroupBy = '';
      let estimatedPriceExpr = 'available_stats.min_rental_price AS estimated_min_rental_price';
      if (memberId) {
        const idx = params.push(Number(memberId));
        discountJoin = `
          LEFT JOIN MEMBER m ON m.member_id = $${idx}
          LEFT JOIN MEMBERSHIP_LEVEL ml ON m.level_id = ml.level_id
        `;
        discountSelect = 'COALESCE(ml.discount_rate, 1.0) AS discount_rate';
        discountGroupBy = ', ml.discount_rate';
        estimatedPriceExpr = `COALESCE(available_stats.min_rental_price, 0) * COALESCE(ml.discount_rate, 1.0) AS estimated_min_rental_price`;
      }

      // 處理價格篩選（篩選租金價格，使用 HAVING 子句）
      let priceFilterHaving = '';
      if (minPrice || maxPrice) {
        const havingConditions: string[] = [];
        if (minPrice) {
          const minPriceVal = Number(minPrice);
          if (memberId) {
            // 有會員折扣時，篩選折扣後的價格
            havingConditions.push(`COALESCE(available_stats.min_rental_price, 0) * COALESCE(ml.discount_rate, 1.0) >= ${minPriceVal}`);
          } else {
            // 無會員折扣時，篩選原始租金價格
            havingConditions.push(`COALESCE(available_stats.min_rental_price, 0) >= ${minPriceVal}`);
          }
        }
        if (maxPrice) {
          const maxPriceVal = Number(maxPrice);
          if (memberId) {
            havingConditions.push(`COALESCE(available_stats.min_rental_price, 0) * COALESCE(ml.discount_rate, 1.0) <= ${maxPriceVal}`);
          } else {
            havingConditions.push(`COALESCE(available_stats.min_rental_price, 0) <= ${maxPriceVal}`);
          }
        }
        if (havingConditions.length > 0) {
          priceFilterHaving = `HAVING ${havingConditions.join(' AND ')}`;
        }
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
          ${estimatedPriceExpr}
        FROM BOOK b
        LEFT JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
        LEFT JOIN CATEGORY c ON bc.category_id = c.category_id
        LEFT JOIN (
          SELECT 
            bc.book_id,
            COUNT(*) FILTER (WHERE bc.status = 'Available') AS available_count,
            MIN(b.price * cd.discount_factor)::INTEGER AS min_rental_price
          FROM BOOK_COPIES bc
          JOIN BOOK b ON bc.book_id = b.book_id
          JOIN CONDITION_DISCOUNT cd ON bc.book_condition = cd.book_condition
          GROUP BY bc.book_id
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
          available_stats.min_rental_price
          ${discountGroupBy}
        ${priceFilterHaving}
        ORDER BY b.book_id
      `;

      const result = await query(sql, params);
      const books = result.rows;

      // 如果有 memberId，保存搜尋記錄到 MongoDB
      if (memberId && Number.isFinite(Number(memberId))) {
        try {
          const collection = await getSearchHistoryCollection();
          if (collection) {
            const searchRecord = {
              member_id: Number(memberId),
              search_query: keyword || '',
              search_date: new Date(),
              book_ids: books.map((b: any) => b.book_id),
              filters: {
                category: categoryId ? Number(categoryId) : null,
                author: author || null,
                publisher: publisher || null,
                min_price: minPrice ? Number(minPrice) : null,
                max_price: maxPrice ? Number(maxPrice) : null,
              },
            };
            await collection.insertOne(searchRecord);
          }
        } catch (mongoError) {
          // MongoDB 錯誤不影響搜尋結果，靜默處理
        }
      }

      return res.json({ success: true, data: books });
    } catch (err) {
      next(err);
    }
  }
);

// 獲取所有類別列表
bookRouter.get(
  '/categories',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const sql = `
        SELECT category_id, name
        FROM CATEGORY
        ORDER BY name
      `;
      const result = await query(sql, []);
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
          bc.book_condition,
          (b.price * cd.discount_factor)::INTEGER AS rental_price,
          COUNT(*) FILTER (WHERE bc.status = 'Available') AS available_count,
          $2::DECIMAL AS discount_rate,
          (b.price * cd.discount_factor * $2::DECIMAL)::INTEGER AS discounted_rental_price
        FROM BOOK_COPIES bc
        JOIN BOOK b ON bc.book_id = b.book_id
        JOIN CONDITION_DISCOUNT cd ON bc.book_condition = cd.book_condition
        WHERE bc.book_id = $1
        GROUP BY bc.book_condition, b.price, cd.discount_factor
        ORDER BY bc.book_condition, rental_price
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


