import { FormEvent, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAdmin } from '../../context/AdminContext';

export function AdminReturnPage() {
  const { token } = useAdmin();
  const [loanId, setLoanId] = useState('');
  const [bookId, setBookId] = useState('');
  const [copiesSerial, setCopiesSerial] = useState('');
  const [condition, setCondition] = useState<string>('Good');
  const [lost, setLost] = useState(false);
  const [immediateCharge, setImmediateCharge] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('請先在管理端登入頁登入。');
      return;
    }
    const l = Number(loanId);
    const b = Number(bookId);
    const c = Number(copiesSerial);
    if (!Number.isFinite(l) || !Number.isFinite(b) || !Number.isFinite(c)) {
      setError('請輸入有效的 loan_id / book_id / copies_serial。');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminApi.returnItem(token, {
        loan_id: l,
        book_id: b,
        copies_serial: c,
        final_condition: lost ? undefined : condition,
        lost,
        immediateCharge,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">櫃檯還書</div>
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Loan ID</label>
            <input
              className="form-input"
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Book ID</label>
            <input
              className="form-input"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Copies Serial</label>
            <input
              className="form-input"
              value={copiesSerial}
              onChange={(e) => setCopiesSerial(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">最終書況</label>
            <select
              className="form-select"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={lost}
            >
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">是否遺失</label>
            <input
              type="checkbox"
              checked={lost}
              onChange={(e) => setLost(e.target.checked)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">立即扣會員餘額</label>
            <input
              type="checkbox"
              checked={immediateCharge}
              onChange={(e) => setImmediateCharge(e.target.checked)}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          辦理還書
        </button>
      </form>
      {result && (
        <div className="text-muted">
          完成還書，新增額外費用總額: {result.total_add_fee}，會員新餘額: {result.member?.balance}
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}


