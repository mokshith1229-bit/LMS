import { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import {
  UserPlus, Loader2, CheckCircle, ClipboardList,
  Trash2, RefreshCw, Search, Users, Send,
} from 'lucide-react';

const STATUS_COLORS = {
  NOT_STARTED: { bg: '#f0f4ff', color: '#3b5bdb', label: 'Not Started' },
  IN_PROGRESS:  { bg: '#fff9db', color: '#e67700', label: 'In Progress' },
  COMPLETED:    { bg: '#ebfbee', color: '#2f9e44', label: 'Completed' },
  TERMINATED:   { bg: '#fff5f5', color: '#c92a2a', label: 'Terminated' },
};

export default function AssignQuiz() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [quizzes, setQuizzes]           = useState([]);
  const [students, setStudents]         = useState([]);
  const [assignments, setAssignments]   = useState([]);

  // ── UI State ──────────────────────────────────────────────────────────────
  const [loadingQuizzes,      setLoadingQuizzes]      = useState(true);
  const [loadingStudents,     setLoadingStudents]      = useState(true);
  const [loadingAssignments,  setLoadingAssignments]   = useState(true);
  const [submitting,          setSubmitting]           = useState(false);

  // ── Selection / Filter ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [search, setSearch]             = useState('');

  // ── Filtered students list ────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [students, search]);

  const allSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every(s => selectedIds.has(s._id));

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadQuizzes = async () => {
    try {
      const { data } = await api.get('/quiz');
      setQuizzes(Array.isArray(data) ? data : data.quizzes || []);
    } catch {
      toast.error('Failed to load quizzes');
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data } = await api.get('/admin/users');
      setStudents(data.users || []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const { data } = await api.get('/admin/assignments');
      setAssignments(data.assignments || []);
    } catch {
      console.error('Failed to load assignments');
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
    loadStudents();
    loadAssignments();
  }, []);

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const toggleOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all currently visible
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredStudents.forEach(s => next.delete(s._id));
        return next;
      });
    } else {
      // Select all currently visible
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredStudents.forEach(s => next.add(s._id));
        return next;
      });
    }
  };

  // ── Batch assign ──────────────────────────────────────────────────────────
  const handleBatchAssign = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    if (!selectedQuizId) {
      toast.error('Select a quiz first');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/admin/assign-batch', {
        userIds: Array.from(selectedIds),
        quizId: selectedQuizId,
      });
      toast.success(data.message || `Assigned to ${data.assignedCount} student(s)`);
      if (data.skippedCount > 0) {
        toast(`${data.skippedCount} already assigned — skipped`, { icon: 'ℹ️' });
      }
      setSelectedIds(new Set());
      setSelectedQuizId('');
      loadAssignments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Batch assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Remove single assignment ──────────────────────────────────────────────
  const handleRemove = async (assignmentId) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await api.delete(`/admin/assign/${assignmentId}`);
      toast.success('Assignment removed');
      setAssignments(prev => prev.filter(a => a._id !== assignmentId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">

        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Assign Quiz</h1>
            <p>Select students, choose a quiz, and assign in one click.</p>
          </div>
          <img src="/assets/cube_tech_logo.png" alt="Logo" style={{ height: 45, objectFit: 'contain' }} />
        </div>

        {/* ── BATCH ASSIGN PANEL ─────────────────────────────────────────── */}
        <div className="card mb-32">
          <h2 className="title-sm" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} /> Student Selection
          </h2>

          {/* Toolbar: search + quiz picker + assign btn */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
            {/* Search */}
            <div style={{ flex: '1 1 200px', position: 'relative' }}>
              <label className="form-label">Search Students</label>
              <Search size={15} style={{ position: 'absolute', left: 12, bottom: 12, color: 'var(--text-muted)' }} />
              <input
                id="student-search"
                className="form-input"
                style={{ paddingLeft: 36 }}
                placeholder="Name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Quiz picker */}
            <div style={{ flex: '1 1 220px' }}>
              <label className="form-label">Quiz to Assign</label>
              {loadingQuizzes ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingTop: 10 }}>Loading…</div>
              ) : (
                <select
                  id="batch-quiz-select"
                  className="form-input"
                  value={selectedQuizId}
                  onChange={e => setSelectedQuizId(e.target.value)}
                >
                  <option value="">— Select a quiz —</option>
                  {quizzes.map(q => (
                    <option key={q._id} value={q._id}>
                      {q.courseId?.title ? `${q.courseId.title} — ` : ''}{q.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Assign button */}
            <button
              id="batch-assign-btn"
              className="btn btn-primary"
              onClick={handleBatchAssign}
              disabled={submitting || selectedIds.size === 0 || !selectedQuizId}
              style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-end' }}
            >
              {submitting
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : <Send size={16} />}
              {submitting
                ? 'Assigning…'
                : `Assign to ${selectedIds.size > 0 ? selectedIds.size : ''} Student${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          {/* Selection summary pill */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12,
              background: '#f0f4ff', color: '#3b5bdb', padding: '5px 14px',
              borderRadius: 100, fontSize: '0.82rem', fontWeight: 700,
            }}>
              <CheckCircle size={13} />
              {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{ background: 'none', border: 'none', color: '#3b5bdb', cursor: 'pointer', padding: 0, fontSize: '0.8rem', fontWeight: 700 }}
              >
                ✕ Clear
              </button>
            </div>
          )}

          {/* Student table */}
          {loadingStudents ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : students.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
              <p>No student accounts found. Ask students to register first.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', width: 40 }}>
                      <input
                        type="checkbox"
                        id="select-all"
                        checked={allSelected}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </th>
                    {['Name', 'Email', 'Registered'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No students match "{search}"
                      </td>
                    </tr>
                  ) : filteredStudents.map(s => {
                    const checked = selectedIds.has(s._id);
                    return (
                      <tr
                        key={s._id}
                        onClick={() => toggleOne(s._id)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: checked ? '#f5f8ff' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOne(s._id)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: checked ? 700 : 500 }}>{s.name}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{s.email || s.mobile || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── ALL ASSIGNMENTS TABLE ──────────────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="title-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={20} /> All Assignments
            </h2>
            <button
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={loadAssignments}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {loadingAssignments ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <p>No assignments yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Student', 'Quiz', 'Status', 'Assigned At', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => {
                    const s = STATUS_COLORS[a.status] || STATUS_COLORS.NOT_STARTED;
                    return (
                      <tr key={a._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{a.userId?.name || '—'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{a.userId?.email || a.userId?.mobile || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{a.quizId?.title || '—'}</div>
                          {a.quizId?.courseId?.title && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{a.quizId.courseId.title}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: s.bg, color: s.color,
                            padding: '3px 10px', borderRadius: 100,
                            fontWeight: 600, fontSize: '0.78rem',
                          }}>
                            {s.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                          {new Date(a.assignedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '0.8rem', background: '#fff5f5', color: '#c92a2a', border: '1px solid #ffc9c9' }}
                            onClick={() => handleRemove(a._id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
