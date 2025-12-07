import { FormEvent, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { booksApi } from '../../api/booksApi';
import { useAdmin } from '../../context/AdminContext';
import { BookSearchResult, BookListResult, BookCopyInfo, BookCategory } from '../../types';

export function AdminBooksPage() {
  const { token } = useAdmin();
  const [createForm, setCreateForm] = useState({
    name: '',
    author: '',
    publisher: '',
    price: 0,
    category_id: '',
    copies_count: 1,
  });
  const [searchBookId, setSearchBookId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchCategoryId, setSearchCategoryId] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [bookList, setBookList] = useState<BookListResult[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [categories, setCategories] = useState<BookCategory[]>([]);

  const requireToken = () => {
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return false;
    }
    return true;
  };

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await booksApi.getCategories();
        setCategories(result);
      } catch (e: any) {
        console.error('Failed to load categories:', e);
      }
    };
    loadCategories();
  }, []);

  // Load book list on mount and when page changes
  useEffect(() => {
    if (token && !isSearchMode) {
      const loadBooks = async () => {
        if (!token) return;
        setSearchLoading(true);
        setError(null);
        try {
          const result = await adminApi.getBooksList(token, currentPage, 100);
          setBookList(result.books);
          setTotalPages(result.pagination.totalPages);
        } catch (e: any) {
          if (e.name === 'AuthenticationError' || e.message?.includes('UNAUTHORIZED')) {
            setError('登入已過期，請重新登入');
          } else {
            setError(e.message);
          }
          setBookList([]);
        } finally {
          setSearchLoading(false);
        }
      };
      loadBooks();
    }
  }, [token, currentPage, isSearchMode]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!requireToken()) return;

    setError(null);
    setMessage(null);

    if (!createForm.name || createForm.name.trim() === '') {
      setError('請填寫書名欄位');
      return;
    }
    if (!createForm.author || createForm.author.trim() === '') {
      setError('請填寫作者欄位');
      return;
    }
    if (!createForm.price || createForm.price <= 0) {
      setError('請填寫有效的租金定價');
      return;
    }
    if (!createForm.copies_count || createForm.copies_count < 1) {
      setError('複本數必須大於 0');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: createForm.name.trim(),
        author: createForm.author.trim(),
        price: createForm.price,
        copies_count: createForm.copies_count,
      };
      if (createForm.publisher.trim()) {
        payload.publisher = createForm.publisher.trim();
      }
      if (createForm.category_id) {
        payload.category_id = Number(createForm.category_id);
      }
      await adminApi.createBookWithCopies(token!, payload);
      setMessage('新增書籍成功！');
      setCreateForm({ name: '', author: '', publisher: '', price: 0, category_id: '', copies_count: 1 });
      // Reload book list
      if (!isSearchMode) {
        const result = await adminApi.getBooksList(token!, currentPage, 100);
        setBookList(result.books);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (e: any) {
      setError(e.message || '新增書籍失敗');
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async () => {
    if (!requireToken()) return;
    setSearchLoading(true);
    setError(null);
    setIsSearchMode(true);
    try {
      const params: { bookId?: string; name?: string; categoryId?: string; status?: string } = {};
      if (searchBookId.trim()) {
        params.bookId = searchBookId.trim();
      }
      if (searchName.trim()) {
        params.name = searchName.trim();
      }
      if (searchCategoryId) {
        params.categoryId = searchCategoryId;
      }
      if (searchStatus) {
        params.status = searchStatus;
      }
      if (!params.bookId && !params.name && !params.categoryId) {
        setError('請輸入 Book ID、書名或選擇類別');
        setSearchResults([]);
        setIsSearchMode(false);
        return;
      }
      const results = await adminApi.searchBooks(token!, params);
      setSearchResults(results);
    } catch (e: any) {
      if (e.name === 'AuthenticationError' || e.message?.includes('UNAUTHORIZED')) {
        setError('登入已過期，請重新登入');
      } else {
        setError(e.message);
      }
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchBookId('');
    setSearchName('');
    setSearchCategoryId('');
    setSearchStatus('');
    setSearchResults([]);
    setIsSearchMode(false);
    setError(null);
  };

  // Process search results to calculate available count
  const processedSearchResults = searchResults.map((book) => {
    const availableCount = book.copies.filter((copy) => copy.status === 'Available').length;
    return {
      book_id: book.book_id,
      name: book.name,
      available_count: availableCount,
    };
  });

  return (
    <>
      <div className="card">
        <div className="card-title">新增書籍</div>
        <form onSubmit={onCreate}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">書名</label>
              <input
                className="form-input"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">作者</label>
              <input
                className="form-input"
                value={createForm.author}
                onChange={(e) => setCreateForm({ ...createForm, author: e.target.value })}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">出版社</label>
              <input
                className="form-input"
                value={createForm.publisher}
                onChange={(e) => setCreateForm({ ...createForm, publisher: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label className="form-label">租金定價</label>
              <input
                className="form-input"
                type="number"
                value={createForm.price}
                onChange={(e) => setCreateForm({ ...createForm, price: Number(e.target.value) })}
                min="1"
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">類別</label>
              <select
                className="form-select"
                value={createForm.category_id}
                onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })}
              >
                <option value="">請選擇類別</option>
                {categories.map((cat) => (
                  <option key={cat.category_id} value={cat.category_id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">複本數</label>
              <input
                className="form-input"
                type="number"
                value={createForm.copies_count}
                onChange={(e) => setCreateForm({ ...createForm, copies_count: Number(e.target.value) })}
                min="1"
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            新增書籍
          </button>
        </form>
        {message && <div className="text-muted">{message}</div>}
      </div>

      <div className="card">
        <div className="card-title">書籍搜尋</div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Book ID</label>
            <input
              className="form-input"
              value={searchBookId}
              onChange={(e) => setSearchBookId(e.target.value)}
              placeholder="輸入書籍 ID"
            />
          </div>
          <div className="form-field">
            <label className="form-label">書名</label>
            <input
              className="form-input"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="輸入書名關鍵字"
            />
          </div>
          <div className="form-field">
            <label className="form-label">類別</label>
            <select
              className="form-select"
              value={searchCategoryId}
              onChange={(e) => setSearchCategoryId(e.target.value)}
            >
              <option value="">全部類別</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">狀態</label>
            <select
              className="form-select"
              value={searchStatus}
              onChange={(e) => setSearchStatus(e.target.value)}
            >
              <option value="">全部狀態</option>
              <option value="Available">在架上</option>
              <option value="Borrowed">借出</option>
              <option value="Lost">遺失</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={onSearch} disabled={searchLoading}>
            搜尋
          </button>
          {isSearchMode && (
            <button className="btn btn-secondary" onClick={clearSearch}>
              清除搜尋
            </button>
          )}
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="card">
        <div className="card-title">
          {isSearchMode ? '搜尋結果' : '書籍列表'}
        </div>
        {searchLoading && <div className="text-muted">載入中...</div>}
        {!searchLoading && isSearchMode && searchResults.length === 0 && (
          <div className="text-muted">目前沒有符合條件的書籍。</div>
        )}
        {!searchLoading && !isSearchMode && bookList.length === 0 && (
          <div className="text-muted">目前沒有書籍。</div>
        )}
        {(isSearchMode ? processedSearchResults.length > 0 : bookList.length > 0) && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>書名</th>
                  <th>可借閱數量</th>
                </tr>
              </thead>
              <tbody>
                {isSearchMode
                  ? processedSearchResults.map((book) => (
                      <tr key={book.book_id}>
                        <td>
                          <Link to={`/admin/books/${book.book_id}`}>{book.book_id}</Link>
                        </td>
                        <td>
                          <Link to={`/admin/books/${book.book_id}`}>{book.name}</Link>
                        </td>
                        <td>{book.available_count}</td>
                      </tr>
                    ))
                  : bookList.map((book) => (
                      <tr key={book.book_id}>
                        <td>
                          <Link to={`/admin/books/${book.book_id}`}>{book.book_id}</Link>
                        </td>
                        <td>
                          <Link to={`/admin/books/${book.book_id}`}>{book.name}</Link>
                        </td>
                        <td>{book.available_count}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!isSearchMode && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <div>
                  第 {currentPage} 頁，共 {totalPages} 頁
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    上一頁
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一頁
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

