import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export default function Fee() {
  const { user } = useAuth();
  const [challans, setChallans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ studentId: '', semester: 'Spring 2025', dueDate: '2025-02-28', label: 'Tuition Fee', amount: 35000, scholarshipDeduction: 0, fine: 0 });
  const [msg, setMsg] = useState(null);

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

  const createChallan = async () => {
    try {
      await api.createChallan({
        studentId: form.studentId,
        semester: form.semester,
        dueDate: form.dueDate,
        scholarshipDeduction: Number(form.scholarshipDeduction) || 0,
        fine: Number(form.fine) || 0,
        items: [{ label: form.label, amount: Number(form.amount) || 0 }],
      });
      setMsg({ type: 'success', text: 'Challan generated.' });
      setForm({ ...form, studentId: '' });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
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

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {(user.role === 'finance' || user.role === 'admin') && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3 className="card-title">Generate Challan</h3><span className="badge badge-blue">Finance workflow</span></div>
          <div className="grid-3">
            <input className="form-input" placeholder="Student ID, e.g. s001" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} />
            <input className="form-input" placeholder="Semester" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} />
            <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            <input className="form-input" placeholder="Item label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            <input className="form-input" type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <input className="form-input" type="number" placeholder="Scholarship deduction" value={form.scholarshipDeduction} onChange={e => setForm({ ...form, scholarshipDeduction: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={!form.studentId || !form.label} onClick={createChallan}>Generate Challan</button>
        </div>
      )}

      {challans.length === 0 && <div className="empty"><p>No challans found.</p></div>}

      {challans.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Challan — {c.semester}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Due: {c.dueDate}{c.studentName ? ` · ${c.studentName}` : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {statusBadge(c.status)}
              {(user.role === 'finance' || user.role === 'admin') && c.status !== 'paid' && (
                <button className="btn btn-primary btn-sm" onClick={() => markPaid(c.id)}>Mark Paid</button>
              )}
            </div>
          </div>

          {/* Stack on mobile */}
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
