import { Router, Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../db';
import { ApiResponse } from '../types';

export const memberRouter = Router();

// 取得 member_id（簡化版：先從 query 或 header）
function getMemberId(req: Request): number | null {
  const fromHeader = req.header('x-member-id');
  const fromQuery = req.query.memberId as string | undefined;
  const raw = fromHeader || fromQuery;
  const id = raw ? Number(raw) : NaN;
  return Number.isFinite(id) ? id : null;
}

// M0: Member 登入
memberRouter.post(
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
        SELECT member_id, name, phone, status
        FROM MEMBER
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

      const member = result.rows[0] as any;

      // Check if password (phone) matches
      if (member.phone !== phone) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: '密碼錯誤' },
        });
      }

      // Check if member status is active
      if (member.status !== 'Active') {
        return res.status(403).json({
          success: false,
          error: { code: 'MEMBER_INACTIVE', message: '會員帳號未啟用' },
        });
      }

      return res.json({
        success: true,
        data: {
          member_id: member.member_id,
          name: member.name,
          phone: member.phone,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// M1: 取得會員個人資料
memberRouter.get(
  '/profile',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = getMemberId(req);
      if (!memberId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_MEMBER', message: '缺少或錯誤的 member_id' },
        });
      }

      const sql = `
        SELECT 
          m.*,
          l.discount_rate,
          l.max_book_allowed,
          l.hold_days,
          COALESCE((
            SELECT COUNT(*)
            FROM LOAN_RECORD lr
            JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
            WHERE bl.member_id = m.member_id
              AND lr.return_date IS NULL
          ), 0) AS active_loans
        FROM MEMBER m
        JOIN MEMBERSHIP_LEVEL l ON m.level_id = l.level_id
        WHERE m.member_id = $1
      `;

      const result = await query(sql, [memberId]);
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

// M5: 查詢會員預約
memberRouter.get(
  '/reservations',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = getMemberId(req);
      if (!memberId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_MEMBER', message: '缺少或錯誤的 member_id' },
        });
      }

      const sql = `
        SELECT 
          r.*,
          json_agg(
            json_build_object(
              'book_id', b.book_id,
              'name', b.name,
              'author', b.author,
              'publisher', b.publisher
            )
          ) AS books
        FROM RESERVATION r
        JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
        JOIN BOOK b ON rr.book_id = b.book_id
        WHERE r.member_id = $1
        GROUP BY r.reservation_id
        ORDER BY r.reserve_date DESC, r.reservation_id DESC
      `;

      const result = await query(sql, [memberId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// M5: 取消預約
memberRouter.delete(
  '/reservations/:reservationId',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = getMemberId(req);
      const reservationId = Number(req.params.reservationId);

      if (!memberId || !Number.isFinite(reservationId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少或錯誤的 member_id / reservationId' },
        });
      }

      const sql = `
        UPDATE RESERVATION
        SET status = 'Cancelled'
        WHERE reservation_id = $1
          AND member_id = $2
          AND status = 'Active'
        RETURNING *
      `;

      const result = await query(sql, [reservationId, memberId]);
      if (result.rowCount === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_CANCEL',
            message: '預約不存在、非該會員，或狀態不可取消',
          },
        });
      }

      return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// M6: 目前借閱中的書
memberRouter.get(
  '/loans/active',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = getMemberId(req);
      if (!memberId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_MEMBER', message: '缺少或錯誤的 member_id' },
        });
      }

      const sql = `
        SELECT 
          bl.loan_id,
          bl.final_price,
          lr.book_id,
          lr.copies_serial,
          lr.date_out,
          lr.due_date,
          lr.rental_fee,
          lr.renew_cnt,
          b.name AS book_name,
          b.author,
          b.publisher,
          bc.book_condition,
          COALESCE((
            SELECT SUM(af.amount)
            FROM ADD_FEE af
            WHERE af.loan_id = lr.loan_id
              AND af.book_id = lr.book_id
              AND af.copies_serial = lr.copies_serial
          ), 0) AS add_fee_total
        FROM BOOK_LOAN bl
        JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
        JOIN BOOK b ON lr.book_id = b.book_id
        JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
        WHERE bl.member_id = $1
          AND lr.return_date IS NULL
        ORDER BY lr.date_out DESC, bl.loan_id DESC
      `;

      const result = await query(sql, [memberId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// M6: 歷史借閱紀錄
memberRouter.get(
  '/loans/history',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = getMemberId(req);
      if (!memberId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_MEMBER', message: '缺少或錯誤的 member_id' },
        });
      }

      const sql = `
        SELECT 
          bl.loan_id,
          bl.final_price,
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
            SELECT SUM(af.amount)
            FROM ADD_FEE af
            WHERE af.loan_id = lr.loan_id
              AND af.book_id = lr.book_id
              AND af.copies_serial = lr.copies_serial
          ), 0) AS add_fee_total
        FROM BOOK_LOAN bl
        JOIN LOAN_RECORD lr ON bl.loan_id = lr.loan_id
        JOIN BOOK b ON lr.book_id = b.book_id
        JOIN BOOK_COPIES bc ON lr.book_id = bc.book_id AND lr.copies_serial = bc.copies_serial
        WHERE bl.member_id = $1
          AND lr.return_date IS NOT NULL
        ORDER BY lr.return_date DESC, bl.loan_id DESC
      `;

      const result = await query(sql, [memberId]);
      return res.json({ success: true, data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// M7: 會員線上申請續借
memberRouter.post(
  '/loans/:loanId/items/:bookId/:copiesSerial/renew',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    const memberId = getMemberId(req);
    const loanId = Number(req.params.loanId);
    const bookId = Number(req.params.bookId);
    const copiesSerial = Number(req.params.copiesSerial);

    if (!memberId || !Number.isFinite(loanId) || !Number.isFinite(bookId) || !Number.isFinite(copiesSerial)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '參數格式錯誤' },
      });
    }

    try {
      const result = await withTransaction(async (client) => {
        // 取得 Loan record 與 member
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
            AND bl.member_id = $4
          FOR UPDATE
        `;

        const loanRes = await client.query(loanSql, [loanId, bookId, copiesSerial, memberId]);
        if (loanRes.rowCount === 0) {
          throw {
            type: 'business',
            status: 404,
            code: 'LOAN_ITEM_NOT_FOUND',
            message: '找不到對應的借閱紀錄',
          };
        }

        const row = loanRes.rows[0];

        if (row.return_date) {
          throw {
            type: 'business',
            status: 400,
            code: 'ALREADY_RETURNED',
            message: '此書已歸還，無法續借',
          };
        }

        if (row.renew_cnt >= 1) {
          throw {
            type: 'business',
            status: 400,
            code: 'RENEW_LIMIT_REACHED',
            message: '此書已達續借次數上限',
          };
        }

        // 檢查是否已到期（期限當天也可以續借）
        // due_date 是 DATE 類型，使用 SQL 比較更準確
        const todayCheckSql = `SELECT CURRENT_DATE > $1::DATE AS is_overdue`;
        const todayCheckRes = await client.query(todayCheckSql, [row.due_date]);
        const isOverdue = todayCheckRes.rows[0]?.is_overdue;
        
        if (isOverdue) {
          throw {
            type: 'business',
            status: 400,
            code: 'ALREADY_OVERDUE',
            message: '此書已逾期，無法續借',
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

        // 更新 loan record
        const updateLoanSql = `
          UPDATE LOAN_RECORD
          SET 
            renew_cnt = renew_cnt + 1,
            due_date = due_date + (INTERVAL '1 day' * $1)
          WHERE loan_id = $2
            AND book_id = $3
            AND copies_serial = $4
          RETURNING *
        `;
        const updatedLoan = await client.query(updateLoanSql, [row.hold_days || 7, loanId, bookId, copiesSerial]);

        // 新增 ADD_FEE
        const insertFeeSql = `
          INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date)
          VALUES ($1, $2, $3, 'renew', $4, CURRENT_DATE)
          RETURNING *
        `;
        const feeRes = await client.query(insertFeeSql, [loanId, bookId, copiesSerial, renewFee]);

        // 扣款
        const updateMemberSql = `
          UPDATE MEMBER
          SET balance = balance - $1
          WHERE member_id = $2
          RETURNING member_id, balance
        `;
        const memberRes = await client.query(updateMemberSql, [renewFee, memberId]);

        return {
          loan: updatedLoan.rows[0],
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


