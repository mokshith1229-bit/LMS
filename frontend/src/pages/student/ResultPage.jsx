import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { motion } from 'framer-motion';

export default function ResultPage() {
  const { state } = useLocation();
  const { quizId } = useParams();
  const navigate = useNavigate();

  const submission = state?.submission;
  const courseId = state?.courseId;
  const forcedReason = state?.forcedReason; // 'violation', 'timeout', or null

  if (!submission) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>No result data found</h3>
            <button className="btn btn-primary" onClick={() => navigate('/student')}>
              Go to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { score, total, percentage, passed, timeTaken } = submission;

  const formatTime = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  // Determine which graffiti message to show
  const renderGraffiti = () => {
    if (forcedReason === 'violation') {
      return (
        <motion.div
          initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
          style={{ color: '#ef4444', textAlign: 'center', margin: '40px 0 60px' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 10 }}>🚨</div>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px' }}>
            TERMINATED
          </h1>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 8 }}>
            You are terminated due to violation of rules.
          </h2>
        </motion.div>
      );
    }

    if (passed) {
      return (
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <motion.div
            initial={{ scale: 0.3, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 150, damping: 12 }}
            style={{ color: 'var(--accent)', textAlign: 'center', margin: '40px 0 60px', zIndex: 10, position: 'relative' }}
          >
            <motion.div
              animate={{ rotate: [0, -15, 15, -15, 15, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, delay: 0.3, ease: "easeInOut" }}
              style={{ fontSize: '6rem', marginBottom: 10, textShadow: '0 10px 20px rgba(0,0,0,0.15)' }}
            >
              🏆
            </motion.div>
            <h1 style={{
              fontSize: '2.8rem',
              fontWeight: 900,
              fontFamily: '"Comic Sans MS", "Marker Felt", cursive, sans-serif',
              background: 'linear-gradient(135deg, #8DC63F, #22c55e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 4px 12px rgba(141, 198, 63, 0.2)'
            }}>
              Yayy! You successfully completed the course! 🎉
            </h1>
          </motion.div>
        </div>
      );
    }

    // Default Fail
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100 }}
        style={{ color: '#f97316', textAlign: 'center', margin: '40px 0 60px' }}
      >
        <motion.div style={{ fontSize: '5rem', marginBottom: 10 }}>😢</motion.div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: '"Comic Sans MS", "Marker Felt", cursive, sans-serif' }}>
          Oops! You have failed the test.
        </h1>
      </motion.div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Graffiti Animation Zone */}
        {renderGraffiti()}

        {/* Minimal Stats Box */}
        <div style={{ maxWidth: 500, width: '100%' }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 16, background: '#f8fafc', fontWeight: 700, borderBottom: '1px solid #ddd', textAlign: 'center', fontSize: '1.1rem' }}>
              Result Summary
            </div>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '16px', borderBottom: '1px solid #eee' }}>Time Taken</td>
                  <td style={{ padding: '16px', borderBottom: '1px solid #eee', fontWeight: 700, textAlign: 'right' }}>
                    {formatTime(timeTaken)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '16px', borderBottom: '1px solid #eee' }}>No. of Questions</td>
                  <td style={{ padding: '16px', borderBottom: '1px solid #eee', fontWeight: 700, textAlign: 'right' }}>
                    {total}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '16px' }}>Result Stats</td>
                  <td style={{ padding: '16px', fontWeight: 800, fontSize: '1.2rem', textAlign: 'right', color: passed ? 'var(--accent)' : '#f97316' }}>
                    {percentage}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 32, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate(courseId ? `/student/courses/${courseId}` : '/student')}>
              Back to Course
            </button>
            {!passed && forcedReason !== 'violation' && (
              <button className="btn btn-primary" onClick={() => navigate(`/student/quiz/${quizId}`, { state: { courseId } })}>
                Retake Assessment
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/student')}>
              Dashboard
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
