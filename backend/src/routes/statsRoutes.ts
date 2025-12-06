import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { ApiResponse } from '../types';

export const statsRouter = Router();

/**
 * @swagger
 * /api/stats/top-books:
 *   get:
 *     summary: Get top borrowed books
 *     description: Retrieve the most frequently borrowed books, ordered by borrow count
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: List of top borrowed books
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TopBook'
 *             example:
 *               success: true
 *               data:
 *                 - book_id: 1
 *                   name: "The Great Gatsby"
 *                   author: "F. Scott Fitzgerald"
 *                   publisher: "Scribner"
 *                   borrow_count: 50
 */
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

/**
 * @swagger
 * /api/stats/top-categories:
 *   get:
 *     summary: Get top borrowed categories
 *     description: Retrieve the most frequently borrowed book categories, ordered by borrow count
 *     tags: [Statistics]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: List of top borrowed categories
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/TopCategory'
 *             example:
 *               success: true
 *               data:
 *                 - category_id: 1
 *                   name: "Fiction"
 *                   borrow_count: 100
 */
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


