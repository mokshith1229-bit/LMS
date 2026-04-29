import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { RefreshCw, BarChart2, CheckCircle, XCircle, FileDown } from 'lucide-react';

export default function AdminResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterExam, setFilterExam] = useState('');

  const loadResults = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/results');
      setResults(data.results || []);
    } catch (err) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/admin/results/export', {
        responseType: 'blob', // Important for handling binary data
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LMS_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel file downloaded successfully!');
    } catch (err) {
      toast.error('Failed to export Excel file');
    }
  };

  useEffect(() => { loadResults(); }, []);

  const statusColors = {
    COMPLETED:  { bg: '#ebfbee', color: '#2f9e44' },
    TERMINATED: { bg: '#fff5f5', color: '#c92a2a' },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Assessment Results</h1>
            <p>View all student submission results and scores.</p>
          </div>
          <img src="/assets/cube_tech_logo.png" alt="Logo" style={{ height: 45, objectFit: 'contain' }} />
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="title-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={20} /> All Submissions
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select 
                className="input" 
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minWidth: 150 }}
                value={filterExam}
                onChange={(e) => setFilterExam(e.target.value)}
              >
                <option value="">All Exams</option>
                {[...new Set(results.map(r => r.quizTitle))].sort().map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={handleExportExcel}
                disabled={results.length === 0}
              >
                <FileDown size={14} /> Export Excel
              </button>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={loadResults}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <BarChart2 size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <p>No submissions yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Student', 'Quiz', 'Score', 'Correct', 'Wrong', 'Percentage', 'Result', 'Status', 'Submitted', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results
                    .filter(r => filterExam === '' || r.quizTitle === filterExam)
                    .map((r) => {
                    const s = statusColors[r.status] || statusColors.COMPLETED;
                    return (
                      <tr key={r.submissionId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{r.userName}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.userEmail || r.userMobile || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{r.quizTitle}</div>
                          {r.courseTitle && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.courseTitle}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.correct}/{r.total}</td>
                        <td style={{ padding: '10px 12px', color: '#2f9e44', fontWeight: 600 }}>{r.correct}</td>
                        <td style={{ padding: '10px 12px', color: '#c92a2a', fontWeight: 600 }}>{r.wrong}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.percentage}%</td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.passed
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2f9e44' }}><CheckCircle size={14} /> Pass</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c92a2a' }}><XCircle size={14} /> Fail</span>
                          }
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontWeight: 600, fontSize: '0.78rem' }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <a 
                            href={`/admin/results/${r.submissionId}`}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.75rem', 
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            View Answers
                          </a>
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
