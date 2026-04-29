import { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Download, Loader2, FileSpreadsheet, Users, ArrowLeft } from 'lucide-react';

export default function DetailedReports() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // New States for Workflow
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const { data } = await api.get('/quiz');
      setQuizzes(Array.isArray(data) ? data : data.quizzes || []);
    } catch {
      toast.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudents = async (quiz) => {
    setSelectedQuiz(quiz);
    setLoadingSubmissions(true);
    setSelectedIds(new Set());
    
    try {
      // Fetch all submissions, we will filter for this quiz
      const { data } = await api.get('/admin/results');
      if (data.success) {
        // results is an array of mapped submission objects
        const filtered = data.results.filter(r => r.quizTitle === quiz.title);
        setSubmissions(filtered);
      }
    } catch (err) {
      toast.error('Failed to load students');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === submissions.length) {
      setSelectedIds(new Set()); // Deselect all
    } else {
      setSelectedIds(new Set(submissions.map(s => s.submissionId))); // Select all
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDownload = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    
    try {
      const response = await api.post(`/admin/export/detailed/${selectedQuiz._id}`, 
        { submissionIds: Array.from(selectedIds) },
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedQuiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_detailed_results.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 8, color: 'var(--accent)' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h1>Detailed Excel Reports</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Download question-by-question breakdown of student assessments</p>
            </div>
          </div>
        </div>

        <div className="card">
          {!selectedQuiz ? (
            // VIEW 1: Assessment List
            <>
              <h2 style={{ fontSize: '1.25rem', marginBottom: 20 }}>Select an Assessment</h2>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 className="spinner" size={32} color="var(--accent)" />
                </div>
              ) : quizzes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No assessments found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Assessment Title</th>
                        <th>Course</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quizzes.map((quiz) => (
                        <tr key={quiz._id}>
                          <td style={{ fontWeight: 600 }}>{quiz.title}</td>
                          <td>{quiz.courseId?.title || 'Unknown Course'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleViewStudents(quiz)}
                              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                            >
                              <Users size={16} /> View Students
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            // VIEW 2: Student List
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button 
                    className="btn btn-icon" 
                    onClick={() => setSelectedQuiz(null)}
                    title="Back to Assessments"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                    Students for: <span style={{ color: 'var(--accent)' }}>{selectedQuiz.title}</span>
                  </h2>
                </div>
                
                <button
                  className="btn btn-primary"
                  onClick={handleDownload}
                  disabled={downloading || selectedIds.size === 0}
                  style={{ padding: '8px 20px' }}
                >
                  {downloading ? (
                    <><Loader2 size={16} className="spinner" /> Downloading...</>
                  ) : (
                    <><Download size={16} /> Download Selected ({selectedIds.size})</>
                  )}
                </button>
              </div>

              {loadingSubmissions ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <Loader2 className="spinner" size={32} color="var(--accent)" />
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No students have submitted this assessment yet.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.size === submissions.length && submissions.length > 0}
                            onChange={toggleSelectAll}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Score</th>
                        <th>Correct</th>
                        <th>Wrong</th>
                        <th>Percentage</th>
                        <th>Result</th>
                        <th>Status</th>
                        <th>Date Submitted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => {
                        const statusColors = {
                          COMPLETED:  { bg: '#ebfbee', color: '#2f9e44' },
                          TERMINATED: { bg: '#fff5f5', color: '#c92a2a' },
                        };
                        const s = statusColors[sub.status] || statusColors.COMPLETED;
                        return (
                          <tr key={sub.submissionId} className={selectedIds.has(sub.submissionId) ? 'selected-row' : ''}>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedIds.has(sub.submissionId)}
                                onChange={() => toggleSelect(sub.submissionId)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ fontWeight: 600 }}>{sub.userName}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{sub.userEmail}</td>
                            <td style={{ fontWeight: 700 }}>{sub.correct}/{sub.total}</td>
                            <td style={{ color: '#2f9e44', fontWeight: 600 }}>{sub.correct}</td>
                            <td style={{ color: '#c92a2a', fontWeight: 600 }}>{sub.wrong}</td>
                            <td>
                              <span style={{ 
                                color: sub.passed ? 'var(--success)' : '#ef4444',
                                fontWeight: 700, background: sub.passed ? '#f0fdf4' : '#fef2f2',
                                padding: '2px 8px', borderRadius: 4
                              }}>
                                {sub.percentage}%
                              </span>
                            </td>
                            <td>
                              {sub.passed
                                ? <span style={{ color: '#2f9e44', fontWeight: 600 }}>Pass</span>
                                : <span style={{ color: '#c92a2a', fontWeight: 600 }}>Fail</span>
                              }
                            </td>
                            <td>
                              <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontWeight: 600, fontSize: '0.78rem' }}>
                                {sub.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {new Date(sub.submittedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
