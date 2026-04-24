import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function AssessmentPage() {
  const { quizId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const courseId = state?.courseId;

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [visited, setVisited] = useState(new Set([0]));
  const [examStarted, setExamStarted] = useState(false);
  const [_violations, setViolations] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [startTime] = useState(() => Date.now());
  const timerRef = useRef(null);
  const isSubmittingRef = useRef(false);

  const handleSubmit = useCallback(
    async (forcedReason = null) => {
      if (submitting || isSubmittingRef.current) return;
      setSubmitting(true);
      isSubmittingRef.current = true;
      clearInterval(timerRef.current);

      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (err) {
          console.log("Exit fullscreen error:", err);
        }
      }

      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const formattedAnswers = Object.entries(answers).map(([qi, si]) => ({
        questionIndex: Number(qi),
        selectedOption: Number(si),
      }));

      try {
        const { data } = await api.post('/submit', {
          quizId,
          courseId,
          answers: formattedAnswers,
          timeTaken,
          startTime,
          forcedReason: forcedReason || null,
        });

        if (forcedReason === 'timeout') toast.success("Time's up! Assessment submitted.");
        if (forcedReason === 'violation') toast.error("Assessment terminated due to security violation.");

        navigate(`/student/result/${quizId}`, { state: { submission: data.submission, courseId, forcedReason } });
      } catch (err) {
        if (err.response?.data?.submission) {
          navigate(`/student/result/${quizId}`, { state: { submission: err.response.data.submission, courseId, forcedReason } });
        } else {
          toast.error(err.response?.data?.message || 'Submission failed');
          setSubmitting(false);
          isSubmittingRef.current = false;
        }
      }
    },
    [answers, quizId, courseId, navigate, submitting]
  );

  useEffect(() => {
    api.get(`/quiz/single/${quizId}`)
      .then(({ data }) => {
        setQuiz(data.quiz);
        setTimeLeft(data.quiz.timeLimitSeconds);
        setLoading(false);
      })
      .catch(() => { toast.error('Failed to load assessment'); setLoading(false); });
  }, [quizId]);

  useEffect(() => {
    if (!examStarted || timeLeft === null || timeLeft <= 0 || submitting) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [examStarted, timeLeft === null, handleSubmit, submitting]);

  // Security Mechanisms
  useEffect(() => {
    if (!examStarted || submitting) return;

    let violationHandled = false;

    const handleViolation = () => {
      if (violationHandled || isSubmittingRef.current) return;
      violationHandled = true; // Prevent duplicate triggers simultaneously

      setViolations(prev => {
        const next = prev + 1;
        if (next === 1) {
          setShowWarning(true);
        } else if (next >= 2) {
          handleSubmit('violation'); // Strike 2 -> Auto-submit
        }
        return next;
      });

      // Cooldown to prevent blur + visibility triggering two violations instantly
      setTimeout(() => { violationHandled = false; }, 500);
    };

    const handleVisibilityChange = () => { if (document.hidden) handleViolation(); };
    const handleBlur = () => { handleViolation(); };
    const handleFullscreenChange = () => { 
      if (!document.fullscreenElement && !showWarning && !isSubmittingRef.current) {
        handleViolation(); 
      }
    };
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'c') ||
        (e.ctrlKey && e.key === 'v')
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [examStarted, submitting, showWarning, handleSubmit]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const jumpTo = (i) => {
    setCurrent(i);
    setVisited(prev => new Set([...prev, i]));
  };

  if (loading || !quiz) return (
    <div style={{ padding: 40, textAlign: 'center' }}>Loading Assessment...</div>
  );

  const startExam = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setExamStarted(true);
    } catch (_err) {
      toast.error('You must allow fullscreen to take this assessment. Click anywhere and try again.');
    }
  };

  if (!examStarted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
        <div className="card fade-in" style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
          <h1 style={{ marginBottom: 16 }}>Assessment Instructions</h1>
          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
            <img src="/assets/cube_tech_logo.png" alt="Cube Highways Logo" style={{ height: 50, objectFit: 'contain' }} />
          </div>

          <div style={{ textAlign: 'left', background: '#fff3cd', padding: 20, borderRadius: 8, marginBottom: 28, border: '1px solid #ffeeba' }}>
            <h4 style={{ color: '#856404', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>Instructions</h4>
            <ul style={{ color: '#856404', fontSize: '0.9rem', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.5 }}>
              <li>This assessment runs in <strong>strict fullscreen mode</strong>.</li>
              <li>Switching tabs, minimizing the browser, losing window focus, or exiting fullscreen will result in a <strong>hard warning</strong>.</li>
              <li>A <strong>second violation</strong> will automatically terminate and submit your exam permanently.</li>
              <li>Right-click and keyboard shortcuts (Copy/Paste, F12) are disabled.</li>
              <li>Ensure you have a stable internet connection before proceeding.</li>
            </ul>
          </div>

          <button className="btn btn-primary btn-lg" onClick={startExam} style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}>
            I Agree & Start Assessment
          </button>
        </div>
      </div>
    );
  }

  const q = quiz.questions[current];
  const total = quiz.questions.length;
  const answeredCount = Object.keys(answers).length;
  const notAnswered = total - answeredCount;
  const notVisited = total - visited.size;

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', position: 'relative' }}>
      {/* Violation Overlay */}
      {showWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(239, 68, 68, 0.98)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', padding: 24
        }}>
          <h1 style={{ fontSize: '3rem', marginBottom: 16 }}>VIOLATION DETECTED</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: 40, textAlign: 'center', maxWidth: 640 }}>
            You have left the secure exam environment (switched tabs, lost focus, or exited fullscreen).
            <br /><br />
            <strong>This is your 1st and Final warning.</strong> Another violation will automatically submit and lock your assessment.
          </p>
          <button
            className="btn"
            style={{ background: '#fff', color: '#ef4444', padding: '12px 32px', fontSize: '1.1rem', fontWeight: 700 }}
            onClick={() => {
              setShowWarning(false);
              document.documentElement.requestFullscreen().catch(() => { });
            }}
          >
            I Understand, Resume Assessment
          </button>
        </div>
      )}

      {/* Top Header - Classic Style */}
      <header className="exam-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <div className="exam-logo" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/assets/cube_tech_logo.png" alt="Cube Highways Logo" style={{ height: 35, objectFit: 'contain' }} />
        </div>
        <div className="exam-title" style={{ fontWeight: 800 }}>{quiz.title}</div>
        <div className="exam-timer-box">
          TIME LEFT: {formatTime(timeLeft)}
        </div>
      </header>

      <div className="exam-main">
        {/* Background Watermarks */}
        <div className="exam-watermark-overlay" />

        {/* Left Side: Question Area (70%) */}
        <div className="exam-content">

          {/* Top Navigation Bar - Replaced Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <div className="exam-q-number" style={{ margin: 0 }}>
              Question No. {current + 1} of {total}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                onClick={() => jumpTo(Math.max(0, current - 1))}
                disabled={current === 0}
              >
                Previous
              </button>

              {current === total - 1 ? (
                <button
                  className="btn btn-success"
                  onClick={() => handleSubmit(null)}
                  disabled={submitting}
                  style={{ padding: '8px 24px' }}
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => jumpTo(Math.min(total - 1, current + 1))}
                  style={{ padding: '8px 24px' }}
                >
                  Next
                </button>
              )}
            </div>
          </div>

          <div className="exam-q-text">
            {q.question}
          </div>

          <div className="exam-options">
            {q.options.map((opt, idx) => (
              <div
                key={idx}
                className={`exam-opt-item ${answers[current] === idx ? 'selected' : ''}`}
                onClick={() => setAnswers({ ...answers, [current]: idx })}
              >
                <input
                  type="radio"
                  name="quiz-opt"
                  checked={answers[current] === idx}
                  onChange={() => { }}
                />
                <span>{opt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Navigator Panel (30%) */}
        <aside className="exam-sidebar">
          <div className="sidebar-timer">
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 4 }}>Remaining Time</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{formatTime(timeLeft)}</div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #ddd', padding: 12, marginBottom: 16 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
              Attempt Summary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Answered:</span>
                <span style={{ color: 'green', fontWeight: 700 }}>{answeredCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Not Answered:</span>
                <span style={{ color: 'red', fontWeight: 700 }}>{notAnswered}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Not Visited:</span>
                <span style={{ color: '#666', fontWeight: 700 }}>{notVisited}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8 }}>Question Navigator</div>
          <div className="navigator-grid">
            {quiz.questions.map((_, idx) => {
              const isAnswered = answers[idx] !== undefined;
              const isVisited = visited.has(idx);
              let statusClass = '';
              if (isAnswered) statusClass = 'answered';
              else if (isVisited) statusClass = 'visited';

              return (
                <div
                  key={idx}
                  className={`nav-box ${statusClass} ${current === idx ? 'current' : ''}`}
                  onClick={() => jumpTo(idx)}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: 32 }}>
            <img
              src="/assets/branding_logo.png"
              alt="Cube Logo"
              style={{ width: '90%', opacity: 0.5, filter: 'brightness(1.1)' }}
            />
          </div>
        </aside>
      </div>

    </div>
  );
}
