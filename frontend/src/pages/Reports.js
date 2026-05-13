import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function letterhead(doc, title) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FAST-NUCES', pageW / 2, 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('National University of Computer and Emerging Sciences', pageW / 2, 29, { align: 'center' });
  doc.setDrawColor(100, 100, 100);
  doc.line(14, 33, pageW - 14, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, pageW / 2, 41, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 47, { align: 'center' });
  doc.setTextColor(0);
  return 54; // y offset after letterhead
}

function downloadPDF(filename, buildFn) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  buildFn(doc);
  doc.save(filename);
}

export default function Reports() {
  const [summary, setSummary]     = useState(null);
  const [students, setStudents]   = useState([]);
  const [filters, setFilters]     = useState({ minCgpa: '0', maxCgpa: '4', probation: '' });
  const [exportMsg, setExportMsg] = useState('');

  const loadStudents = useCallback(() => {
    api.getStudentReport(filters).then(r => setStudents(r.data)).catch(() => {});
  }, [filters]);

  useEffect(() => {
    api.getReportSummary().then(r => setSummary(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const exportStudentsPDF = () => {
    downloadPDF('students-report.pdf', doc => {
      const startY = letterhead(doc, 'Student Academic Report');
      autoTable(doc, {
        startY,
        head: [['Roll No.', 'Name', 'Email', 'CGPA', 'Warnings', 'Probation']],
        body: students.map(s => [s.username, s.name, s.email || '—', Number(s.cgpa || 0).toFixed(2), s.warning_count || 0, s.probation_status]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 138] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      });
    });
    setExportMsg('Student report PDF downloaded.');
  };

  const exportEnrollmentPDF = () => {
    if (!summary) return;
    downloadPDF('enrollment-report.pdf', doc => {
      const startY = letterhead(doc, 'Course Enrollment Report');
      autoTable(doc, {
        startY,
        head: [['Course Code', 'Title', 'Section', 'Enrolled', 'Capacity', 'Fill %']],
        body: summary.enrollment.map(e => [
          e.code, e.title, e.section || '—', e.enrolled, e.capacity,
          e.capacity > 0 ? `${Math.round((e.enrolled / e.capacity) * 100)}%` : '—',
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 58, 138] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      });
    });
    setExportMsg('Enrollment report PDF downloaded.');
  };

  const exportFinancePDF = () => {
    downloadPDF('finance-report.pdf', doc => {
      const startY = letterhead(doc, 'Finance Summary Report');
      if (summary?.finance) {
        autoTable(doc, {
          startY,
          head: [['Status', 'Count', 'Total Amount']],
          body: summary.finance.map(f => [f.status, f.count, `PKR ${Number(f.total || 0).toLocaleString()}`]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [30, 58, 138] },
          alternateRowStyles: { fillColor: [245, 247, 255] },
        });
      }
    });
    setExportMsg('Finance report PDF downloaded.');
  };

  const exportGradesPDF = () => {
    if (!summary) return;
    downloadPDF('grades-report.pdf', doc => {
      const startY = letterhead(doc, 'Course Grades Summary');
      autoTable(doc, {
        startY,
        head: [['Course Code', 'Average %']],
        body: summary.grades.map(g => [g.code, g.average !== null ? `${Number(g.average).toFixed(1)}%` : '—']),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [30, 58, 138] },
        alternateRowStyles: { fillColor: [245, 247, 255] },
      });
    });
    setExportMsg('Grades report PDF downloaded.');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Reporting &amp; Analytics</h2>
        <p className="page-subtitle">Enrollment, finance, grades, student filters, and PDF exports with FAST-NUCES letterhead</p>
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
            <button className="btn btn-secondary btn-sm" onClick={exportStudentsPDF}>⬇ Students PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={exportEnrollmentPDF}>⬇ Enrollment PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={exportFinancePDF}>⬇ Finance PDF</button>
            <button className="btn btn-secondary btn-sm" onClick={exportGradesPDF}>⬇ Grades PDF</button>
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
