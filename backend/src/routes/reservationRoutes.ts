import { Router, Request, Response, NextFunction } from 'express';
import { withTransaction } from '../db';
import { ApiResponse } from '../types';

export const reservationRouter = Router();

// M4: 建立預約
reservationRouter.post(
  '/',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const { member_id, book_ids } = req.body || {};

      if (!member_id || !Array.isArray(book_ids) || book_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: '缺少 member_id 或 book_ids' },
        });
      }

      // 檢查 book_ids 中是否有重複
      const uniqueBookIds = [...new Set(book_ids)];
      if (uniqueBookIds.length !== book_ids.length) {
        return res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE_BOOK_IDS', message: 'book_ids 陣列中不能有重複的 book_id' },
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
            message: '會員狀態不可預約',
          };
        }

        // 當前借閱中 + Active 預約本數
        const activeLoanSql = `
          SELECT COUNT(*) AS cnt
          FROM LOAN_RECORD lr
          JOIN BOOK_LOAN bl ON lr.loan_id = bl.loan_id
          WHERE bl.member_id = $1
            AND lr.return_date IS NULL
        `;
        const activeLoanRes = await client.query(activeLoanSql, [member_id]);
        const activeLoanCnt = Number(activeLoanRes.rows[0].cnt);

        const activeResSql = `
          SELECT COUNT(*) AS cnt
          FROM RESERVATION r
          JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
          WHERE r.member_id = $1
            AND r.status = 'Active'
        `;
        const activeResRes = await client.query(activeResSql, [member_id]);
        const activeResCnt = Number(activeResRes.rows[0].cnt);

        const totalAfter = activeLoanCnt + activeResCnt + book_ids.length;
        if (totalAfter > member.max_book_allowed) {
          throw {
            type: 'business',
            status: 400,
            code: 'MAX_BOOK_EXCEEDED',
            message: '超過會員可借 / 預約本數上限',
          };
        }

        // 理論租金：使用每本書的最低租金（BOOK.price × 最低 discount_factor × MEMBERSHIP_LEVEL.discount_rate）
        // 因為預約時不知道會拿到哪個書況的書，所以使用最低租金來估算
        const theorySql = `
          SELECT 
            SUM(
              b.price * 
              (SELECT MIN(discount_factor) FROM CONDITION_DISCOUNT) * 
              $2::DECIMAL
            ) AS total_theoretical
          FROM BOOK b
          WHERE b.book_id = ANY($1::BIGINT[])
        `;
        const theoryRes = await client.query(theorySql, [book_ids, member.discount_rate]);
        const theoreticalTotal = Number(theoryRes.rows[0].total_theoretical) || 0;

        const allCostEstimate = theoreticalTotal; // 使用最低租金估算

        if (member.balance < allCostEstimate) {
          throw {
            type: 'business',
            status: 400,
            code: 'INSUFFICIENT_BALANCE',
            message: '會員餘額不足以支應預估租金',
          };
        }

        // 建立預約
        const insertResSql = `
          INSERT INTO RESERVATION (member_id, reserve_date, status)
          VALUES ($1, CURRENT_DATE, 'Active')
          RETURNING reservation_id, member_id, reserve_date, status
        `;
        const resInsertRes = await client.query(insertResSql, [member_id]);
        const reservation = resInsertRes.rows[0];

        // 對每個 book_id，檢查是否已經有 Active 預約
        for (const bid of book_ids) {
          const existingReservationSql = `
            SELECT COUNT(*) > 0 AS has_existing
            FROM RESERVATION r
            JOIN RESERVATION_RECORD rr ON r.reservation_id = rr.reservation_id
            WHERE r.member_id = $1
              AND rr.book_id = $2
              AND r.status = 'Active'
          `;
          const existingRes = await client.query(existingReservationSql, [member_id, bid]);
          if (existingRes.rows[0].has_existing) {
            throw {
              type: 'business',
              status: 400,
              code: 'DUPLICATE_RESERVATION',
              message: `您已經有該書籍 ${bid} 的 Active 預約，一個會員只能對同一本書進行一筆預約`,
            };
          }
        }

        // 對每個 book_id，重新檢查可用性並自動選擇並鎖定一個 available 複本
        const reservedCopies: { book_id: number; copies_serial: number }[] = [];
        for (const bid of book_ids) {
          // 重新檢查該書籍是否仍有至少一個可借閱複本（避免在鎖定前被其他操作搶走）
          const checkAvailableSql = `
            SELECT COUNT(*) AS available_count
            FROM BOOK_COPIES
            WHERE book_id = $1 AND status = 'Available'
          `;
          const checkAvailableRes = await client.query(checkAvailableSql, [bid]);
          const availableCount = Number(checkAvailableRes.rows[0]?.available_count || 0);
          
          if (availableCount === 0) {
            throw {
              type: 'business',
              status: 400,
              code: 'NO_AVAILABLE_COPY',
              message: `書籍 ${bid} 無可預約複本`,
            };
          }

          // 查詢並鎖定 available 複本
          // PostgreSQL 不支援 SELECT ... FOR UPDATE LIMIT 1，需要使用子查詢
          const copySql = `
            SELECT book_id, copies_serial, status
            FROM BOOK_COPIES 
            WHERE ctid = (
              SELECT ctid 
              FROM BOOK_COPIES 
              WHERE book_id = $1 AND status = 'Available' 
              LIMIT 1
            )
            FOR UPDATE
          `;
          const copyRes = await client.query(copySql, [bid]);
          
          if (copyRes.rowCount === 0) {
            throw {
              type: 'business',
              status: 400,
              code: 'NO_AVAILABLE_COPY',
              message: `書籍 ${bid} 無可預約複本`,
            };
          }
          
          const copy = copyRes.rows[0];
          
          // 再次確認狀態（防止在鎖定期間狀態被改變）
          if (copy.status !== 'Available') {
            throw {
              type: 'business',
              status: 400,
              code: 'COPY_STATUS_CHANGED',
              message: `書籍 ${bid} 的複本狀態已改變，無法預約`,
            };
          }
          
          // 更新複本狀態為 Reserved
          await client.query(
            `UPDATE BOOK_COPIES 
             SET status = 'Reserved' 
             WHERE book_id = $1 AND copies_serial = $2`,
            [copy.book_id, copy.copies_serial]
          );
          
          reservedCopies.push({
            book_id: copy.book_id,
            copies_serial: copy.copies_serial,
          });
          
          // 建立 RESERVATION_RECORD（只記錄 book_id）
          await client.query(
            'INSERT INTO RESERVATION_RECORD (reservation_id, book_id) VALUES ($1, $2)',
            [reservation.reservation_id, bid]
          );
        }

        return {
          reservation,
          book_ids,
          reserved_copies: reservedCopies,
        };
      });

      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);


