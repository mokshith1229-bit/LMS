import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Search, Filter, Users, CheckCircle, XCircle, Percent, ChevronDown } from 'lucide-react';
import { getPublicAssessments, getPublicResults, getExportUrl, getPublicAssessmentAdmin } from '../../api/publicAssessmentApi';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';

export default function PublicAssessmentResults() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [selectedId, setSelectedId] = useState(id || '');
  const [assessment, setAssessment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    getPublicAssessments()
      .then(r => setAssessments(r.assessments || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      getPublicAssessmentAdmin(selectedId),
      getPublicResults(selectedId, {}),
    ])
      .then(([aRes, rRes]) => {
        setAssessment(aRes.assessment);
        setSubmissions(rRes.submissions || []);
      })
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const params = {};
    if (search) params.search = search;
    if (filterDate) params.date = filterDate;

    const timer = setTimeout(() => {
      getPublicResults(selectedId, params)
        .then(r => setSubmissions(r.submissions || []))
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [search, filterDate, selectedId]);

  const handleExport = () => {
    if (!selectedId) return;
    const token = localStorage.getItem('lms_token');
    const url = getExportUrl(selectedId);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.blob();
      })
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'public_results.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(() => toast.error('Export failed'));
  };

  const avgScore = submissions.length
    ? (submissions.reduce((s, r) => s + r.percentage, 0) / submissions.length).toFixed(1)
    : 0;
  const passCount = submissions.filter(s => s.passed).length;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Link to="/admin/public-assessments" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
                <ArrowLeft size={14} /> Public Assessments
              </Link>
            </div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={22} color="#4f46e5" />
              Results
            </h1>
            <p>View and export candidate submissions</p>
          </div>
          <button
            onClick={handleExport}
            disabled={!selectedId || submissions.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
              background: submissions.length ? 'linear-gradient(135deg, #10b981, #059669)' : '#e2e8f0',
              border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700,
              cursor: submissions.length ? 'pointer' : 'not-allowed',
            }}
          >
            <Download size={16} /> Export Excel
          </button>
        </div>

        {/* Assessment Selector */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Select Assessment</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ width: '100%', maxWidth: 500, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', background: '#fff', outline: 'none' }}
          >
            <option value="">-- Select an assessment --</option>
            {assessments.map(a => (
              <option key={a._id} value={a._id}>
                {a.title} ({a.submissionCount || 0} submissions)
              </option>
            ))}
          </select>
        </div>

        {selectedId && (
          <>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Submissions', val: submissions.length, icon: <Users size={20} />, color: '#4f46e5' },
                { label: 'Passed', val: passCount, icon: <CheckCircle size={20} />, color: '#10b981' },
                { label: 'Failed', val: submissions.length - passCount, icon: <XCircle size={20} />, color: '#ef4444' },
                { label: 'Avg Score', val: `${avgScore}%`, icon: <Percent size={20} />, color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e293b' }}>{s.val}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  placeholder="Search by name or mobile..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={15} color="#64748b" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.875rem', outline: 'none' }}
                />
                {filterDate && (
                  <button onClick={() => setFilterDate('')} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Clear</button>
                )}
              </div>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
              ) : submissions.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
                  <Users size={40} color="#e2e8f0" style={{ marginBottom: 12 }} />
                  <p>No submissions yet</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['#', 'Name', 'Mobile', 'Score', 'Percentage', 'Result', 'Submitted At', ''].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s, i) => (
                      <>
                        <tr key={s._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '14px 14px', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: '14px 14px', fontWeight: 700, color: '#1e293b' }}>{s.candidateData?.fullName || '—'}</td>
                          <td style={{ padding: '14px 14px', fontSize: '0.875rem', color: '#374151' }}>{s.candidateData?.mobile || '—'}</td>
                          <td style={{ padding: '14px 14px', fontWeight: 700, color: '#4f46e5' }}>{s.correct} / {s.correct + s.wrong + s.unattempted}</td>
                          <td style={{ padding: '14px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                                <div style={{ width: `${s.percentage}%`, height: '100%', background: s.percentage >= 60 ? '#10b981' : '#ef4444', borderRadius: 3, transition: 'width 0.4s' }} />
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.percentage >= 60 ? '#10b981' : '#ef4444', minWidth: 42 }}>
                                {s.percentage}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 14px' }}>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                              background: s.passed ? '#d1fae5' : '#fee2e2',
                              color: s.passed ? '#065f46' : '#991b1b',
                              textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                              {s.passed ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 14px', fontSize: '0.8rem', color: '#64748b' }}>
                            {new Date(s.submittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '14px 14px' }}>
                            <button
                              onClick={() => setExpandedRow(expandedRow === s._id ? null : s._id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.8rem', fontWeight: 600 }}
                            >
                              Details <ChevronDown size={14} style={{ transform: expandedRow === s._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                          </td>
                        </tr>
                        {expandedRow === s._id && (
                          <tr key={`${s._id}-expanded`} style={{ background: '#f5f3ff' }}>
                            <td colSpan={8} style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                                {[
                                  ['Correct', s.correct, '#10b981'],
                                  ['Wrong', s.wrong, '#ef4444'],
                                  ['Unattempted', s.unattempted, '#f59e0b'],
                                  ['Time Taken', `${Math.floor(s.timeTaken / 60)}m ${s.timeTaken % 60}s`, '#4f46e5'],
                                ].map(([label, val, color]) => (
                                  <div key={label}>
                                    <span style={{ color: '#64748b', fontWeight: 600 }}>{label}: </span>
                                    <span style={{ color, fontWeight: 800 }}>{val}</span>
                                  </div>
                                ))}
                                {s.candidateData?.flatNo && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Flat No: </span><span style={{ fontWeight: 700 }}>{s.candidateData.flatNo}</span></div>}
                                {s.candidateData?.email && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Email: </span><span style={{ fontWeight: 700 }}>{s.candidateData.email}</span></div>}
                                {s.candidateData?.organization && <div><span style={{ color: '#64748b', fontWeight: 600 }}>Org: </span><span style={{ fontWeight: 700 }}>{s.candidateData.organization}</span></div>}
                                {s.candidateData?.city && <div><span style={{ color: '#64748b', fontWeight: 600 }}>City: </span><span style={{ fontWeight: 700 }}>{s.candidateData.city}</span></div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
