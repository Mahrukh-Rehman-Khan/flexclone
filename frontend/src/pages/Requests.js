import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

const STATUS_BADGE = { submitted: 'yellow', under_review: 'blue', approved: 'green', rejected: 'red' };

export default function Requests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ type: '', justification: '' });
  const [msg, setMsg] = useState(null);

  const load = () => {
    const fn = user.role === 'student' ? api.getMyRequests : api.getAllRequests;
    fn().then(r => setRequests(r.data)).catch(() => {});
    api.getRequestTypes().then(r => setTypes(r.data)).catch(() => {});
  };
  useEffect(load, [user.role]);

  const submit = async () => {
    try {
      await api.submitRequest(form.type, form.justification);
      setMsg({ type: 'success', text: 'Request submitted successfully.' });
      setShowModal(false); setForm({ type: '', justification: '' }); load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const updateStatus = async (id, status) => {
    const remarks = status === 'rejected' ? prompt('Enter rejection reason:') : '';
    try { await api.updateRequestStatus(id, status, remarks || ''); load(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 className="page-title">Student Requests</h2>
          <p className="page-subtitle">Submit and track formal requests</p>
        </div>
        {user.role === 'student' && <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Request</button>}
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {user.role !== 'student' && <th>Student</th>}
                <th>Type</th><th>Submitted</th><th>Status</th><th>Updated</th>
                {user.role !== 'student' && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No requests found</td></tr>
                : requests.map(r => (
                  <tr key={r.id}>
                    {user.role !== 'student' && <td><div style={{ fontWeight: 500 }}>{r.studentName}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.studentUsername}</div></td>}
                    <td style={{ fontWeight: 500 }}>{r.type}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.submittedAt?.slice(0, 10)}</td>
                    <td><span className={`badge badge-${STATUS_BADGE[r.status] || 'gray'}`}>{r.status.replace('_', ' ')}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.updatedAt?.slice(0, 10)}</td>
                    {user.role !== 'student' && (
                      <td>
                        {(r.status === 'submitted' || r.status === 'under_review') && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--green)' }} onClick={() => updateStatus(r.id, 'approved')}>Approve</button>
                            <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)' }} onClick={() => updateStatus(r.id, 'rejected')}>Reject</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Request</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Request Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="">— Select type —</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Justification</label>
              <textarea className="form-textarea" value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} placeholder="Explain your request…" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={!form.type}>Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
