import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';

export default function DetailedReports() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

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

  const handleDownload = async (quizId, quizTitle) => {
    setDownloading(quizId);
    try {
      const response = await api.get(`/admin/export/detailed/${quizId}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${quizTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_detailed_results.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to download report');
    } finally {
      setDownloading(null);
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
          <h2 style={{ fontSize: '1.25rem', marginBottom: 20 }}>Available Assessments</h2>
          
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
                          className="btn btn-primary"
                          onClick={() => handleDownload(quiz._id, quiz.title)}
                          disabled={downloading === quiz._id}
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          {downloading === quiz._id ? (
                            <><Loader2 size={16} className="spinner" /> Downloading...</>
                          ) : (
                            <><Download size={16} /> Detailed Excel</>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
