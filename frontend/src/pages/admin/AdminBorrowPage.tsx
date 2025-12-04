import { FormEvent, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

interface BorrowItem {
  book_id: number;
  copies_serial: number;
}

export function AdminBorrowPage() {
  const { token } = useAdmin();
  const [memberId, setMemberId] = useState('');
  const [items, setItems] = useState<BorrowItem[]>([]);
  const [bookIdInput, setBookIdInput] = useState('');
  const [copySerialInput, setCopySerialInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    const b = Number(bookIdInput);
    const c = Number(copySerialInput);
    if (!Number.isFinite(b) || !Number.isFinite(c)) {
      setError('請輸入有效的 book_id / copies_serial。');
      return;
    }
    setItems([...items, { book_id: b, copies_serial: c }]);
    setBookIdInput('');
    setCopySerialInput('');
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }
    const mid = Number(memberId);
    if (!Number.isFinite(mid) || items.length === 0) {
      setError('請輸入有效的 member_id 並至少一筆借書項目。');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminApi.borrow(token, { member_id: mid, items });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">櫃檯借書</div>
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Member ID</label>
            <input
              className="form-input"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Book ID</label>
            <input
              className="form-input"
              value={bookIdInput}
              onChange={(e) => setBookIdInput(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Copies Serial</label>
            <input
              className="form-input"
              value={copySerialInput}
              onChange={(e) => setCopySerialInput(e.target.value)}
            />
          </div>
          <div className="form-field" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={addItem}>
              加入列表
            </button>
          </div>
        </div>
        {items.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Book ID</th>
                <th>Copies Serial</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.book_id}</td>
                  <td>{it.copies_serial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          辦理借書
        </button>
      </form>
      {result && (
        <div className="text-muted">
          完成借書，Loan ID: {result.loan_id}，總租金: {result.final_price}，會員新餘額:{' '}
          {result.member?.balance}
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}


