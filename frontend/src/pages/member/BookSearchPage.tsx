import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { booksApi } from '../../api/booksApi';
import { useMember } from '../../context/MemberContext';
import { BookSummary } from '../../types';
import { Link } from 'react-router-dom';

interface Category {
  category_id: number;
  name: string;
}

export function BookSearchPage() {
  const { memberId } = useMember();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await booksApi.getCategories();
        setCategories(data);
      } catch (e: any) {
        console.error('Failed to load categories:', e);
      }
    };
    loadCategories();
  }, []);

  // 從 URL 參數讀取 categoryId
  useEffect(() => {
    const categoryIdParam = searchParams.get('categoryId');
    if (categoryIdParam) {
      const categoryId = Number(categoryIdParam);
      if (Number.isFinite(categoryId)) {
        setSelectedCategoryId(categoryId);
        setShowFilters(true); // 自動展開篩選面板
      }
    } else {
      // 如果 URL 中沒有 categoryId，清除選擇
      setSelectedCategoryId(null);
    }
  }, [searchParams]);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      // 優先使用 URL 參數中的 categoryId
      const categoryIdParam = searchParams.get('categoryId');
      const categoryIdToUse = categoryIdParam 
        ? Number(categoryIdParam) 
        : (selectedCategoryId ?? undefined);
      
      const data = await booksApi.search({
        keyword,
        author,
        publisher,
        memberId: memberId ?? undefined,
        categoryId: Number.isFinite(categoryIdToUse) ? categoryIdToUse : undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      });
      setBooks(data);
    } catch (e: any) {
      setError(e.message);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  // 當 URL 參數改變時自動搜尋
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <>
      <div className="card">
        <div className="card-title">書籍搜尋</div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">書名關鍵字</label>
            <input
              className="form-input"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search();
              }}
            />
          </div>
          <div className="form-field">
            <label className="form-label">作者</label>
            <input
              className="form-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search();
              }}
            />
          </div>
          <div className="form-field">
            <label className="form-label">出版社</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <input
                className="form-input"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') search();
                }}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => setShowFilters(!showFilters)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {showFilters ? '收起篩選' : '篩選'}
              </button>
            </div>
          </div>
        </div>
        {showFilters && (
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '0.5rem' }}>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">書籍類別</label>
                <select
                  className="form-input"
                  value={selectedCategoryId ?? ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">全部</option>
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">最低價錢</label>
                <input
                  type="number"
                  className="form-input"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="最小值"
                  min="0"
                />
              </div>
              <div className="form-field">
                <label className="form-label">最高價錢</label>
                <input
                  type="number"
                  className="form-input"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="最大值"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}
        <button className="btn btn-primary" onClick={search} disabled={loading}>
          搜尋
        </button>
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card">
        <div className="card-title">搜尋結果</div>
        {loading && <div className="text-muted">載入中...</div>}
        {!loading && books.length === 0 && <div className="text-muted">目前沒有資料。</div>}
        {books.length > 0 && (
          <div className="book-grid">
            {books.map((b) => {
              const isAvailable = b.available_count > 0;
              const rentalPrice = b.estimated_min_rental_price != null
                ? Math.round(b.estimated_min_rental_price)
                : null;
              
              return (
                <Link
                  key={b.book_id}
                  to={`/member/books/${b.book_id}`}
                  className={`book-card ${!isAvailable ? 'book-card-unavailable' : ''}`}
                >
                  <div className="book-card-title">{b.name}</div>
                  <div className="book-card-author">{b.author}</div>
                  {b.categories && b.categories.length > 0 && (
                    <div className="book-card-categories">
                      {b.categories.map((c) => (
                        <span key={c.category_id} className="book-card-tag">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="book-card-footer">
                    <span className={`book-card-status ${isAvailable ? 'book-card-status-available' : ''}`}>
                      {isAvailable ? '可借' : '不可借'}
                    </span>
                    <span className="book-card-price">
                      {rentalPrice ? `TWD ${rentalPrice}` : '-'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}


