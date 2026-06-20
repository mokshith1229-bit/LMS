import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { submitPublicAssessment } from '../../api/publicAssessmentApi';

export default function PublicExam() {
  const { token } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const assessment = state?.assessment;
  const candidateData = state?.candidateData || {};

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(assessment?.duration || 1800);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [startTime] = useState(() => Date.now());

  const timerRef = useRef(null);
  const isSubmittingRef = useRef(false);
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // If accessed directly without state, redirect back to landing
  useEffect(() => {
    if (!assessment) {
      navigate(`/${token}`, { replace: true });
    }
  }, [assessment, token, navigate]);

  const doSubmit = useCallback(async (isAuto = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);

    const currentAnswers = answersRef.current;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    const formattedAnswers = (assessment?.questions || []).map((_, idx) =>
      currentAnswers[idx] !== undefined ? currentAnswers[idx] : null
    );

    try {
      const { result } = await submitPublicAssessment(token, {
        candidateData,
        answers: formattedAnswers,
        timeTaken,
      });

      navigate(`/${token}/done`, {
        state: { result, assessmentTitle: assessment.title, isAuto },
        replace: true,
      });
    } catch (err) {
      // Even on error, navigate to a basic done page
      navigate(`/${token}/done`, {
        state: {
          result: { correct: 0, wrong: 0, unattempted: assessment.questions.length, percentage: 0, showScore: false },
          assessmentTitle: assessment.title,
          isAuto,
          error: err.response?.data?.message || 'Submission error',
        },
        replace: true,
      });
    }
  }, [token, assessment, candidateData, startTime, navigate]);

  const doSubmitRef = useRef(doSubmit);
  useEffect(() => { doSubmitRef.current = doSubmit; }, [doSubmit]);

  // Countdown timer
  useEffect(() => {
    if (!assessment) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          doSubmitRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [assessment]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!assessment) return null;

  const questions = assessment.questions || [];
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const q = questions[current];

  const isUrgent = timeLeft <= 60;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Inter', 'Roboto', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes fadeIn { from { opacity:0; transform: translateY(12px);} to { opacity:1; transform: none;} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .opt-item { transition: all 0.18s; }
        .opt-item:hover { background: #ede9fe !important; border-color: #a78bfa !important; transform: scale(1.01); }
        .opt-item.sel { background: #ede9fe !important; border-color: #4f46e5 !important; }
        .nav-dot { transition: all 0.15s; }
        .nav-dot:hover { transform: scale(1.15); }
      `}</style>

      {/* Fixed Header — mobile width */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'center',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 430, width: '100%', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
            {/* Title */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Assessment
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {assessment.title}
              </div>
            </div>
            {/* Timer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: isUrgent ? '#fee2e2' : '#f5f3ff',
              border: `1px solid ${isUrgent ? '#fca5a5' : '#ddd6fe'}`,
              animation: isUrgent ? 'pulse 1s infinite' : 'none',
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isUrgent ? '#ef4444' : '#64748b' }}>⏱</span>
              <span style={{
                fontFamily: 'monospace', fontSize: '1rem', fontWeight: 900,
                color: isUrgent ? '#ef4444' : '#4f46e5',
                letterSpacing: '1px',
              }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${((current + 1) / total) * 100}%`,
              background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 430, width: '100%', paddingTop: 72, paddingBottom: 180, minHeight: '100vh' }}>
        {/* Question card */}
        <div style={{ padding: '24px 16px 0', animation: 'fadeIn 0.3s ease' }} key={current}>
          {/* Q counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Question {current + 1} of {total}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
              {answered} answered
            </span>
          </div>

          {/* Question image */}
          {q?.imageUrl && (
            <div style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff' }}>
              <img
                src={q.imageUrl} alt="Question"
                style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }}
                onError={e => e.target.style.display = 'none'}
              />
            </div>
          )}

          {/* Question text */}
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
            padding: '18px 18px', marginBottom: 16,
            fontSize: '1rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.65,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            {q?.question}
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(q?.options || []).map((opt, oIdx) => {
              const isSelected = answers[current] === oIdx;
              return (
                <button
                  key={oIdx}
                  className={`opt-item${isSelected ? ' sel' : ''}`}
                  onClick={() => setAnswers(prev => ({ ...prev, [current]: oIdx }))}
                  style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '15px 16px', borderRadius: 12,
                    border: `2px solid ${isSelected ? '#4f46e5' : '#e2e8f0'}`,
                    background: isSelected ? '#ede9fe' : '#fff',
                    cursor: 'pointer', fontSize: '0.95rem',
                    fontWeight: isSelected ? 700 : 500, color: isSelected ? '#4f46e5' : '#374151',
                    boxShadow: isSelected ? '0 2px 8px rgba(79,70,229,0.15)' : 'none',
                  }}
                >
                  {/* Option letter */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 900,
                    background: isSelected ? '#4f46e5' : '#f1f5f9',
                    color: isSelected ? '#fff' : '#64748b',
                    transition: 'all 0.18s',
                  }}>
                    {String.fromCharCode(65 + oIdx)}
                  </div>
                  <span style={{ flex: 1, lineHeight: 1.45 }}>{opt}</span>
                  {isSelected && (
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        display: 'flex', justifyContent: 'center', zIndex: 100,
      }}>
        <div style={{ maxWidth: 430, width: '100%', padding: '12px 16px 16px' }}>
          {/* Question dots navigator */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
            marginBottom: 10, scrollbarWidth: 'none',
          }}>
            {questions.map((_, idx) => {
              const isAnswered = answers[idx] !== undefined;
              const isCurrent = idx === current;
              return (
                <button
                  key={idx}
                  className="nav-dot"
                  onClick={() => setCurrent(idx)}
                  style={{
                    minWidth: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    border: isCurrent ? '2px solid #4f46e5' : '1.5px solid transparent',
                    background: isCurrent ? '#4f46e5' : isAnswered ? '#10b981' : '#f1f5f9',
                    color: isCurrent || isAnswered ? '#fff' : '#64748b',
                    fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Prev / Next / Submit */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              style={{
                flex: 1, padding: '13px', borderRadius: 12, fontWeight: 700,
                background: current === 0 ? '#f1f5f9' : '#fff',
                border: '1.5px solid #e2e8f0', color: current === 0 ? '#cbd5e1' : '#374151',
                cursor: current === 0 ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
                transition: 'all 0.18s',
              }}
            >
              ← Prev
            </button>

            {current < total - 1 ? (
              <button
                onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
                style={{
                  flex: 2, padding: '13px', borderRadius: 12, fontWeight: 800,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(79,70,229,0.3)', transition: 'all 0.18s',
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={submitting}
                style={{
                  flex: 2, padding: '13px', borderRadius: 12, fontWeight: 800,
                  background: submitting ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: '#fff',
                  cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'all 0.18s',
                }}
              >
                {submitting ? '...' : '✓ Submit'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            maxWidth: 430, width: '100%',
            background: '#fff', borderRadius: '20px 20px 0 0',
            padding: '28px 24px 40px',
            animation: 'fadeIn 0.25s ease',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#f0fdf4', border: '2px solid #bbf7d0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: '1.5rem',
              }}>✓</div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>
                Submit Assessment?
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                You've answered <strong style={{ color: '#4f46e5' }}>{answered}</strong> of <strong>{total}</strong> questions.
                {answered < total && <span style={{ color: '#ef4444' }}> {total - answered} unanswered.</span>}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => { setShowConfirm(false); doSubmit(false); }}
                disabled={submitting}
                style={{
                  width: '100%', padding: '16px', borderRadius: 12, fontWeight: 800,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                }}
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700,
                  background: '#f8fafc', border: '1.5px solid #e2e8f0',
                  color: '#64748b', fontSize: '0.95rem', cursor: 'pointer',
                }}
              >
                Go Back & Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
