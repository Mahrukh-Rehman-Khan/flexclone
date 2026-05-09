import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ minCgpa: '0', maxCgpa: '4', probation: '' });
  const [exportMsg, setExportMsg] = useState('');

  const loadStudents = useCallback(() => {
    api.getStudentReport(filters).then(r => setStudents(r.data)).catch(() => {});
  }, [filters]);

  useEffect(() => {
    api.getReportSummary().then(r => setSummary(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const exportReport = async (kind) => {
    const r = await api.exportReport(kind);
    setExportMsg(`${r.data.rows.length} ${kind} rows prepared for export.`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Reporting &amp; Analytics</h2>
        <p className="page-subtitle">Enrollment, finance, grades, student filters, and export-ready reports</p>
      </div>

      {exportMsg && <div className="alert alert-success" onClick={() => setExportMsg('')}>{exportMsg}</div>}

      {summary && (
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Course Sections</div><div className="stat-value">{summary.enrollment.length}</div></div>
          <div className="stat-card"><div className="stat-label">Finance Buckets</div><div className="stat-value">{summary.finance.length}</div></div>
          <div className="stat-card"><div className="stat-label">Grade Reports</div><div className="stat-value">{summary.grades.length}</div></div>
          <div className="stat-card"><div className="stat-label">Students</div><div className="stat-value">{summary.students.length}</div></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Student Academic Filters</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('students')}>Export Students</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('registrations')}>Export Registrations</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('finance')}>Export Finance</button>
          </div>
        </div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <input className="form-input" placeholder="Min CGPA" value={filters.minCgpa} onChange={e => setFilters({ ...filters, minCgpa: e.target.value })} />
          <input className="form-input" placeholder="Max CGPA" value={filters.maxCgpa} onChange={e => setFilters({ ...filters, maxCgpa: e.target.value })} />
          <select className="form-select" value={filters.probation} onChange={e => setFilters({ ...filters, probation: e.target.value })}>
            <option value="">All statuses</option>
            <option value="clear">Clear</option>
            <option value="probation">Probation</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={loadStudents}>Apply Filters</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Roll No</th><th>Name</th><th>CGPA</th><th>Warnings</th><th>Probation</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.username}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{s.username}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{Number(s.cgpa || 0).toFixed(2)}</td>
                  <td>{s.warning_count || 0}</td>
                  <td><span className={`badge badge-${s.probation_status === 'probation' ? 'red' : 'green'}`}>{s.probation_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
