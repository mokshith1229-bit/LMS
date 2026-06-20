import { useLocation, useParams, Link } from 'react-router-dom';

export default function PublicThankYou() {
  const { token } = useParams();
  const { state } = useLocation();

  const result = state?.result;
  const title = state?.assessmentTitle || 'Assessment';
  const isAuto = state?.isAuto;
  const error = state?.error;

  // Fallback if navigated directly
  if (!result) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: 24, fontFamily: "'Inter','Roboto',sans-serif",
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12 }}>Assessment Completed</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Thank you for participating!</p>
        </div>
      </div>
    );
  }

  const isPassed = result.passed;
  const showScore = result.showScore !== false;

  // Determine gradient based on result
  const bgGradient = isPassed
    ? 'linear-gradient(160deg, #0f4c2e 0%, #10b981 60%, #065f46 100%)'
    : 'linear-gradient(160deg, #1e1b4b 0%, #4f46e5 60%, #3730a3 100%)';

  const percentage = result.percentage || 0;

  // Draw score ring via SVG
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{
      minHeight: '100vh',
      background: bgGradient,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'Inter','Roboto',sans-serif",
      padding: '0 0 60px 0',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeSlideUp { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform: none; } }
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes drawRing { from { stroke-dashoffset: ${circumference}; } to { stroke-dashoffset: ${offset}; } }
        @keyframes pop { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
        .confetti { animation: pop 0.8s ease 0.3s; }
      `}</style>

      <div style={{ maxWidth: 430, width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px' }}>

        {/* Success animation */}
        <div style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1)', marginBottom: 8 }}>
          <div style={{ fontSize: 72 }} className="confetti">
            {isPassed ? '🎉' : '📋'}
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 32, animation: 'fadeSlideUp 0.5s 0.15s ease both' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', marginBottom: 10, lineHeight: 1.2 }}>
            {error ? 'Submission Recorded' : 'Assessment Completed!'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {isAuto ? 'Time expired — your answers were auto-submitted.' : 'Thank you for participating.'}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: 4 }}>{title}</p>
        </div>

        {/* Score card */}
        {showScore && !error && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 20, padding: '28px 24px', width: '100%',
            animation: 'fadeSlideUp 0.5s 0.25s ease both',
            marginBottom: 24,
          }}>
            {/* Ring chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 14 }}>
                <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background circle */}
                  <circle
                    cx={70} cy={70} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={10}
                  />
                  {/* Progress circle */}
                  <circle
                    cx={70} cy={70} r={radius}
                    fill="none"
                    stroke={isPassed ? '#4ade80' : '#a78bfa'}
                    strokeWidth={10}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ animation: 'drawRing 1.2s 0.4s ease-out both' }}
                  />
                </svg>
                {/* Center text */}
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                    {percentage}%
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>SCORE</span>
                </div>
              </div>

              {/* Pass/Fail badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 18px',
                borderRadius: 20, fontWeight: 800, fontSize: '0.875rem',
                background: isPassed ? 'rgba(74,222,128,0.2)' : 'rgba(167,139,250,0.2)',
                border: `1px solid ${isPassed ? 'rgba(74,222,128,0.4)' : 'rgba(167,139,250,0.4)'}`,
                color: isPassed ? '#4ade80' : '#a78bfa',
                letterSpacing: '0.5px', textTransform: 'uppercase',
              }}>
                {isPassed ? '✓ Passed' : '✗ Not Passed'}
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Correct', val: result.correct, color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
                { label: 'Wrong', val: result.wrong, color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
                { label: 'Skipped', val: result.unattempted, color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
              ].map(s => (
                <div key={s.label} style={{
                  textAlign: 'center', padding: '14px 10px',
                  background: s.bg, borderRadius: 12,
                  border: `1px solid ${s.bg.replace('0.1', '0.25')}`,
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.val}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, marginTop: 4, textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {result.correct} correct out of {result.total} questions
            </div>
          </div>
        )}

        {/* Completion card (when score hidden) */}
        {(!showScore || error) && (
          <div style={{
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '28px 24px',
            width: '100%', textAlign: 'center', marginBottom: 24,
            animation: 'fadeSlideUp 0.5s 0.25s ease both',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <h3 style={{ color: '#fff', fontWeight: 800, marginBottom: 8, fontSize: '1.1rem' }}>
              Your response has been recorded
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              The assessment organizer will review the results and share them with you.
            </p>
          </div>
        )}

        {/* Thank you message */}
        <div style={{
          background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '20px 22px',
          width: '100%', textAlign: 'center',
          animation: 'fadeSlideUp 0.5s 0.35s ease both',
        }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', lineHeight: 1.65, margin: 0 }}>
            🙏 <strong style={{ color: '#fff' }}>Thank you for participating!</strong><br />
            Your response has been successfully submitted.
          </p>
        </div>

      </div>
    </div>
  );
}
