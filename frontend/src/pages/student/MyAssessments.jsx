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

  const canStart = (a) => {
    const isUnderway = a.status === 'NOT_STARTED' || a.status === 'IN_PROGRESS';
    if (!isUnderway) return false;

    // If it's a batch assignment with a schedule, check the window
    if (a.type === 'batch') {
      const now = new Date();
      if (now < new Date(a.startTime)) return false; // Too early
      if (now > new Date(a.endTime)) return false;   // Too late
    }
    return true;
  };

  const getScheduleLabel = (a) => {
    if (a.type !== 'batch') return null;
    const now = new Date();
    const start = new Date(a.startTime);
    const end = new Date(a.endTime);

    const istOptions = { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' };

    if (now < start) return { label: `Opens: ${start.toLocaleString("en-IN", istOptions)}`, color: '#666' };
    if (now > end) return { label: 'Window Expired', color: '#c92a2a' };
    return { label: `Closes: ${end.toLocaleString("en-IN", istOptions)}`, color: '#2f9e44' };
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="simulation-banner fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>Welcome {user?.name || 'Student'}</h1>
              <p>Track your progress and view completed certifications.</p>
            </div>
            <img src="/assets/minds_logo.png" alt="Minds Logo" style={{ height: 60, objectFit: 'contain' }} />
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
              const startable = canStart(a);
              const sched = getScheduleLabel(a);

              return (
                <div key={a.assignmentId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Status badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: sc.bg, color: sc.color,
                        padding: '4px 12px', borderRadius: 100,
                        fontWeight: 700, fontSize: '0.78rem'
                      }}>
                        {sc.icon} {sc.label}
                      </span>
                      {a.type === 'batch' && (
                        <span style={{ fontSize: '0.65rem', background: '#e9ecef', color: '#495057', padding: '2px 8px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase' }}>
                          Batch
                        </span>
                      )}
                    </div>
                    {a.duration && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={13} /> {formatDuration(a.duration)}
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {a.title}
                  </h3>

                  {sched && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: sched.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {sched.label}
                    </div>
                  )}

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {a.type === 'batch' ? 'Batch Assignment' : 'Direct Assignment'} · {new Date(a.assignedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                    {a.submittedAt && (
                      <span style={{ marginLeft: 12 }}>
                        · Submitted: {new Date(a.submittedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
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
                      fontSize: '0.875rem', textAlign: 'center',
                      opacity: (a.type === 'batch' && a.status === 'NOT_STARTED') ? 0.6 : 1
                    }}>
                      {a.status === 'COMPLETED' ? '✓ Assessment Completed' : 
                       a.status === 'TERMINATED' ? '✗ Assessment Terminated' :
                       (a.type === 'batch' && new Date() < new Date(a.startTime)) ? '⏳ Waiting for Window' :
                       '✗ Window Expired'}
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
