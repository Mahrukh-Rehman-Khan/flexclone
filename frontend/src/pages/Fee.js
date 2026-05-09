import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export default function Fee() {
  const { user } = useAuth();
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const fn = user.role === 'student' ? api.getMyFee : api.getAllFee;
    fn().then(r => setChallans(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, [user.role]);

  const markPaid = async (id) => {
    const ref = prompt('Enter bank reference number:');
    if (!ref) return;
    try { await api.payFee(id, { bankRef: ref, paymentMethod: 'Bank Transfer' }); load(); }
    catch (e) { alert(e.message); }
  };

  const statusBadge = (s) => {
    const map = { paid: 'green', unpaid: 'yellow', overdue: 'red', partially_paid: 'orange' };
    return <span className={`badge badge-${map[s] || 'gray'}`}>{s.replace('_', ' ')}</span>;
  };

  if (loading) return <div className="page"><div className="empty"><p>Loading…</p></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Fee &amp; Finance</h2>
        <p className="page-subtitle">Fee challans and payment history</p>
      </div>

      {challans.length === 0 && <div className="empty"><p>No challans found.</p></div>}

      {challans.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Challan — {c.semester}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Due: {c.dueDate}{c.studentName ? ` · ${c.studentName}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {statusBadge(c.status)}
              {(user.role === 'finance' || user.role === 'admin') && c.status !== 'paid' && (
                <button className="btn btn-primary btn-sm" onClick={() => markPaid(c.id)}>Mark Paid</button>
              )}
            </div>
          </div>

          <div className="grid-2">
            <div>
              {c.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span style={{ fontWeight: 500 }}>PKR {item.amount.toLocaleString()}</span>
                </div>
              ))}
              {c.scholarshipDeduction > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--green)' }}>Scholarship Deduction</span>
                  <span style={{ color: 'var(--green)', fontWeight: 500 }}>− PKR {c.scholarshipDeduction.toLocaleString()}</span>
                </div>
              )}
              {c.fine > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                  <span style={{ color: 'var(--red)' }}>Late Payment Fine</span>
                  <span style={{ color: 'var(--red)', fontWeight: 500 }}>+ PKR {c.fine.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 16, fontWeight: 700 }}>
                <span>Total Due</span>
                <span style={{ color: 'var(--accent)' }}>PKR {c.total.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ background: c.status === 'paid' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${c.status === 'paid' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 8, padding: 16 }}>
              {c.status === 'paid' ? (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✓ Payment Confirmed</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 2 }}>
                    Date: <span style={{ color: 'var(--text)' }}>{c.paidAt?.slice(0, 10)}</span><br />
                    Ref: <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{c.bankRef}</span><br />
                    Method: <span style={{ color: 'var(--text)' }}>{c.paymentMethod}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--red)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠ Payment Pending</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Please pay before <strong style={{ color: 'var(--text)' }}>{c.dueDate}</strong> to avoid late fines.</div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
