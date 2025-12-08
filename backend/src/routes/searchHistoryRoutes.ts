import { Router, Request, Response, NextFunction } from 'express';
import { getSearchHistoryCollection } from '../mongodb';
import { ApiResponse } from '../types';

export const searchHistoryRouter = Router();

// 獲取會員搜尋歷史
searchHistoryRouter.get(
  '/member/history',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const memberId = req.query.memberId ? Number(req.query.memberId) : null;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      if (!memberId || !Number.isFinite(memberId)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'memberId 格式錯誤' },
        });
      }

      const collection = await getSearchHistoryCollection();
      if (!collection) {
        return res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'MongoDB 服務不可用' },
        });
      }

      const results = await collection
        .find({ member_id: memberId })
        .sort({ search_date: -1 })
        .limit(limit)
        .toArray();

      return res.json({
        success: true,
        data: results.map((doc) => ({
          _id: doc._id.toString(),
          member_id: doc.member_id,
          search_query: doc.search_query,
          search_date: doc.search_date,
          book_ids: doc.book_ids || [],
          filters: doc.filters || {},
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

// 管理員：獲取搜尋趨勢分析
searchHistoryRouter.get(
  '/admin/analytics',
  async (req: Request, res: Response<ApiResponse<any>>, next: NextFunction) => {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      if (!Number.isFinite(days) || days < 1) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'days 參數格式錯誤' },
        });
      }

      const collection = await getSearchHistoryCollection();
      if (!collection) {
        return res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'MongoDB 服務不可用' },
        });
      }

      // 計算日期範圍
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 1. 最熱門的搜尋關鍵詞
      const topKeywords = await collection
        .aggregate([
          {
            $match: {
              search_date: { $gte: startDate },
              search_query: { $exists: true, $ne: '' },
            },
          },
          {
            $group: {
              _id: '$search_query',
              count: { $sum: 1 },
              last_searched: { $max: '$search_date' },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: limit,
          },
          {
            $project: {
              keyword: '$_id',
              count: 1,
              last_searched: 1,
              _id: 0,
            },
          },
        ])
        .toArray();

      // 2. 最常被搜尋的書籍（根據 book_ids）
      const topBooks = await collection
        .aggregate([
          {
            $match: {
              search_date: { $gte: startDate },
              book_ids: { $exists: true, $ne: [] },
            },
          },
          {
            $unwind: '$book_ids',
          },
          {
            $group: {
              _id: '$book_ids',
              count: { $sum: 1 },
              last_searched: { $max: '$search_date' },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: limit,
          },
          {
            $project: {
              book_id: '$_id',
              count: 1,
              last_searched: 1,
              _id: 0,
            },
          },
        ])
        .toArray();

      // 3. 搜尋趨勢（按日期統計）
      const searchTrends = await collection
        .aggregate([
          {
            $match: {
              search_date: { $gte: startDate },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$search_date',
                },
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
          {
            $project: {
              date: '$_id',
              count: 1,
              _id: 0,
            },
          },
        ])
        .toArray();

      // 4. 最常用的篩選條件
      const topFilters = await collection
        .aggregate([
          {
            $match: {
              search_date: { $gte: startDate },
              filters: { $exists: true },
            },
          },
          {
            $project: {
              category: '$filters.category',
              author: '$filters.author',
              publisher: '$filters.publisher',
            },
          },
          {
            $group: {
              _id: {
                category: '$category',
                author: '$author',
                publisher: '$publisher',
              },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: limit,
          },
        ])
        .toArray();

      // 5. 最常用的分類
      const topCategories = await collection
        .aggregate([
          {
            $match: {
              search_date: { $gte: startDate },
              'filters.category': { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: '$filters.category',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 10,
          },
          {
            $project: {
              category_id: '$_id',
              count: 1,
              _id: 0,
            },
          },
        ])
        .toArray();

      // 6. 價格範圍使用頻率（將價格範圍分組）
      const priceRanges = await collection
        .aggregate([
          {
            $match: {
              search_date: { $gte: startDate },
              $or: [
                { 'filters.min_price': { $exists: true, $ne: null } },
                { 'filters.max_price': { $exists: true, $ne: null } },
              ],
            },
          },
          {
            $project: {
              min_price: { $ifNull: ['$filters.min_price', 0] },
              max_price: { $ifNull: ['$filters.max_price', 999999] },
            },
          },
          {
            $group: {
              _id: {
                $concat: [
                  { $toString: '$min_price' },
                  '-',
                  { $toString: '$max_price' },
                ],
              },
              count: { $sum: 1 },
              min_price: { $first: '$min_price' },
              max_price: { $first: '$max_price' },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 10,
          },
          {
            $project: {
              price_range: '$_id',
              count: 1,
              min_price: 1,
              max_price: 1,
              _id: 0,
            },
          },
        ])
        .toArray();

      // 7. 總搜尋次數和活躍會員數
      const totalSearches = await collection.countDocuments({
        search_date: { $gte: startDate },
      });

      const activeMembers = await collection.distinct('member_id', {
        search_date: { $gte: startDate },
      });

      return res.json({
        success: true,
        data: {
          period_days: days,
          total_searches: totalSearches,
          active_members: activeMembers.length,
          top_keywords: topKeywords,
          top_books: topBooks,
          search_trends: searchTrends,
          top_filters: topFilters,
          top_categories: topCategories,
          price_ranges: priceRanges,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

