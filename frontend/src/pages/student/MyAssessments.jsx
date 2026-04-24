import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { ClipboardList, PlayCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function MyAssessments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/assignments/my')
      .then(({ data }) => setAssignments(data.assignments || []))
      .catch(() => toast.error('Failed to load your assessments'))
      .finally(() => setLoading(false));
  }, []);

  const statusConfig = {
    NOT_STARTED: { label: 'Not Started', color: '#3b5bdb', bg: '#f0f4ff', icon: <Clock size={14} /> },
    IN_PROGRESS:  { label: 'In Progress', color: '#e67700', bg: '#fff9db', icon: <PlayCircle size={14} /> },
    COMPLETED:    { label: 'Completed',   color: '#2f9e44', bg: '#ebfbee', icon: <CheckCircle2 size={14} /> },
    TERMINATED:   { label: 'Terminated',  color: '#c92a2a', bg: '#fff5f5', icon: <XCircle size={14} /> },
  };

  const formatDuration = (secs) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m} min`;
  };

  const handleStart = (quizId) => {
    navigate(`/student/quiz/${quizId}`);
  };

  const canStart = (status) => status === 'NOT_STARTED' || status === 'IN_PROGRESS';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="simulation-banner fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>My Assessments</h1>
              <p>Quizzes assigned to you by your administrator.</p>
            </div>
            <img src="/assets/cube_tech_logo.png" alt="Logo" style={{ height: 45, objectFit: 'contain' }} />
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : assignments.length === 0 ? (
          <div className="empty-state card fade-in">
            <ClipboardList size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3>No assessments assigned</h3>
            <p>Your administrator hasn't assigned any quizzes to you yet.</p>
          </div>
        ) : (
          <div className="courses-grid fade-in">
            {assignments.map((a) => {
              const sc = statusConfig[a.status] || statusConfig.NOT_STARTED;
              const startable = canStart(a.status);

              return (
                <div key={a.assignmentId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Status badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: sc.bg, color: sc.color,
                      padding: '4px 12px', borderRadius: 100,
                      fontWeight: 700, fontSize: '0.78rem'
                    }}>
                      {sc.icon} {sc.label}
                    </span>
                    {a.duration && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {formatDuration(a.duration)}
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {a.title}
                  </h3>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Assigned: {new Date(a.assignedAt).toLocaleDateString()}
                    {a.submittedAt && (
                      <span style={{ marginLeft: 12 }}>
                        · Submitted: {new Date(a.submittedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {startable ? (
                    <button
                      id={`start-quiz-${a.quizId}`}
                      className="btn btn-primary"
                      style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => handleStart(a.quizId)}
                    >
                      <PlayCircle size={16} />
                      {a.status === 'IN_PROGRESS' ? 'Continue Assessment' : 'Start Assessment'}
                    </button>
                  ) : (
                    <div style={{
                      marginTop: 4, padding: '10px 16px',
                      background: sc.bg, color: sc.color,
                      borderRadius: 8, fontWeight: 600,
                      fontSize: '0.875rem', textAlign: 'center'
                    }}>
                      {a.status === 'COMPLETED' ? '✓ Assessment Completed' : '✗ Assessment Terminated'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
