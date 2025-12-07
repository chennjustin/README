import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../db';
import { ApiResponse, AuthAdmin } from '../types';

export const adminRouter = Router();

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret';

interface AuthedRequest extends Request {
  admin?: AuthAdmin;
}

function requireAdmin(req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '缺少或無效的管理員 Token' },
    });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthAdmin;
    req.admin = { admin_id: payload.admin_id };
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Token 驗證失敗' },
    });
  }
}

// A1: Admin 登入
adminRouter.post(
  '/login',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { name, phone } = req.body || {};
      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 name / phone' },
        });
      }

      // First, check if the account (name) exists
      const sql = `
        SELECT admin_id, name, phone, role, status
        FROM ADMIN
        WHERE name = $1
      `;
      const result = await query(sql, [name]);
      
      // Account not found
      if (result.rowCount === 0) {
        return res.status(401).json({
          success: false,
          error: { code: 'ACCOUNT_NOT_FOUND', message: '帳號不存在，請確認是否有權限' },
        });
      }

      const admin = result.rows[0] as any;

      // Check if password (phone) matches
      if (admin.phone !== phone) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: '密碼錯誤' },
        });
      }

      // Check if admin status is active
      if (admin.status !== 'Active') {
        return res.status(403).json({
          success: false,
          error: { code: 'ADMIN_INACTIVE', message: '管理員帳號未啟用' },
        });
      }

      const token = jwt.sign({ admin_id: admin.admin_id }, JWT_SECRET, { expiresIn: '8h' });

      return res.json({
        success: true,
        data: {
          token,
          admin: {
            admin_id: admin.admin_id,
            name: admin.name,
            phone: admin.phone,
            role: admin.role,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// A2: 新增會員
adminRouter.post(
  '/members',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { name, phone, email, initialBalance = 0 } = req.body || {};
      if (!name || !phone || !email) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 name / phone / email' },
        });
      }

      const adminId = req.admin!.admin_id;

      const result = await withTransaction(async (client) => {
        // Check if member with same name and phone already exists
        const checkDuplicateSql = `
          SELECT member_id, name, phone
          FROM MEMBER
          WHERE name = $1 AND phone = $2
        `;
        const duplicateRes = await client.query(checkDuplicateSql, [name, phone]);
        if (duplicateRes.rowCount > 0) {
          throw {
            type: 'business',
            status: 400,
            code: 'MEMBER_ALREADY_EXISTS',
            message: '該會員已註冊',
          };
        }

        // 找出符合初始餘額的會員等級（min_balance_required 最大但 <= initialBalance）
        const levelSql = `
          SELECT level_id
          FROM MEMBERSHIP_LEVEL
          WHERE min_balance_required <= $1
          ORDER BY min_balance_required DESC
          LIMIT 1
        `;
        const levelRes = await client.query(levelSql, [initialBalance]);
        if (levelRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 400,
            code: 'NO_LEVEL_MATCH',
            message: '找不到符合此餘額的會員等級',
          };
        }
        const levelId = levelRes.rows[0].level_id;

        const insertSql = `
          INSERT INTO MEMBER (name, level_id, admin_id, join_date, email, phone, balance, status)
          VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, 'Active')
          RETURNING *
        `;
        const memberRes = await client.query(insertSql, [
          name,
          levelId,
          adminId,
          email,
          phone,
          initialBalance,
        ]);

        return memberRes.rows[0];
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A2: 調整會員餘額
adminRouter.patch(
  '/members/:memberId/balance',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = Number(req.params.memberId);
      const { amount } = req.body || {};

      if (!Number.isFinite(memberId) || typeof amount !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'memberId 或 amount 格式錯誤' },
        });
      }

      const sql = `
        UPDATE MEMBER
        SET balance = balance + $1
        WHERE member_id = $2
        RETURNING member_id, balance
      `;
      const result = await query(sql, [amount, memberId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'MEMBER_NOT_FOUND', message: '找不到會員' },
        });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// A2: 修改會員狀態
adminRouter.patch(
  '/members/:memberId/status',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = Number(req.params.memberId);
      const { status } = req.body || {};

      if (!Number.isFinite(memberId) || !['Active', 'Inactive', 'Suspended'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'memberId 或 status 格式錯誤' },
        });
      }

      const sql = `
        UPDATE MEMBER
        SET status = $1
        WHERE member_id = $2
        RETURNING member_id, status
      `;
      const result = await query(sql, [status, memberId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'MEMBER_NOT_FOUND', message: '找不到會員' },
        });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// A3: 書籍基本資訊管理
adminRouter.post(
  '/books',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { name, author, publisher, price, category_id, copies_count = 1, sequence_name } = req.body || {};
      if (!name || !author || typeof price !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 name / author / price' },
        });
      }

      if (typeof copies_count !== 'number' || copies_count < 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'copies_count 必須為大於 0 的數字' },
        });
      }

      const result = await withTransaction(async (client) => {
        // 1. 新增書籍到 BOOK 表
        const insertBookSql = `
          INSERT INTO BOOK (sequence_name, name, author, publisher, price)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const bookRes = await client.query(insertBookSql, [
          sequence_name || null,
          name,
          author,
          publisher || null,
          price,
        ]);
        const book = bookRes.rows[0];
        const bookId = book.book_id;

        // 2. 如果提供 category_id，新增到 BOOK_CATEGORY 表
        if (category_id !== undefined && category_id !== null) {
          const insertCategorySql = `
            INSERT INTO BOOK_CATEGORY (book_id, category_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `;
          await client.query(insertCategorySql, [bookId, category_id]);
        }

        // 3. 取得 Good 書況的折扣係數
        const discountSql = `
          SELECT discount_factor
          FROM CONDITION_DISCOUNT
          WHERE book_condition = 'Good'
        `;
        const discountRes = await client.query(discountSql);
        if (discountRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 500,
            code: 'CONDITION_NOT_FOUND',
            message: '找不到 Good 書況的折扣設定',
          };
        }
        const discount = Number(discountRes.rows[0].discount_factor);
        const rentalPrice = Math.round(price * discount);

        // 4. 新增複本到 BOOK_COPIES 表
        const purchaseDate = new Date();
        const copies = [];
        for (let i = 1; i <= copies_count; i++) {
          const insertCopySql = `
            INSERT INTO BOOK_COPIES (
              book_id, copies_serial, status, purchase_date, purchase_price, book_condition, rental_price
            ) VALUES ($1, $2, 'Available', $3, $4, 'Good', $5)
            RETURNING *
          `;
          const copyRes = await client.query(insertCopySql, [
            bookId,
            i,
            purchaseDate,
            price, // purchase_price = price (租金定價)
            rentalPrice,
          ]);
          copies.push(copyRes.rows[0]);
        }

        return {
          book,
          copies,
        };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.patch(
  '/books/:bookId',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookId = Number(req.params.bookId);
      const { sequence_name, name, author, publisher, price } = req.body || {};

      if (!Number.isFinite(bookId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BOOK_ID', message: 'bookId 格式錯誤' },
        });
      }

      const fields: string[] = [];
      const params: any[] = [];

      if (sequence_name !== undefined) {
        params.push(sequence_name);
        fields.push(`sequence_name = $${params.length}`);
      }
      if (name !== undefined) {
        params.push(name);
        fields.push(`name = $${params.length}`);
      }
      if (author !== undefined) {
        params.push(author);
        fields.push(`author = $${params.length}`);
      }
      if (publisher !== undefined) {
        params.push(publisher);
        fields.push(`publisher = $${params.length}`);
      }
      if (price !== undefined) {
        params.push(price);
        fields.push(`price = $${params.length}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FIELDS', message: '沒有要更新的欄位' },
        });
      }

      params.push(bookId);
      const sql = `
        UPDATE BOOK
        SET ${fields.join(', ')}
        WHERE book_id = $${params.length}
        RETURNING *
      `;

      const result = await query(sql, params);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOK_NOT_FOUND', message: '找不到此書籍' },
        });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.delete(
  '/books/:bookId',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookId = Number(req.params.bookId);
      if (!Number.isFinite(bookId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BOOK_ID', message: 'bookId 格式錯誤' },
        });
      }

      const sql = `
        DELETE FROM BOOK
        WHERE book_id = $1
        RETURNING book_id
      `;
      const result = await query(sql, [bookId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'BOOK_NOT_FOUND', message: '找不到此書籍' },
        });
      }

      return res.json({ success: true, data: { book_id: bookId } });
    } catch (err) {
      next(err);
    }
  }
);

// 搜尋書籍 API
adminRouter.get(
  '/books/search',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookIdParam = req.query.bookId as string | undefined;
      const name = req.query.name as string | undefined;
      const categoryIdParam = req.query.categoryId as string | undefined;
      const status = req.query.status as string | undefined;

      const params: any[] = [];
      const conditions: string[] = [];

      if (bookIdParam) {
        const bookId = Number(bookIdParam);
        if (Number.isFinite(bookId)) {
          params.push(bookId);
          conditions.push(`b.book_id = $${params.length}`);
        }
      }

      if (name) {
        params.push(`%${name}%`);
        conditions.push(`b.name ILIKE $${params.length}`);
      }

      if (categoryIdParam) {
        const categoryId = Number(categoryIdParam);
        if (Number.isFinite(categoryId)) {
          params.push(categoryId);
          conditions.push(`EXISTS (
            SELECT 1 FROM BOOK_CATEGORY bc2
            WHERE bc2.book_id = b.book_id AND bc2.category_id = $${params.length}
          )`);
        }
      }

      if (conditions.length === 0 && !categoryIdParam) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '請提供 bookId、name 或 categoryId 參數' },
        });
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build SQL with optional status filter
      let sql: string;
      if (status && ['Available', 'Borrowed', 'Lost'].includes(status)) {
        // If status filter is provided, only show books with copies matching that status
        const statusParamIndex = params.length + 1;
        sql = `
          SELECT 
            b.book_id,
            b.name,
            b.author,
            b.publisher,
            b.price,
            COALESCE(
              json_agg(
                jsonb_build_object(
                  'copies_serial', bc.copies_serial,
                  'status', bc.status,
                  'book_condition', bc.book_condition,
                  'purchase_date', bc.purchase_date,
                  'purchase_price', bc.purchase_price,
                  'rental_price', bc.rental_price
                )
                ORDER BY bc.copies_serial
              ) FILTER (WHERE bc.copies_serial IS NOT NULL),
              '[]'::json
            ) AS copies
          FROM BOOK b
          INNER JOIN BOOK_COPIES bc ON b.book_id = bc.book_id AND bc.status = $${statusParamIndex}
          ${whereClause}
          GROUP BY b.book_id, b.name, b.author, b.publisher, b.price
          ORDER BY b.book_id
        `;
        params.push(status);
      } else {
        // No status filter, show all copies
        sql = `
          SELECT 
            b.book_id,
            b.name,
            b.author,
            b.publisher,
            b.price,
            COALESCE(
              json_agg(
                jsonb_build_object(
                  'copies_serial', bc.copies_serial,
                  'status', bc.status,
                  'book_condition', bc.book_condition,
                  'purchase_date', bc.purchase_date,
                  'purchase_price', bc.purchase_price,
                  'rental_price', bc.rental_price
                )
                ORDER BY bc.copies_serial
              ) FILTER (WHERE bc.copies_serial IS NOT NULL),
              '[]'::json
            ) AS copies
          FROM BOOK b
          LEFT JOIN BOOK_COPIES bc ON b.book_id = bc.book_id
          ${whereClause}
          GROUP BY b.book_id, b.name, b.author, b.publisher, b.price
          ORDER BY b.book_id
        `;
      }

      const result = await query(sql, params);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// 列出所有書籍 API（分頁）
adminRouter.get(
  '/books',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 100;
      const offset = (page - 1) * limit;

      if (page < 1 || limit < 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'page 和 limit 必須大於 0' },
        });
      }

      // 取得總數
      const countSql = `SELECT COUNT(DISTINCT b.book_id) AS total FROM BOOK b`;
      const countResult = await query(countSql, []);
      const total = Number(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      // 取得書籍列表（含複本統計）
      const sql = `
        SELECT 
          b.book_id,
          b.name,
          b.author,
          b.publisher,
          b.price,
          COUNT(bc.copies_serial) AS total_copies,
          COUNT(*) FILTER (WHERE bc.status = 'Available') AS available_count,
          COUNT(*) FILTER (WHERE bc.status = 'Borrowed') AS borrowed_count,
          COUNT(*) FILTER (WHERE bc.status = 'Lost') AS lost_count
        FROM BOOK b
        LEFT JOIN BOOK_COPIES bc ON b.book_id = bc.book_id
        GROUP BY b.book_id, b.name, b.author, b.publisher, b.price
        ORDER BY b.book_id
        LIMIT $1 OFFSET $2
      `;

      const result = await query(sql, [limit, offset]);
      return res.json({
        success: true,
        data: {
          books: result.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 分類管理
adminRouter.post(
  '/categories',
  requireAdmin,
  async (_req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { name } = _req.body || {};
      if (!name) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 name' },
        });
      }

      const sql = `
        INSERT INTO CATEGORY (name)
        VALUES ($1)
        RETURNING *
      `;
      const result = await query(sql, [name]);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.patch(
  '/categories/:categoryId',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const categoryId = Number(req.params.categoryId);
      const { name } = req.body || {};
      if (!Number.isFinite(categoryId) || !name) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'categoryId 或 name 格式錯誤' },
        });
      }

      const sql = `
        UPDATE CATEGORY
        SET name = $1
        WHERE category_id = $2
        RETURNING *
      `;
      const result = await query(sql, [name, categoryId]);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'CATEGORY_NOT_FOUND', message: '找不到分類' },
        });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// 書籍分類調整
adminRouter.post(
  '/books/:bookId/categories',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookId = Number(req.params.bookId);
      const { categoryIds } = req.body || {};
      if (!Number.isFinite(bookId) || !Array.isArray(categoryIds)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'bookId 或 categoryIds 格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        await client.query('DELETE FROM BOOK_CATEGORY WHERE book_id = $1', [bookId]);
        for (const cid of categoryIds) {
          await client.query(
            'INSERT INTO BOOK_CATEGORY (book_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [bookId, cid]
          );
        }
        const sql = `
          SELECT 
            b.book_id,
            b.name,
            json_agg(
              jsonb_build_object('category_id', c.category_id, 'name', c.name)
            ) AS categories
          FROM BOOK b
          LEFT JOIN BOOK_CATEGORY bc ON b.book_id = bc.book_id
          LEFT JOIN CATEGORY c ON bc.category_id = c.category_id
          WHERE b.book_id = $1
          GROUP BY b.book_id
        `;
        const res2 = await client.query(sql, [bookId]);
        return res2.rows[0];
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A4: 複本管理
adminRouter.post(
  '/books/:bookId/copies',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookId = Number(req.params.bookId);
      const { purchase_date, purchase_price, book_condition = 'Good' } = req.body || {};

      if (!Number.isFinite(bookId) || typeof purchase_price !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'bookId 或 purchase_price 格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        // 取得對應書況折扣
        const discountSql = `
          SELECT discount_factor
          FROM CONDITION_DISCOUNT
          WHERE book_condition = $1
        `;
        const discountRes = await client.query(discountSql, [book_condition]);
        if (discountRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 400,
            code: 'INVALID_CONDITION',
            message: '無效的書況',
          };
        }

        const discount = Number(discountRes.rows[0].discount_factor);

        // 取得書籍售價
        const priceSql = `SELECT price FROM BOOK WHERE book_id = $1`;
        const priceRes = await client.query(priceSql, [bookId]);
        if (priceRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'BOOK_NOT_FOUND',
            message: '找不到書籍',
          };
        }

        const bookPrice = Number(priceRes.rows[0].price);
        const rentalPrice = Math.round(bookPrice * discount);

        // copies_serial：可用同 book_id 下最大值 + 1
        const serialSql = `
          SELECT COALESCE(MAX(copies_serial), 0) + 1 AS next_serial
          FROM BOOK_COPIES
          WHERE book_id = $1
        `;
        const serialRes = await client.query(serialSql, [bookId]);
        const copiesSerial = Number(serialRes.rows[0].next_serial);

        const insertSql = `
          INSERT INTO BOOK_COPIES (
            book_id, copies_serial, status, purchase_date, purchase_price, book_condition, rental_price
          ) VALUES ($1, $2, 'Available', $3, $4, $5, $6)
          RETURNING *
        `;
        const copyRes = await client.query(insertSql, [
          bookId,
          copiesSerial,
          purchase_date || new Date(),
          purchase_price,
          book_condition,
          rentalPrice,
        ]);

        return copyRes.rows[0];
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.patch(
  '/books/:bookId/copies/:copiesSerial',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const bookId = Number(req.params.bookId);
      const copiesSerial = Number(req.params.copiesSerial);
      const { status, book_condition } = req.body || {};

      if (!Number.isFinite(bookId) || !Number.isFinite(copiesSerial)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'bookId 或 copiesSerial 格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        // 如果更新 book_condition，需要重新計算 rental_price
        if (book_condition !== undefined) {
          // 取得新的書況折扣係數
          const discountSql = `
            SELECT discount_factor
            FROM CONDITION_DISCOUNT
            WHERE book_condition = $1
          `;
          const discountRes = await client.query(discountSql, [book_condition]);
          if (discountRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 400,
              code: 'INVALID_CONDITION',
              message: '無效的書況',
            };
          }

          const discount = Number(discountRes.rows[0].discount_factor);

          // 取得書籍的 price
          const priceSql = `SELECT price FROM BOOK WHERE book_id = $1`;
          const priceRes = await client.query(priceSql, [bookId]);
          if (priceRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 404,
              code: 'BOOK_NOT_FOUND',
              message: '找不到書籍',
            };
          }

          const bookPrice = Number(priceRes.rows[0].price);
          const newRentalPrice = Math.round(bookPrice * discount);

          // 更新 book_condition 和 rental_price
          const fields: string[] = [];
          const params: any[] = [];

          fields.push(`book_condition = $${params.length + 1}`);
          params.push(book_condition);
          fields.push(`rental_price = $${params.length + 1}`);
          params.push(newRentalPrice);

          if (status !== undefined) {
            fields.push(`status = $${params.length + 1}`);
            params.push(status);
          }

          params.push(bookId, copiesSerial);
          const updateSql = `
            UPDATE BOOK_COPIES
            SET ${fields.join(', ')}
            WHERE book_id = $${params.length - 1}
              AND copies_serial = $${params.length}
            RETURNING *
          `;

          const updateRes = await client.query(updateSql, params);
          if (updateRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 404,
              code: 'COPY_NOT_FOUND',
              message: '找不到書籍複本',
            };
          }

          return updateRes.rows[0];
        } else {
          // 只更新 status
          if (status === undefined) {
            throw {
              type: 'business',
              status: 400,
              code: 'NO_FIELDS',
              message: '沒有要更新的欄位',
            };
          }

          const updateSql = `
            UPDATE BOOK_COPIES
            SET status = $1
            WHERE book_id = $2
              AND copies_serial = $3
            RETURNING *
          `;

          const updateRes = await client.query(updateSql, [status, bookId, copiesSerial]);
          if (updateRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 404,
              code: 'COPY_NOT_FOUND',
              message: '找不到書籍複本',
            };
          }

          return updateRes.rows[0];
        }
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A5: 櫃檯借書預覽（計算租金、驗證狀態）
adminRouter.get(
  '/borrow/preview',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = Number(req.query.member_id);
      const bookId = Number(req.query.book_id);
      const copiesSerial = Number(req.query.copies_serial);

      if (!Number.isFinite(memberId) || !Number.isFinite(bookId) || !Number.isFinite(copiesSerial)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'member_id、book_id、copies_serial 必須為有效數字' },
        });
      }

      // Query member and membership level
      const memberSql = `
        SELECT 
          m.member_id,
          m.status,
          l.discount_rate
        FROM MEMBER m
        JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
        WHERE m.member_id = $1
      `;
      const memberRes = await query(memberSql, [memberId]);
      if (memberRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'MEMBER_NOT_FOUND', message: '找不到會員' },
        });
      }
      const member = memberRes.rows[0];

      if (member.status !== 'Active') {
        return res.status(400).json({
          success: false,
          error: { code: 'MEMBER_INACTIVE', message: '會員狀態不可借書' },
        });
      }

      // Query book copy information
      const copySql = `
        SELECT 
          bc.book_id,
          bc.copies_serial,
          bc.status,
          bc.rental_price,
          bc.book_condition,
          b.name AS book_name
        FROM BOOK_COPIES bc
        JOIN BOOK b ON bc.book_id = b.book_id
        WHERE bc.book_id = $1 AND bc.copies_serial = $2
      `;
      const copyRes = await query(copySql, [bookId, copiesSerial]);
      if (copyRes.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'COPY_NOT_FOUND', message: '找不到書籍複本' },
        });
      }
      const copy = copyRes.rows[0];

      if (copy.status !== 'Available') {
        return res.status(400).json({
          success: false,
          error: { code: 'COPY_NOT_AVAILABLE', message: '複本不可借出' },
        });
      }

      // Calculate rental fee: rental_price * discount_rate
      const rentalPrice = Number(copy.rental_price);
      const discountRate = Number(member.discount_rate);
      const rentalFee = Math.round(rentalPrice * discountRate);

      return res.json({
        success: true,
        data: {
          book_id: copy.book_id,
          copies_serial: copy.copies_serial,
          book_name: copy.book_name,
          status: copy.status,
          rental_fee: rentalFee,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// A5: 櫃檯辦理借書
adminRouter.post(
  '/loans',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { member_id, items } = req.body || {};
      const adminId = req.admin!.admin_id;

      if (!member_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 member_id 或 items' },
        });
      }

      const result = await withTransaction(async (client) => {
        // 會員與等級
        const memberSql = `
          SELECT 
            m.member_id,
            m.status,
            m.balance,
            l.max_book_allowed,
            l.hold_days,
            l.discount_rate
          FROM MEMBER m
          JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
          WHERE m.member_id = $1
          FOR UPDATE
        `;
        const memberRes = await client.query(memberSql, [member_id]);
        if (memberRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'MEMBER_NOT_FOUND',
            message: '找不到會員',
          };
        }
        const member = memberRes.rows[0];

        if (member.status !== 'Active') {
          throw {
            type: 'business',
            status: 400,
            code: 'MEMBER_INACTIVE',
            message: '會員狀態不可借書',
          };
        }

        // 當前借閱中本數
        const activeSql = `
          SELECT COUNT(*) AS cnt
          FROM LOAN_RECORD lr
          JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
          WHERE bl.member_id = $1
            AND lr.return_date IS NULL
        `;
        const activeRes = await client.query(activeSql, [member_id]);
        const currentCnt = Number(activeRes.rows[0].cnt);
        const totalAfter = currentCnt + items.length;
        if (totalAfter > member.max_book_allowed) {
          throw {
            type: 'business',
            status: 400,
            code: 'MAX_BOOK_EXCEEDED',
            message: '超過可借閱本數上限',
          };
        }

        // 取得複本資訊並檢查可借
        const rentals: {
          book_id: number;
          copies_serial: number;
          rental_price: number;
        }[] = [];

        for (const it of items) {
          const { book_id, copies_serial } = it;
          const copySql = `
            SELECT book_id, copies_serial, status, rental_price
            FROM BOOK_COPIES
            WHERE book_id = $1 AND copies_serial = $2
            FOR UPDATE
          `;
          const copyRes = await client.query(copySql, [book_id, copies_serial]);
          if (copyRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 404,
              code: 'COPY_NOT_FOUND',
              message: `找不到複本 book_id=${book_id}, copies_serial=${copies_serial}`,
            };
          }
          const copy = copyRes.rows[0];
          if (copy.status !== 'Available') {
            throw {
              type: 'business',
              status: 400,
              code: 'COPY_NOT_AVAILABLE',
              message: `複本不可借出 book_id=${book_id}, copies_serial=${copies_serial}`,
            };
          }
          rentals.push({
            book_id,
            copies_serial,
            rental_price: Number(copy.rental_price),
          });
        }

        // 計算租金（複本 rental_price * discount_rate）
        let finalPrice = 0;
        const perItemFees: { book_id: number; copies_serial: number; rental_fee: number }[] = [];
        for (const r of rentals) {
          const fee = Math.round(r.rental_price * member.discount_rate);
          finalPrice += fee;
          perItemFees.push({
            book_id: r.book_id,
            copies_serial: r.copies_serial,
            rental_fee: fee,
          });
        }

        if (member.balance < finalPrice) {
          throw {
            type: 'business',
            status: 400,
            code: 'INSUFFICIENT_BALANCE',
            message: '會員餘額不足以支付租金',
          };
        }

        // 建立 BOOK_LOAN
        const loanSql = `
          INSERT INTO BOOK_LOAN (admin_id, member_id, final_price)
          VALUES ($1, $2, $3)
          RETURNING loan_id
        `;
        const loanRes = await client.query(loanSql, [adminId, member_id, finalPrice]);
        const loanId = loanRes.rows[0].loan_id;

        // 建立 LOAN_RECORD 並更新 BOOK_COPIES.status
        for (const item of perItemFees) {
          const recordSql = `
            INSERT INTO LOAN_RECORD (
              loan_id, book_id, copies_serial, date_out, due_date, rental_fee, renew_cnt
            ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + (INTERVAL '1 day' * $4), $5, 0)
          `;
          await client.query(recordSql, [
            loanId,
            item.book_id,
            item.copies_serial,
            member.hold_days,
            item.rental_fee,
          ]);

          const updCopySql = `
            UPDATE BOOK_COPIES
            SET status = 'Borrowed'
            WHERE book_id = $1 AND copies_serial = $2
          `;
          await client.query(updCopySql, [item.book_id, item.copies_serial]);
        }

        // 扣款
        const updMemberSql = `
          UPDATE MEMBER
          SET balance = balance - $1
          WHERE member_id = $2
          RETURNING member_id, balance
        `;
        const updMemberRes = await client.query(updMemberSql, [finalPrice, member_id]);

        return {
          loan_id: loanId,
          final_price: finalPrice,
          member: updMemberRes.rows[0],
        };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A6: 櫃檯辦理還書
adminRouter.post(
  '/loans/:loanId/items/:bookId/:copiesSerial/return',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const loanId = Number(req.params.loanId);
      const bookId = Number(req.params.bookId);
      const copiesSerial = Number(req.params.copiesSerial);
      const { final_condition, lost = false, immediateCharge = false } = req.body || {};

      if (!Number.isFinite(loanId) || !Number.isFinite(bookId) || !Number.isFinite(copiesSerial)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '參數格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        // 鎖定借閱紀錄與複本
        const recordSql = `
          SELECT 
            lr.loan_id,
            lr.book_id,
            lr.copies_serial,
            lr.date_out,
            lr.due_date,
            lr.return_date,
            lr.rental_fee,
            bl.member_id,
            m.balance,
            bc.book_condition AS original_condition,
            bc.purchase_price
          FROM LOAN_RECORD lr
          JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
          JOIN MEMBER m ON bl.member_id = m.member_id
          JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
          WHERE lr.loan_id = $1
            AND lr.book_id = $2
            AND lr.copies_serial = $3
          FOR UPDATE
        `;
        const recRes = await client.query(recordSql, [loanId, bookId, copiesSerial]);
        if (recRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'LOAN_ITEM_NOT_FOUND',
            message: '找不到借閱紀錄',
          };
        }
        const rec = recRes.rows[0];

        if (rec.return_date) {
          throw {
            type: 'business',
            status: 400,
            code: 'ALREADY_RETURNED',
            message: '已經還書',
          };
        }

        const todaySql = `SELECT CURRENT_DATE AS today`;
        const todayRes = await client.query(todaySql);
        const today = todayRes.rows[0].today;

        // 更新還書日期
        const updateReturnSql = `
          UPDATE LOAN_RECORD
          SET return_date = $1
          WHERE loan_id = $2 AND book_id = $3 AND copies_serial = $4
        `;
        await client.query(updateReturnSql, [today, loanId, bookId, copiesSerial]);

        let totalAddFee = 0;

        // 逾期罰金
        const overdueDaysSql = `
          SELECT GREATEST((CAST($1 AS DATE) - CAST($2 AS DATE)), 0) AS days
        `;
        const overdueDaysRes = await client.query(overdueDaysSql, [today, rec.due_date]);
        const overdueDays = Number(overdueDaysRes.rows[0].days);

        if (overdueDays > 0) {
          const feeTypeSql = `
            SELECT base_amount
            FROM FEE_TYPE
            WHERE type = 'overdue'
          `;
          const feeTypeRes = await client.query(feeTypeSql);
          const baseAmount =
            (feeTypeRes.rowCount && feeTypeRes.rowCount > 0
              ? Number(feeTypeRes.rows[0].base_amount)
              : 10) || 10;
          const amount = overdueDays * baseAmount;
          totalAddFee += amount;

          const insertOverdueSql = `
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES ($1, $2, $3, 'overdue', $4, $5)
          `;
          await client.query(insertOverdueSql, [loanId, bookId, copiesSerial, amount, today]);
        }

        // 書況 / 遺失
        let newCondition = rec.original_condition;
        if (lost) {
          // 遺失費用
          const feeTypeSql = `
            SELECT rate
            FROM FEE_TYPE
            WHERE type = 'lost'
          `;
          const feeTypeRes = await client.query(feeTypeSql);
          const rate =
            feeTypeRes.rowCount && feeTypeRes.rowCount > 0
              ? Number(feeTypeRes.rows[0].rate) || 1.0
              : 1.0;
          const amount = Math.round(rec.purchase_price * rate);
          totalAddFee += amount;

          const insertLostSql = `
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES ($1, $2, $3, 'lost', $4, $5)
          `;
          await client.query(insertLostSql, [loanId, bookId, copiesSerial, amount, today]);

          const updCopySql = `
            UPDATE BOOK_COPIES
            SET status = 'Lost'
            WHERE book_id = $1 AND copies_serial = $2
          `;
          await client.query(updCopySql, [bookId, copiesSerial]);
        } else if (final_condition && final_condition !== rec.original_condition) {
          newCondition = final_condition;

          let feeType: string | null = null;
          if (rec.original_condition === 'Good' && final_condition === 'Fair') {
            feeType = 'damage_good_to_fair';
          } else if (rec.original_condition === 'Good' && final_condition === 'Poor') {
            feeType = 'damage_good_to_poor';
          } else if (rec.original_condition === 'Fair' && final_condition === 'Poor') {
            feeType = 'damage_fair_to_poor';
          }

          if (feeType) {
            const feeTypeSql = `
              SELECT rate
              FROM FEE_TYPE
              WHERE type = $1
            `;
            const feeTypeRes = await client.query(feeTypeSql, [feeType]);
            const rate =
              feeTypeRes.rowCount && feeTypeRes.rowCount > 0
                ? Number(feeTypeRes.rows[0].rate) || 0
                : 0;
            const amount = Math.round(rec.purchase_price * rate);
            if (amount > 0) {
              totalAddFee += amount;
              const insertDamageSql = `
                INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
                VALUES ($1, $2, $3, $4, $5, $6)
              `;
              await client.query(insertDamageSql, [
                loanId,
                bookId,
                copiesSerial,
                feeType,
                amount,
                today,
              ]);
            }
          }

          // Calculate new rental_price based on new condition
          const discountSql = `
            SELECT discount_factor
            FROM CONDITION_DISCOUNT
            WHERE book_condition = $1
          `;
          const discountRes = await client.query(discountSql, [newCondition]);
          if (discountRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 400,
              code: 'INVALID_CONDITION',
              message: '無效的書況',
            };
          }
          const discount = Number(discountRes.rows[0].discount_factor);

          // Get book price
          const priceSql = `SELECT price FROM BOOK WHERE book_id = $1`;
          const priceRes = await client.query(priceSql, [bookId]);
          if (priceRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 404,
              code: 'BOOK_NOT_FOUND',
              message: '找不到書籍',
            };
          }
          const bookPrice = Number(priceRes.rows[0].price);
          const newRentalPrice = Math.round(bookPrice * discount);

          // Update book condition, status, and rental_price
          const updCopySql = `
            UPDATE BOOK_COPIES
            SET book_condition = $1,
                status = 'Available',
                rental_price = $2
            WHERE book_id = $3 AND copies_serial = $4
          `;
          await client.query(updCopySql, [newCondition, newRentalPrice, bookId, copiesSerial]);
        } else {
          // 沒變化，單純歸還
          const updCopySql = `
            UPDATE BOOK_COPIES
            SET status = 'Available'
            WHERE book_id = $1 AND copies_serial = $2
          `;
          await client.query(updCopySql, [bookId, copiesSerial]);
        }

        let memberAfter: any = { member_id: rec.member_id, balance: rec.balance };
        if (immediateCharge && totalAddFee > 0) {
          const updMemberSql = `
            UPDATE MEMBER
            SET balance = balance - $1
            WHERE member_id = $2
            RETURNING member_id, balance
          `;
          const updMemberRes = await client.query(updMemberSql, [totalAddFee, rec.member_id]);
          memberAfter = updMemberRes.rows[0];
        }

        return {
          loan_id: loanId,
          book_id: bookId,
          copies_serial: copiesSerial,
          total_add_fee: totalAddFee,
          member: memberAfter,
        };
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A7: Admin 續借（沿用邏輯，主要是權限不同）
adminRouter.post(
  '/loans/:loanId/items/:bookId/:copiesSerial/renew',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      // 直接呼叫與 member 邏輯相同，只是不檢查 member_id 是否一致
      const loanId = Number(req.params.loanId);
      const bookId = Number(req.params.bookId);
      const copiesSerial = Number(req.params.copiesSerial);

      if (!Number.isFinite(loanId) || !Number.isFinite(bookId) || !Number.isFinite(copiesSerial)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '參數格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        const loanSql = `
          SELECT 
            lr.loan_id,
            lr.book_id,
            lr.copies_serial,
            lr.due_date,
            lr.return_date,
            lr.renew_cnt,
            bl.member_id,
            m.status AS member_status,
            m.balance,
            l.hold_days
          FROM LOAN_RECORD lr
          JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
          JOIN MEMBER m ON bl.member_id = m.member_id
          JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
          WHERE lr.loan_id = $1
            AND lr.book_id = $2
            AND lr.copies_serial = $3
          FOR UPDATE
        `;
        const loanRes = await client.query(loanSql, [loanId, bookId, copiesSerial]);
        if (loanRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'LOAN_ITEM_NOT_FOUND',
            message: '找不到借閱紀錄',
          };
        }
        const row = loanRes.rows[0];

        if (row.return_date) {
          throw {
            type: 'business',
            status: 400,
            code: 'ALREADY_RETURNED',
            message: '已經還書，無法續借',
          };
        }
        if (row.renew_cnt >= 1) {
          throw {
            type: 'business',
            status: 400,
            code: 'RENEW_LIMIT_REACHED',
            message: '已達續借次數上限',
          };
        }
        if (row.member_status !== 'Active') {
          throw {
            type: 'business',
            status: 400,
            code: 'MEMBER_INACTIVE',
            message: '會員狀態不可續借',
          };
        }

        // 續借費用固定為 $10
        const renewFee: number = 10;
        if (row.balance < renewFee) {
          throw {
            type: 'business',
            status: 400,
            code: 'INSUFFICIENT_BALANCE',
            message: '會員餘額不足以支付續借費用',
          };
        }

        const updLoanSql = `
          UPDATE LOAN_RECORD
          SET renew_cnt = renew_cnt + 1,
              due_date = due_date + (INTERVAL '1 day' * $1)
          WHERE loan_id = $2 AND book_id = $3 AND copies_serial = $4
          RETURNING *
        `;
        const updLoanRes = await client.query(updLoanSql, [
          row.hold_days || 7,
          loanId,
          bookId,
          copiesSerial,
        ]);

        const insertFeeSql = `
          INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
          VALUES ($1, $2, $3, 'renew', $4, CURRENT_DATE)
          RETURNING *
        `;
        const feeRes = await client.query(insertFeeSql, [loanId, bookId, copiesSerial, renewFee]);

        const updMemberSql = `
          UPDATE MEMBER
          SET balance = balance - $1
          WHERE member_id = $2
          RETURNING member_id, balance
        `;
        const memberRes = await client.query(updMemberSql, [renewFee, row.member_id]);

        return {
          loan: updLoanRes.rows[0],
          fee: feeRes.rows[0],
          member: memberRes.rows[0],
        };
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A8: Admin 管理預約
adminRouter.get(
  '/reservations',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const status = (req.query.status as string) || undefined;
      const memberIdParam = req.query.member_id as string | undefined;
      const bookNameParam = req.query.book_name as string | undefined;
      
      const params: any[] = [];
      const conditions: string[] = [];
      
      // Status filter
      if (status) {
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
      }
      
      // Member ID filter
      if (memberIdParam) {
        const memberId = Number(memberIdParam);
        if (Number.isFinite(memberId)) {
          params.push(memberId);
          conditions.push(`r.member_id = $${params.length}`);
        }
      }
      
      // Book name filter - use subquery to filter reservations containing books matching the name
      if (bookNameParam) {
        params.push(`%${bookNameParam}%`);
        conditions.push(`r.reservation_id IN (
          SELECT DISTINCT rr2.reservation_id
          FROM RESERVATION_RECORD rr2
          JOIN BOOK b2 ON rr2.book_id = b2.book_id
          WHERE b2.name ILIKE $${params.length}
        )`);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const sql = `
        SELECT 
          r.*,
          m.name AS member_name,
          json_agg(
            jsonb_build_object(
              'book_id', b.book_id,
              'name', b.name
            )
          ) AS books
        FROM RESERVATION r
        JOIN MEMBER m ON r.member_id = m.member_id
        JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
        JOIN BOOK b ON rr.book_id = b.book_id
        ${whereClause}
        GROUP BY r.reservation_id, m.name
        ORDER BY r.reserve_date DESC, r.reservation_id DESC
      `;

      const result = await query(sql, params);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.post(
  '/reservations/:reservationId/fulfill',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const reservationId = Number(req.params.reservationId);
      const { items } = req.body || {};
      const adminId = req.admin!.admin_id;

      if (!Number.isFinite(reservationId) || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'reservationId 或 items 格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        const resSql = `
          SELECT * FROM RESERVATION
          WHERE reservation_id = $1
          FOR UPDATE
        `;
        const resRes = await client.query(resSql, [reservationId]);
        if (resRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'RESERVATION_NOT_FOUND',
            message: '找不到預約',
          };
        }
        const reservation = resRes.rows[0];

        if (reservation.status !== 'Active') {
          throw {
            type: 'business',
            status: 400,
            code: 'RESERVATION_NOT_ACTIVE',
            message: '預約狀態不可兌現',
          };
        }

        // 直接重用借書邏輯：這裡簡化為組成 request，再手動走一次借書流程
        const fakeReqBody = {
          member_id: reservation.member_id,
          items,
        };

        // 借書邏輯：直接呼叫上面 A5 內部 transaction 的部分很難重用，這裡簡單重新實作或抽成 service
        // 為避免程式過長，這裡簡化：只更新 RESERVATION.status = 'Fulfilled'，實際借書仍由前端呼叫 /admin/loans。
        // 若要完整實作，可將 A5 的 transaction 抽成共用函式。

        const updResSql = `
          UPDATE RESERVATION
          SET status = 'Fulfilled', pickup_date = CURRENT_DATE
          WHERE reservation_id = $1
        `;
        await client.query(updResSql, [reservationId]);

        return {
          reservation_id: reservationId,
          member_id: reservation.member_id,
          items: fakeReqBody.items,
          admin_id: adminId,
        };
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A9: 管理 FEE_TYPE
adminRouter.get(
  '/fee-types',
  requireAdmin,
  async (_req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const sql = `
        SELECT type, base_amount, rate
        FROM FEE_TYPE
        ORDER BY type
      `;
      const result = await query(sql, []);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A10 報表：直接共用 /api/stats 下端點，由前端決定呼叫哪個路徑

// A11: 搜尋會員
adminRouter.get(
  '/members/search',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = req.query.memberId as string | undefined;
      const name = req.query.name as string | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 100;

      if (page < 1 || limit < 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'page 和 limit 必須大於 0' },
        });
      }

      const offset = (page - 1) * limit;

      const params: any[] = [];
      const conditions: string[] = [];

      if (memberId) {
        const id = Number(memberId);
        if (Number.isFinite(id)) {
          params.push(id);
          conditions.push(`m.member_id = $${params.length}`);
        }
      }

      if (name) {
        params.push(`%${name}%`);
        conditions.push(`m.name ILIKE $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countSql = `
        SELECT COUNT(*) AS total
        FROM MEMBER m
        ${whereClause}
      `;
      const countResult = await query(countSql, params);
      const total = Number(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      // Get paginated results
      const sql = `
        SELECT 
          m.member_id,
          m.name,
          m.phone,
          m.email,
          m.status,
          m.balance,
          m.join_date
        FROM MEMBER m
        ${whereClause}
        ORDER BY m.member_id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const result = await query(sql, [...params, limit, offset]);
      return res.json({
        success: true,
        data: {
          members: result.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// A12: 取得會員詳細資訊
adminRouter.get(
  '/members/:memberId',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = Number(req.params.memberId);
      if (!Number.isFinite(memberId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'memberId 格式錯誤' },
        });
      }

      const memberSql = `
        SELECT 
          m.*,
          l.level_id,
          l.level_name,
          l.discount_rate,
          l.max_book_allowed,
          l.hold_days,
          l.min_balance_required
        FROM MEMBER m
        JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
        WHERE m.member_id = $1
      `;
      const memberResult = await query(memberSql, [memberId]);
      if (memberResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'MEMBER_NOT_FOUND', message: '找不到會員' },
        });
      }

      const topUpSql = `
        SELECT 
          t.top_up_id,
          t.amount,
          t.top_up_date,
          a.name AS admin_name
        FROM TOP_UP t
        JOIN ADMIN a ON t.admin_id = a.admin_id
        WHERE t.member_id = $1
        ORDER BY t.top_up_date DESC, t.top_up_id DESC
      `;
      const topUpResult = await query(topUpSql, [memberId]);

      return res.json({
        success: true,
        data: {
          ...memberResult.rows[0],
          top_ups: topUpResult.rows,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// A13: 新增儲值
adminRouter.post(
  '/members/:memberId/top-up',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = Number(req.params.memberId);
      const { amount } = req.body || {};
      const adminId = req.admin!.admin_id;

      if (!Number.isFinite(memberId) || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'memberId 或 amount 格式錯誤' },
        });
      }

      const result = await withTransaction(async (client) => {
        // Check if member exists
        const memberCheckSql = `SELECT member_id, status FROM MEMBER WHERE member_id = $1 FOR UPDATE`;
        const memberCheckRes = await client.query(memberCheckSql, [memberId]);
        if (memberCheckRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'MEMBER_NOT_FOUND',
            message: '找不到會員',
          };
        }

        const member = memberCheckRes.rows[0];
        // Check if member status is active
        if (member.status !== 'Active') {
          throw {
            type: 'business',
            status: 400,
            code: 'MEMBER_INACTIVE',
            message: '會員狀態不可儲值',
          };
        }

        // Insert TOP_UP record
        const topUpSql = `
          INSERT INTO TOP_UP (member_id, admin_id, amount, top_up_date)
          VALUES ($1, $2, $3, CURRENT_DATE)
          RETURNING *
        `;
        const topUpRes = await client.query(topUpSql, [memberId, adminId, amount]);

        // Update member balance
        const updateBalanceSql = `
          UPDATE MEMBER
          SET balance = balance + $1
          WHERE member_id = $2
          RETURNING balance
        `;
        const balanceRes = await client.query(updateBalanceSql, [amount, memberId]);
        const newBalance = Number(balanceRes.rows[0].balance);

        // Determine new membership level based on single top-up amount
        const levelSql = `
          SELECT level_id
          FROM MEMBERSHIP_LEVEL
          WHERE min_balance_required <= $1
          ORDER BY min_balance_required DESC
          LIMIT 1
        `;
        const levelRes = await client.query(levelSql, [amount]);
        if (levelRes.rowCount && levelRes.rowCount > 0) {
          const newLevelId = levelRes.rows[0].level_id;
          const updateLevelSql = `
            UPDATE MEMBER
            SET level_id = $1
            WHERE member_id = $2
            RETURNING level_id
          `;
          await client.query(updateLevelSql, [newLevelId, memberId]);
        }

        // Get updated member info
        const memberSql = `
          SELECT 
            m.*,
            l.level_name,
            l.discount_rate,
            l.max_book_allowed,
            l.hold_days
          FROM MEMBER m
          JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
          WHERE m.member_id = $1
        `;
        const memberRes = await client.query(memberSql, [memberId]);

        return {
          top_up: topUpRes.rows[0],
          member: memberRes.rows[0],
        };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// A14: 取得會員借閱紀錄
adminRouter.get(
  '/members/:memberId/loans',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = Number(req.params.memberId);
      if (!Number.isFinite(memberId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'memberId 格式錯誤' },
        });
      }

      const sql = `
        SELECT 
          bl.loan_id,
          bl.final_price,
          bl.member_id,
          a.name AS admin_name,
          MIN(lr.date_out) AS loan_date,
          COUNT(lr.loan_id) AS item_count,
          COUNT(CASE WHEN lr.return_date IS NULL THEN 1 END) AS active_count
        FROM BOOK_LOAN bl
        JOIN ADMIN a ON bl.admin_id = a.admin_id
        LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
        WHERE bl.member_id = $1
        GROUP BY bl.loan_id, bl.final_price, bl.member_id, a.name
        ORDER BY bl.loan_id DESC
      `;

      const result = await query(sql, [memberId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A15: 取得借閱紀錄詳情
adminRouter.get(
  '/loans/:loanId/records',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const loanId = Number(req.params.loanId);
      if (!Number.isFinite(loanId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'loanId 格式錯誤' },
        });
      }

      const sql = `
        SELECT 
          lr.loan_id,
          lr.book_id,
          lr.copies_serial,
          lr.date_out,
          lr.due_date,
          lr.return_date,
          lr.rental_fee,
          lr.renew_cnt,
          b.name AS book_name,
          b.author,
          b.publisher,
          bc.book_condition,
          COALESCE((
            SELECT json_agg(
              json_build_object(
                'type', af.type,
                'amount', af.amount,
                'date', af.date
              )
            )
            FROM ADD_FEE af
            WHERE af.loan_id = lr.loan_id
              AND af.book_id = lr.book_id
              AND af.copies_serial = lr.copies_serial
          ), '[]'::json) AS add_fees
        FROM LOAN_RECORD lr
        JOIN BOOK b ON lr.book_id = b.book_id
        JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
        WHERE lr.loan_id = $1
        ORDER BY lr.date_out DESC, lr.book_id ASC, lr.copies_serial ASC
      `;

      const result = await query(sql, [loanId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// A16: 搜尋借閱記錄（用於還書介面）
adminRouter.get(
  '/loans/search',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const searchType = req.query.type as string;
      const loanIdParam = req.query.loan_id as string | undefined;
      const memberIdParam = req.query.member_id as string | undefined;

      if (searchType !== 'loan_id' && searchType !== 'member_id') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_SEARCH_TYPE', message: '搜尋類型必須為 loan_id 或 member_id' },
        });
      }

      let loans: any[] = [];

      if (searchType === 'loan_id') {
        const loanId = Number(loanIdParam);
        if (!Number.isFinite(loanId)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_LOAN_ID', message: 'loan_id 格式錯誤' },
          });
        }

        // Query BOOK_LOAN and its LOAN_RECORDS (only unreturned)
        const sql = `
          SELECT 
            bl.loan_id,
            bl.member_id,
            m.name AS member_name,
            MIN(lr.date_out) AS loan_date,
            MAX(lr.due_date) AS max_due_date,
            COALESCE(
              json_agg(
                jsonb_build_object(
                  'loan_id', lr.loan_id,
                  'book_id', lr.book_id,
                  'copies_serial', lr.copies_serial,
                  'book_name', b.name,
                  'original_condition', bc.book_condition,
                  'date_out', lr.date_out,
                  'due_date', lr.due_date,
                  'return_date', lr.return_date,
                  'rental_fee', lr.rental_fee,
                  'purchase_price', bc.purchase_price
                )
              ) FILTER (WHERE lr.loan_id IS NOT NULL),
              '[]'::json
            ) AS records
          FROM BOOK_LOAN bl
          JOIN MEMBER m ON bl.member_id = m.member_id
          LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id AND lr.return_date IS NULL
          LEFT JOIN BOOK b ON lr.book_id = b.book_id
          LEFT JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
          WHERE bl.loan_id = $1
          GROUP BY bl.loan_id, bl.member_id, m.name
          HAVING COUNT(lr.loan_id) FILTER (WHERE lr.return_date IS NULL) > 0
        `;

        const result = await query(sql, [loanId]);
        loans = result.rows.map((row: any) => ({
          loan_id: row.loan_id,
          member_id: row.member_id,
          member_name: row.member_name,
          loan_date: row.loan_date,
          max_due_date: row.max_due_date,
          records: row.records || [],
        }));
      } else if (searchType === 'member_id') {
        const memberId = Number(memberIdParam);
        if (!Number.isFinite(memberId)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_MEMBER_ID', message: 'member_id 格式錯誤' },
          });
        }

        // Query all BOOK_LOANs for the member with unreturned LOAN_RECORDS
        const sql = `
          SELECT 
            bl.loan_id,
            bl.member_id,
            m.name AS member_name,
            MIN(lr.date_out) AS loan_date,
            MAX(lr.due_date) AS max_due_date,
            COALESCE(
              json_agg(
                jsonb_build_object(
                  'loan_id', lr.loan_id,
                  'book_id', lr.book_id,
                  'copies_serial', lr.copies_serial,
                  'book_name', b.name,
                  'original_condition', bc.book_condition,
                  'date_out', lr.date_out,
                  'due_date', lr.due_date,
                  'return_date', lr.return_date,
                  'rental_fee', lr.rental_fee,
                  'purchase_price', bc.purchase_price
                )
              ) FILTER (WHERE lr.loan_id IS NOT NULL),
              '[]'::json
            ) AS records
          FROM BOOK_LOAN bl
          JOIN MEMBER m ON bl.member_id = m.member_id
          LEFT JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id AND lr.return_date IS NULL
          LEFT JOIN BOOK b ON lr.book_id = b.book_id
          LEFT JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
          WHERE bl.member_id = $1
          GROUP BY bl.loan_id, bl.member_id, m.name
          HAVING COUNT(lr.loan_id) FILTER (WHERE lr.return_date IS NULL) > 0
          ORDER BY bl.loan_id DESC
        `;

        const result = await query(sql, [memberId]);
        loans = result.rows.map((row: any) => ({
          loan_id: row.loan_id,
          member_id: row.member_id,
          member_name: row.member_name,
          loan_date: row.loan_date,
          max_due_date: row.max_due_date,
          records: row.records || [],
        }));
      }

      return res.json({ success: true, data: { loans } });
    } catch (err) {
      next(err);
    }
  }
);

// A17: 罰金試算 API
adminRouter.post(
  '/loans/calculate-fines',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { items } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'items 必須為非空陣列' },
        });
      }

      const todaySql = `SELECT CURRENT_DATE AS today`;
      const todayRes = await query(todaySql);
      const today = todayRes.rows[0].today;

      // Get fee types
      const feeTypesSql = `
        SELECT type, base_amount, rate
        FROM FEE_TYPE
      `;
      const feeTypesRes = await query(feeTypesSql);
      const feeTypesMap: Record<string, { base_amount?: number; rate?: number }> = {};
      feeTypesRes.rows.forEach((row: any) => {
        feeTypesMap[row.type] = {
          base_amount: row.base_amount ? Number(row.base_amount) : undefined,
          rate: row.rate ? Number(row.rate) : undefined,
        };
      });

      const results = await Promise.all(
        items.map(async (item: any) => {
          const { loan_id, book_id, copies_serial, final_condition, lost, due_date, purchase_price, original_condition } = item;

          let overdueDays = 0;
          let overdueFee = 0;
          let damageFee = 0;
          let lostFee = 0;

          // Calculate overdue days and fee
          if (due_date) {
            const overdueDaysSql = `SELECT GREATEST((CAST($1 AS DATE) - CAST($2 AS DATE)), 0) AS days`;
            const overdueDaysRes = await query(overdueDaysSql, [today, due_date]);
            overdueDays = Number(overdueDaysRes.rows[0].days);

            if (overdueDays > 0 && feeTypesMap['overdue']?.base_amount) {
              overdueFee = overdueDays * feeTypesMap['overdue'].base_amount!;
            }
          }

          // Calculate lost fee
          if (lost && purchase_price && feeTypesMap['lost']?.rate) {
            lostFee = Math.round(purchase_price * feeTypesMap['lost'].rate!);
          }

          // Calculate damage fee
          if (!lost && final_condition && final_condition !== original_condition && purchase_price) {
            let feeType: string | null = null;
            if (original_condition === 'Good' && final_condition === 'Fair') {
              feeType = 'damage_good_to_fair';
            } else if (original_condition === 'Good' && final_condition === 'Poor') {
              feeType = 'damage_good_to_poor';
            } else if (original_condition === 'Fair' && final_condition === 'Poor') {
              feeType = 'damage_fair_to_poor';
            }

            if (feeType && feeTypesMap[feeType]?.rate) {
              damageFee = Math.round(purchase_price * feeTypesMap[feeType].rate!);
            }
          }

          const total = overdueFee + damageFee + lostFee;

          return {
            loan_id,
            book_id,
            copies_serial,
            fine_breakdown: {
              overdue_fee: overdueFee,
              damage_fee: damageFee,
              lost_fee: lostFee,
              total,
            },
            overdue_days: overdueDays,
          };
        })
      );

      return res.json({ success: true, data: { items: results } });
    } catch (err) {
      next(err);
    }
  }
);

// Helper function to process a single return item
async function processReturnItem(
  client: any,
  loanId: number,
  bookId: number,
  copiesSerial: number,
  finalCondition: string | undefined,
  lost: boolean,
  immediateCharge: boolean
): Promise<{ success: boolean; total_add_fee?: number; error?: string }> {
  try {
    // Lock the loan record and copy
    const recordSql = `
      SELECT 
        lr.loan_id,
        lr.book_id,
        lr.copies_serial,
        lr.date_out,
        lr.due_date,
        lr.return_date,
        lr.rental_fee,
        bl.member_id,
        m.balance,
        bc.book_condition AS original_condition,
        bc.purchase_price
      FROM LOAN_RECORD lr
      JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
      JOIN MEMBER m ON bl.member_id = m.member_id
      JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
      WHERE lr.loan_id = $1
        AND lr.book_id = $2
        AND lr.copies_serial = $3
      FOR UPDATE
    `;
    const recRes = await client.query(recordSql, [loanId, bookId, copiesSerial]);
    if (recRes.rowCount === 0) {
      return { success: false, error: '找不到借閱紀錄' };
    }
    const rec = recRes.rows[0];

    if (rec.return_date) {
      return { success: false, error: '已經還書' };
    }

    const todaySql = `SELECT CURRENT_DATE AS today`;
    const todayRes = await client.query(todaySql);
    const today = todayRes.rows[0].today;

    // Update return date
    const updateReturnSql = `
      UPDATE LOAN_RECORD
      SET return_date = $1
      WHERE loan_id = $2 AND book_id = $3 AND copies_serial = $4
    `;
    await client.query(updateReturnSql, [today, loanId, bookId, copiesSerial]);

    let totalAddFee = 0;

    // Calculate overdue fee
    const overdueDaysSql = `SELECT GREATEST((CAST($1 AS DATE) - CAST($2 AS DATE)), 0) AS days`;
    const overdueDaysRes = await client.query(overdueDaysSql, [today, rec.due_date]);
    const overdueDays = Number(overdueDaysRes.rows[0].days);

    if (overdueDays > 0) {
      const feeTypeSql = `SELECT base_amount FROM FEE_TYPE WHERE type = 'overdue'`;
      const feeTypeRes = await client.query(feeTypeSql);
      const baseAmount = feeTypeRes.rowCount && feeTypeRes.rowCount > 0 ? Number(feeTypeRes.rows[0].base_amount) || 10 : 10;
      const amount = overdueDays * baseAmount;
      totalAddFee += amount;

      const insertOverdueSql = `
        INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
        VALUES ($1, $2, $3, 'overdue', $4, $5)
      `;
      await client.query(insertOverdueSql, [loanId, bookId, copiesSerial, amount, today]);
    }

    // Handle lost or damage
    let newCondition = rec.original_condition;
    if (lost) {
      // Lost fee
      const feeTypeSql = `SELECT rate FROM FEE_TYPE WHERE type = 'lost'`;
      const feeTypeRes = await client.query(feeTypeSql);
      const rate = feeTypeRes.rowCount && feeTypeRes.rowCount > 0 ? Number(feeTypeRes.rows[0].rate) || 1.0 : 1.0;
      const amount = Math.round(rec.purchase_price * rate);
      totalAddFee += amount;

      const insertLostSql = `
        INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
        VALUES ($1, $2, $3, 'lost', $4, $5)
      `;
      await client.query(insertLostSql, [loanId, bookId, copiesSerial, amount, today]);

      const updCopySql = `
        UPDATE BOOK_COPIES
        SET status = 'Lost'
        WHERE book_id = $1 AND copies_serial = $2
      `;
      await client.query(updCopySql, [bookId, copiesSerial]);
    } else if (finalCondition && finalCondition !== rec.original_condition) {
      newCondition = finalCondition;

      let feeType: string | null = null;
      if (rec.original_condition === 'Good' && finalCondition === 'Fair') {
        feeType = 'damage_good_to_fair';
      } else if (rec.original_condition === 'Good' && finalCondition === 'Poor') {
        feeType = 'damage_good_to_poor';
      } else if (rec.original_condition === 'Fair' && finalCondition === 'Poor') {
        feeType = 'damage_fair_to_poor';
      }

      if (feeType) {
        const feeTypeSql = `SELECT rate FROM FEE_TYPE WHERE type = $1`;
        const feeTypeRes = await client.query(feeTypeSql, [feeType]);
        const rate = feeTypeRes.rowCount && feeTypeRes.rowCount > 0 ? Number(feeTypeRes.rows[0].rate) || 0 : 0;
        const amount = Math.round(rec.purchase_price * rate);
        if (amount > 0) {
          totalAddFee += amount;
          const insertDamageSql = `
            INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          await client.query(insertDamageSql, [loanId, bookId, copiesSerial, feeType, amount, today]);
        }
      }

      // Calculate new rental_price based on new condition
      const discountSql = `
        SELECT discount_factor
        FROM CONDITION_DISCOUNT
        WHERE book_condition = $1
      `;
      const discountRes = await client.query(discountSql, [newCondition]);
      if (discountRes.rowCount === 0) {
        return { success: false, error: '無效的書況' };
      }
      const discount = Number(discountRes.rows[0].discount_factor);

      // Get book price
      const priceSql = `SELECT price FROM BOOK WHERE book_id = $1`;
      const priceRes = await client.query(priceSql, [bookId]);
      if (priceRes.rowCount === 0) {
        return { success: false, error: '找不到書籍' };
      }
      const bookPrice = Number(priceRes.rows[0].price);
      const newRentalPrice = Math.round(bookPrice * discount);

      // Update book condition, status, and rental_price
      const updCopySql = `
        UPDATE BOOK_COPIES
        SET book_condition = $1,
            status = 'Available',
            rental_price = $2
        WHERE book_id = $3 AND copies_serial = $4
      `;
      await client.query(updCopySql, [newCondition, newRentalPrice, bookId, copiesSerial]);
    } else {
      // No change, just return
      const updCopySql = `
        UPDATE BOOK_COPIES
        SET status = 'Available'
        WHERE book_id = $1 AND copies_serial = $2
      `;
      await client.query(updCopySql, [bookId, copiesSerial]);
    }

    // Charge member if requested
    if (immediateCharge && totalAddFee > 0) {
      const updMemberSql = `
        UPDATE MEMBER
        SET balance = balance - $1
        WHERE member_id = $2
      `;
      await client.query(updMemberSql, [totalAddFee, rec.member_id]);
    }

    return { success: true, total_add_fee: totalAddFee };
  } catch (err: any) {
    return { success: false, error: err.message || '處理還書時發生錯誤' };
  }
}

// A18: 批次還書 API
adminRouter.post(
  '/loans/batch-return',
  requireAdmin,
  async (req: AuthedRequest, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { items } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'items 必須為非空陣列' },
        });
      }

      const result = await withTransaction(async (client) => {
        const results = await Promise.all(
          items.map(async (item: any) => {
            const { loan_id, book_id, copies_serial, final_condition, lost = false, immediateCharge = false } = item;

            if (!Number.isFinite(loan_id) || !Number.isFinite(book_id) || !Number.isFinite(copies_serial)) {
              return {
                loan_id,
                book_id,
                copies_serial,
                success: false,
                error: '參數格式錯誤',
              };
            }

            const returnResult = await processReturnItem(
              client,
              loan_id,
              book_id,
              copies_serial,
              final_condition,
              lost,
              immediateCharge
            );

            return {
              loan_id,
              book_id,
              copies_serial,
              success: returnResult.success,
              error: returnResult.error,
              total_add_fee: returnResult.total_add_fee,
            };
          })
        );

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        return {
          success_count: successCount,
          fail_count: failCount,
          results,
        };
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);


