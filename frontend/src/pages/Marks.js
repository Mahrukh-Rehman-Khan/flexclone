import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

function gradeColor(g) {
  if (!g) return 'var(--text-muted)';
  if (g.startsWith('A')) return 'var(--green)';
  if (g.startsWith('B')) return 'var(--accent)';
  if (g.startsWith('C')) return 'var(--yellow)';
  return 'var(--red)';
}

function Bar({ value }) {
  const pct = Math.min(100, Math.round(value));
  const color = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)';
  return (
    <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ══════════════════════════════════════════════════════════════════════════════
function StudentMarks() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    api.getMyMarks().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="empty"><p>Loading…</p></div></div>;
  if (!data.length) return <div className="page"><div className="empty"><p>No courses found.</p></div></div>;

  const course = data[activeTab];
  const validCourses = data.filter(c => c.gradePoints !== null && c.credits);
  const totalCredits = validCourses.reduce((s, c) => s + c.credits, 0);
  const semGPA = totalCredits > 0
    ? (validCourses.reduce((s, c) => s + c.gradePoints * c.credits, 0) / totalCredits).toFixed(2)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Marks &amp; Grades</h2>
        <p className="page-subtitle">Spring 2025</p>
      </div>

      {semGPA && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,var(--navy-light),var(--surface))' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="stat-label">Semester GPA</div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--accent)' }}>{semGPA}</div>
            </div>
            <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
            <div>
              <div className="stat-label">Credit Hours</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{totalCredits}</div>
            </div>
            <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
            <div>
              <div className="stat-label">Courses</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{data.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Subject tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {data.map((c, i) => (
          <button key={c.courseId} onClick={() => setActiveTab(i)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeTab === i ? 'var(--accent)' : 'var(--surface2)',
            color: activeTab === i ? 'white' : 'var(--text-muted)',
            fontWeight: activeTab === i ? 700 : 500, fontSize: 13,
            fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>{c.courseCode}</button>
        ))}
      </div>

      {/* Course card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">{course.courseCode} — {course.courseTitle}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{course.credits} Credit Hours</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {course.complete && course.grade ? (
              <>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'Space Grotesk', color: gradeColor(course.grade) }}>{course.grade}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{course.totalAbsolutes?.toFixed(1)} / 100 absolutes</div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                <div>{course.totalWeightage} / 100 absolutes set</div>
                <div style={{ color: 'var(--yellow)', marginTop: 2 }}>Grade available when complete</div>
              </div>
            )}
          </div>
        </div>

        {course.groups.length === 0 && <div className="empty"><p>No assessments published yet.</p></div>}

        {course.groups.map(g => (
          <div key={g.id} style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8,
              marginBottom: 8, border: '1px solid var(--border)',
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{g.label}</span>
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-dim)', background: 'var(--surface3)', padding: '2px 8px', borderRadius: 4 }}>{g.category}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                <div>Weight: <strong style={{ color: 'var(--text)' }}>{g.weightage} abs</strong></div>
                {g.groupAbs !== null && <div>Earned: <strong style={{ color: 'var(--accent)' }}>{g.groupAbs.toFixed(2)} abs</strong></div>}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Component</th><th>Total</th><th>Obtained</th><th>%</th></tr></thead>
                <tbody>
                  {g.components.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.label}</td>
                      <td>{c.total_marks}</td>
                      <td style={{ fontWeight: 700, color: c.obtained === null ? 'var(--text-dim)' : c.obtained === 0 ? 'var(--red)' : 'var(--text)' }}>
                        {c.obtained === null ? '—' : c.obtained}
                      </td>
                      <td>
                        {c.pct !== null ? (
                          <div>
                            <span style={{ fontWeight: 600, color: c.pct >= 80 ? 'var(--green)' : c.pct >= 60 ? 'var(--yellow)' : 'var(--red)' }}>{c.pct}%</span>
                            <Bar value={c.pct} />
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FACULTY VIEW
// ══════════════════════════════════════════════════════════════════════════════
const CATEGORIES = ['Quiz', 'Mid Term Exam', 'Assignment', 'Project', 'Presentation', 'Final Exam'];

const CAT_COLOR = {
  'Quiz':           'var(--accent)',
  'Mid Term Exam':  'var(--yellow)',
  'Assignment':     'var(--green)',
  'Project':        '#a78bfa',
  'Presentation':   '#f472b6',
  'Final Exam':     'var(--red)',
};

function FacultyMarks() {
  const [courses, setCourses]           = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [courseData, setCourseData]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [showGrades, setShowGrades]     = useState(false);
  const [msg, setMsg]                   = useState(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [addGroupForm, setAddGroupForm] = useState({ category: 'Quiz', label: '', weightage: '' });
  const [showAddComp, setShowAddComp]   = useState(false);
  const [addCompForm, setAddCompForm]   = useState({ groupId: '', label: '', totalMarks: '' });
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingComp, setEditingComp]   = useState(null);
  const [marksEdits, setMarksEdits]     = useState({});
  const [savingComp, setSavingComp]     = useState(null);

  useEffect(() => {
    api.getMyMarksCourses()
      .then(r => { setCourses(r.data); if (r.data.length) setActiveCourse(r.data[0].id); })
      .catch(() => {});
  }, []);

  const loadCourse = useCallback((courseId) => {
    setLoading(true); setCourseData(null); setMarksEdits({}); setShowGrades(false);
    api.getCourseMarks(courseId)
      .then(r => { setCourseData(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (activeCourse) loadCourse(activeCourse); }, [activeCourse, loadCourse]);

  const notify = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const addGroup = async () => {
    try {
      await api.addAssessmentGroup(activeCourse, addGroupForm.category, addGroupForm.label, parseFloat(addGroupForm.weightage));
      setShowAddGroup(false); setAddGroupForm({ category: 'Quiz', label: '', weightage: '' });
      loadCourse(activeCourse); notify('success', 'Assessment added!');
    } catch (e) { notify('error', e.message); }
  };

  const saveGroup = async () => {
    try {
      await api.editAssessmentGroup(editingGroup.id, editingGroup.label, parseFloat(editingGroup.weightage));
      setEditingGroup(null); loadCourse(activeCourse); notify('success', 'Updated!');
    } catch (e) { notify('error', e.message); }
  };

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this assessment and all its components and marks?')) return;
    try { await api.deleteAssessmentGroup(id); loadCourse(activeCourse); notify('success', 'Deleted.'); }
    catch (e) { notify('error', e.message); }
  };

  const addComp = async () => {
    try {
      await api.addAssessmentComponent(addCompForm.groupId, addCompForm.label, parseFloat(addCompForm.totalMarks));
      setShowAddComp(false); setAddCompForm({ groupId: '', label: '', totalMarks: '' });
      loadCourse(activeCourse); notify('success', 'Component added!');
    } catch (e) { notify('error', e.message); }
  };

  const saveComp = async () => {
    try {
      await api.editAssessmentComponent(editingComp.id, editingComp.label, parseFloat(editingComp.totalMarks));
      setEditingComp(null); loadCourse(activeCourse); notify('success', 'Updated!');
    } catch (e) { notify('error', e.message); }
  };

  const deleteComp = async (id) => {
    if (!window.confirm('Delete this component and all its marks?')) return;
    try { await api.deleteAssessmentComponent(id); loadCourse(activeCourse); notify('success', 'Deleted.'); }
    catch (e) { notify('error', e.message); }
  };

  const saveMarks = async (componentId) => {
    setSavingComp(componentId);
    try {
      const edits = marksEdits[componentId] || {};
      await api.saveMarks(componentId, edits);
      loadCourse(activeCourse); notify('success', 'Marks saved!');
      setMarksEdits(prev => { const n = { ...prev }; delete n[componentId]; return n; });
    } catch (e) { notify('error', e.message); }
    setSavingComp(null);
  };

  const setMark = (compId, stuId, val) => {
    setMarksEdits(prev => ({ ...prev, [compId]: { ...(prev[compId] || {}), [stuId]: val } }));
  };

  if (!courses.length) return (
    <div className="page">
      <div className="page-header"><h2 className="page-title">Marks Management</h2></div>
      <div className="empty"><p>No courses assigned to you.</p></div>
    </div>
  );

  const usedWeightage = courseData ? courseData.totalWeightage : 0;
  const remaining     = Math.max(0, 100 - usedWeightage);
  const complete      = Math.abs(usedWeightage - 100) < 0.01;

  const finalGrades = courseData && complete ? courseData.students.map(s => {
    let totalAbs = 0; let allEntered = true;
    for (const g of courseData.groups) {
      const entered  = g.components.filter(c => c.marks[s.id] !== undefined && c.marks[s.id] !== null);
      const sumObt   = entered.reduce((x, c) => x + c.marks[s.id], 0);
      const sumTotal = entered.reduce((x, c) => x + c.total_marks, 0);
      if (entered.length === 0) { allEntered = false; break; }
      totalAbs += (sumObt / sumTotal) * g.weightage;
    }
    if (!allEntered) return { ...s, abs: null, grade: null };
    const abs   = Math.round(totalAbs * 100) / 100;
    const grade = abs >= 90 ? 'A' : abs >= 85 ? 'A-' : abs >= 80 ? 'B+' : abs >= 75 ? 'B' :
                  abs >= 70 ? 'B-' : abs >= 65 ? 'C+' : abs >= 60 ? 'C' : abs >= 55 ? 'C-' :
                  abs >= 50 ? 'D' : 'F';
    return { ...s, abs, grade };
  }) : [];

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Marks Management</h2>
        <p className="page-subtitle">Manage assessments and enter student marks</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {/* Course selector tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {courses.map(c => (
          <button key={c.id} onClick={() => setActiveCourse(c.id)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: activeCourse === c.id ? 'var(--accent)' : 'var(--surface2)',
            color: activeCourse === c.id ? 'white' : 'var(--text-muted)',
            fontWeight: activeCourse === c.id ? 700 : 500, fontSize: 13,
            fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.15s',
          }}>{c.code} — {c.section}</button>
        ))}
      </div>

      {loading && <div className="empty"><p>Loading…</p></div>}

      {courseData && (
        <>
          {/* Weightage bar + controls */}
          <div className="card" style={{ marginBottom: 20, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 600 }}>Absolutes Assigned: </span>
                <span style={{ color: complete ? 'var(--green)' : 'var(--yellow)', fontWeight: 700 }}>{usedWeightage} / 100</span>
                {!complete && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>({remaining} remaining)</span>}
                {complete && <span style={{ color: 'var(--green)', fontSize: 12, marginLeft: 8 }}>✓ Complete</span>}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddGroup(true)} disabled={complete}>+ Add Assessment</button>
            </div>
            <div style={{ height: 8, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${usedWeightage}%`, height: '100%', background: complete ? 'var(--green)' : 'var(--accent)', borderRadius: 4, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Final Grades tab — the only permanent tab */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
            <button onClick={() => setShowGrades(g => !g)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: showGrades ? 'var(--green)' : 'var(--surface2)',
              color: showGrades ? 'white' : 'var(--text-muted)',
              fontWeight: showGrades ? 700 : 500, fontSize: 13,
              fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.15s',
            }}>
              📊 Final Grades
              {!complete && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>({usedWeightage}/100)</span>}
            </button>
          </div>

          {/* Final Grades panel */}
          {showGrades && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3 className="card-title">Final Grades</h3>
                {!complete && <span className="badge badge-yellow">Available when 100 absolutes assigned</span>}
              </div>
              {!complete ? (
                <div className="empty"><p>Assign all 100 absolutes to unlock final grades.</p></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Roll No.</th><th>Name</th><th>Absolutes</th><th>Grade</th></tr></thead>
                    <tbody>
                      {finalGrades.map((s, i) => (
                        <tr key={s.id}>
                          <td style={{ color: 'var(--text-dim)' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.username}</td>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td style={{ fontWeight: 600 }}>{s.abs ?? '—'}</td>
                          <td><span style={{ fontWeight: 700, fontSize: 15, color: s.grade ? gradeColor(s.grade) : 'var(--text-dim)' }}>{s.grade ?? '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Assessment groups — shown as stacked cards, no tabs */}
          {courseData.groups.length === 0 && (
            <div className="empty"><p>No assessments yet. Click "+ Add Assessment" to get started.</p></div>
          )}

          {courseData.groups.map(group => (
            <div key={group.id} className="card" style={{ marginBottom: 20 }}>
              <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>{group.label}</h3>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 5,
                      background: CAT_COLOR[group.category] || 'var(--accent)', color: 'white',
                    }}>{group.category}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {group.weightage} absolutes
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingGroup({ id: group.id, label: group.label, weightage: group.weightage })}>✏️ Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteGroup(group.id)}>🗑 Delete</button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setAddCompForm({ groupId: group.id, label: '', totalMarks: '' }); setShowAddComp(true); }}>+ Add Component</button>
                </div>
              </div>

              {group.components.length === 0 && <div className="empty" style={{ padding: '12px 0' }}><p>No components yet. Add one above.</p></div>}

              {group.components.map(comp => {
                const edits   = marksEdits[comp.id] || {};
                const isDirty = Object.keys(edits).length > 0;
                return (
                  <div key={comp.id} style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{comp.label}</span>
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>/ {comp.total_marks} marks</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingComp({ id: comp.id, label: comp.label, totalMarks: comp.total_marks })}>✏️ Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteComp(comp.id)}>🗑</button>
                        {isDirty && <button className="btn btn-primary btn-sm" onClick={() => saveMarks(comp.id)} disabled={savingComp === comp.id}>{savingComp === comp.id ? 'Saving…' : '💾 Save'}</button>}
                      </div>
                    </div>

                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>#</th><th>Roll No.</th><th>Name</th><th>Marks (/{comp.total_marks})</th><th>%</th></tr></thead>
                        <tbody>
                          {courseData.students.map((s, i) => {
                            const existing = comp.marks[s.id];
                            const editVal  = edits[s.id];
                            const display  = editVal !== undefined ? editVal : (existing !== null && existing !== undefined ? String(existing) : '');
                            const raw      = editVal !== undefined ? (editVal === '' ? null : parseFloat(editVal)) : (existing ?? null);
                            const pct      = raw !== null ? Math.round((raw / comp.total_marks) * 100) : null;
                            return (
                              <tr key={s.id}>
                                <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{i + 1}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.username}</td>
                                <td style={{ fontWeight: 500 }}>{s.name}</td>
                                <td>
                                  <input
                                    type="number" min="0" max={comp.total_marks} step="0.5"
                                    placeholder="—" value={display}
                                    onChange={e => setMark(comp.id, s.id, e.target.value)}
                                    style={{ width: 80, padding: '4px 8px', borderRadius: 6, fontSize: 13, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'monospace', outline: 'none' }}
                                  />
                                </td>
                                <td style={{ fontSize: 12, fontWeight: 600, color: pct === null ? 'var(--text-dim)' : pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
                                  {pct !== null ? `${pct}%` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {isDirty && (
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary" onClick={() => saveMarks(comp.id)} disabled={savingComp === comp.id}>
                          {savingComp === comp.id ? 'Saving…' : '💾 Save Marks'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      {/* Add Assessment Modal */}
      {showAddGroup && (
        <div className="modal-overlay" onClick={() => setShowAddGroup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Add Assessment</h3><button className="modal-close" onClick={() => setShowAddGroup(false)}>×</button></div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={addGroupForm.category} onChange={e => setAddGroupForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Label (e.g. "Quiz 1", "Mid Term 1")</label>
              <input className="form-input" value={addGroupForm.label} onChange={e => setAddGroupForm(f => ({ ...f, label: e.target.value }))} placeholder="Quiz 1" />
            </div>
            <div className="form-group">
              <label className="form-label">Absolutes (remaining: {remaining})</label>
              <input className="form-input" type="number" min="1" max={remaining} value={addGroupForm.weightage} onChange={e => setAddGroupForm(f => ({ ...f, weightage: e.target.value }))} placeholder="e.g. 10" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddGroup(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addGroup} disabled={!addGroupForm.label || !addGroupForm.weightage}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAddComp && (
        <div className="modal-overlay" onClick={() => setShowAddComp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Add Component</h3><button className="modal-close" onClick={() => setShowAddComp(false)}>×</button></div>
            <div className="form-group">
              <label className="form-label">Label (e.g. "Part A", "Week 1")</label>
              <input className="form-input" value={addCompForm.label} onChange={e => setAddCompForm(f => ({ ...f, label: e.target.value }))} placeholder="Part A" />
            </div>
            <div className="form-group">
              <label className="form-label">Total Marks</label>
              <input className="form-input" type="number" min="1" value={addCompForm.totalMarks} onChange={e => setAddCompForm(f => ({ ...f, totalMarks: e.target.value }))} placeholder="e.g. 20" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddComp(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addComp} disabled={!addCompForm.label || !addCompForm.totalMarks}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assessment Modal */}
      {editingGroup && (
        <div className="modal-overlay" onClick={() => setEditingGroup(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Edit Assessment</h3><button className="modal-close" onClick={() => setEditingGroup(null)}>×</button></div>
            <div className="form-group">
              <label className="form-label">Label</label>
              <input className="form-input" value={editingGroup.label} onChange={e => setEditingGroup(g => ({ ...g, label: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Absolutes</label>
              <input className="form-input" type="number" value={editingGroup.weightage} onChange={e => setEditingGroup(g => ({ ...g, weightage: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingGroup(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGroup}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Component Modal */}
      {editingComp && (
        <div className="modal-overlay" onClick={() => setEditingComp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Edit Component</h3><button className="modal-close" onClick={() => setEditingComp(null)}>×</button></div>
            <div className="form-group">
              <label className="form-label">Label</label>
              <input className="form-input" value={editingComp.label} onChange={e => setEditingComp(c => ({ ...c, label: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Marks</label>
              <input className="form-input" type="number" value={editingComp.totalMarks} onChange={e => setEditingComp(c => ({ ...c, totalMarks: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingComp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveComp}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Marks() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentMarks />;
  return <FacultyMarks />;
}
