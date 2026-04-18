import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Timer, ChevronRight, Send } from 'lucide-react';

export default function QuizPage() {
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
  const startTime = useRef(Date.now());
  const timerRef = useRef(null);

  // Submit handler (memoized so timer can call it)
  const handleSubmit = useCallback(
    async (forced = false) => {
      if (submitting) return;
      setSubmitting(true);
      clearInterval(timerRef.current);

      const timeTaken = Math.round((Date.now() - startTime.current) / 1000);
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
        });
        if (forced) toast.success("Time's up! Submitting your answers…");
        navigate(`/student/result/${quizId}`, { state: { submission: data.submission, courseId } });
      } catch (err) {
        if (err.response?.data?.submission) {
          navigate(`/student/result/${quizId}`, { state: { submission: err.response.data.submission, courseId } });
        } else {
          toast.error(err.response?.data?.message || 'Submission failed');
          setSubmitting(false);
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
      .catch(() => { toast.error('Failed to load quiz'); setLoading(false); });
  }, [quizId]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft === null]); // only start once

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const selectAnswer = (optIdx) => {
    setAnswers({ ...answers, [current]: optIdx });
  };

  if (loading || !quiz) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="loading-spinner"><div className="spinner" /></div>
      </main>
    </div>
  );

  const q = quiz.questions[current];
  const progress = Math.round(((current + 1) / quiz.questions.length) * 100);
  const answered = Object.keys(answers).length;
  const isLast = current === quiz.questions.length - 1;
  const timerDanger = timeLeft !== null && timeLeft < 60;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="quiz-container fade-in">
          {/* Header & Timer */}
          <div className="page-header" style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: '1.5rem' }}>{quiz.title}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>{answered} of {quiz.questions.length} answered</p>
          </div>

          {/* Progress + Timer bar */}
          <div className="quiz-progress-wrap">
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {current + 1}/{quiz.questions.length}
            </span>
            {timeLeft !== null && (
              <div className={`quiz-timer ${timerDanger ? 'danger' : ''}`}>
                <Timer size={14} />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>

          {/* Question */}
          <div className="quiz-question-card">
            <p className="question-number">Question {current + 1} of {quiz.questions.length}</p>
            <p className="question-text">{q.question}</p>

            <div className="options-list">
              {q.options.map((opt, oIdx) => (
                <div
                  key={oIdx}
                  id={`option-${oIdx}`}
                  className={`option-item ${answers[current] === oIdx ? 'selected' : ''}`}
                  onClick={() => selectAnswer(oIdx)}
                >
                  <div className="option-radio">
                    {answers[current] === oIdx && <span />}
                  </div>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              id="prev-btn"
              className="btn btn-secondary"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0 || submitting}
            >
              ← Previous
            </button>

            {isLast ? (
              <button
                id="submit-quiz-btn"
                className="btn btn-primary btn-lg"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                <Send size={16} />
                {submitting ? 'Submitting…' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                id="next-btn"
                className="btn btn-primary"
                onClick={() => setCurrent((c) => Math.min(quiz.questions.length - 1, c + 1))}
                disabled={submitting}
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* Question dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {quiz.questions.map((_, i) => (
              <div
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: i === current ? 'var(--accent)' : answers[i] !== undefined ? 'var(--success-dim)' : 'var(--bg-card)',
                  color: i === current ? '#fff' : answers[i] !== undefined ? 'var(--success)' : 'var(--text-muted)',
                  border: `2px solid ${i === current ? 'var(--accent)' : answers[i] !== undefined ? 'var(--success)' : 'var(--border)'}`,
                  transition: 'all 0.2s',
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
