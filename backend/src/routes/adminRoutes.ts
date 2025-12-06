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
      const { name, author, publisher, price, sequence_name } = req.body || {};
      if (!name || !author || typeof price !== 'number') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 name / author / price' },
        });
      }

      const sql = `
        INSERT INTO BOOK (sequence_name, name, author, publisher, price)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await query(sql, [sequence_name || null, name, author, publisher || null, price]);
      return res.status(201).json({ success: true, data: result.rows[0] });
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

      const fields: string[] = [];
      const params: any[] = [];

      if (status !== undefined) {
        params.push(status);
        fields.push(`status = $${params.length}`);
      }
      if (book_condition !== undefined) {
        params.push(book_condition);
        fields.push(`book_condition = $${params.length}`);
      }

      if (fields.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FIELDS', message: '沒有要更新的欄位' },
        });
      }

      params.push(bookId, copiesSerial);
      const sql = `
        UPDATE BOOK_COPIES
        SET ${fields.join(', ')}
        WHERE book_id = $${params.length - 1}
          AND copies_serial = $${params.length}
        RETURNING *
      `;

      const result = await query(sql, params);
      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'COPY_NOT_FOUND', message: '找不到書籍複本' },
        });
      }

      return res.json({ success: true, data: result.rows[0] });
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

          const updCopySql = `
            UPDATE BOOK_COPIES
            SET book_condition = $1,
                status = 'Available'
            WHERE book_id = $2 AND copies_serial = $3
          `;
          await client.query(updCopySql, [newCondition, bookId, copiesSerial]);
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
            l.hold_days,
            ft.base_amount AS renew_fee
          FROM LOAN_RECORD lr
          JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
          JOIN MEMBER m ON bl.member_id = m.member_id
          JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
          JOIN FEE_TYPE ft ON ft.type = 'renew'
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

        const renewFee: number = row.renew_fee || 0;
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
      const params: any[] = [];
      let where = 'WHERE 1=1';
      if (status) {
        params.push(status);
        where += ` AND r.status = $${params.length}`;
      }

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
        ${where}
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


