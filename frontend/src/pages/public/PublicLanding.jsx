import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublicAssessmentByToken } from '../../api/publicAssessmentApi';

export default function PublicLanding() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    getPublicAssessmentByToken(token)
      .then(({ assessment: a }) => {
        setAssessment(a);
        // Initialize form with empty values
        const init = {};
        (a.candidateFields || []).forEach(f => { init[f.fieldName] = ''; });
        setFormData(init);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Assessment not found or no longer available.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const validate = () => {
    const errs = {};
    (assessment.candidateFields || []).forEach(f => {
      if (f.required && !formData[f.fieldName]?.trim()) {
        errs[f.fieldName] = `${f.label} is required`;
      }
      if (f.fieldName === 'mobile' && f.enabled && formData.mobile) {
        if (!/^\d{10}$/.test(formData.mobile.trim())) {
          errs.mobile = 'Enter a valid 10-digit mobile number';
        }
      }
    });
    return errs;
  };

  const handleStart = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    // Pass candidate data + assessment questions via navigation state
    navigate(`/${token}/exam`, {
      state: { assessment, candidateData: formData },
    });
  };

  // Background style
  const getBg = () => {
    if (!assessment) return { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' };
    if (assessment.backgroundTheme === 'solid') return { background: assessment.solidColor };
    if (assessment.backgroundTheme === 'gradient')
      return { background: `linear-gradient(135deg, ${assessment.gradientFrom}, ${assessment.gradientTo})` };
    if (assessment.backgroundTheme === 'banner' && assessment.bannerImage)
      return {
        backgroundImage: `url(${assessment.bannerImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    return { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' };
  };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{
            width: 48, height: 48, border: '4px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.9 }}>Loading Assessment...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: 24,
      }}>
        <div style={{
          maxWidth: 400, width: '100%', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 40, textAlign: 'center',
        }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>⛔</div>
          <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 800, marginBottom: 12 }}>
            Assessment Unavailable
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>{error}</p>
        </div>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    border: '1.5px solid rgba(255,255,255,0.25)',
    borderRadius: 12,
    fontSize: '16px', // prevents iOS zoom
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    outline: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    appearance: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh',
      ...getBg(),
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 0 40px 0',
      fontFamily: "'Inter', 'Roboto', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .pub-field-input:focus {
          border-color: rgba(255,255,255,0.7) !important;
          background: rgba(255,255,255,0.18) !important;
        }
        .pub-field-input::placeholder { color: rgba(255,255,255,0.5); }
        .start-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,0.25) !important; }
        .start-btn:active { transform: translateY(0); }
      `}</style>

      {/* Banner image overlay */}
      {assessment.backgroundTheme === 'banner' && assessment.bannerImage && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 0 }} />
      )}

      {/* Content card — mobile confined */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 430, width: '100%',
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Top hero section */}
        <div style={{
          padding: '48px 24px 32px',
          animation: 'fadeSlideUp 0.5s ease',
        }}>
          {/* Assessment badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 30,
            padding: '5px 14px', marginBottom: 20, fontSize: '0.75rem',
            fontWeight: 700, color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            Assessment
          </div>

          <h1 style={{
            fontSize: 'clamp(1.5rem, 6vw, 2rem)', fontWeight: 900,
            color: '#fff', lineHeight: 1.2, marginBottom: 14,
            textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}>
            {assessment.title}
          </h1>

          {assessment.description && (
            <p style={{
              fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.65, marginBottom: 0,
            }}>
              {assessment.description}
            </p>
          )}

          {/* Meta pills */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { icon: '⏱', text: `${Math.floor(assessment.duration / 60)} min` },
              { icon: '📝', text: `${assessment.totalQuestions} questions` },
            ].map(p => (
              <div key={p.text} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20,
                padding: '5px 13px', fontSize: '0.8rem', fontWeight: 600, color: '#fff',
              }}>
                {p.icon} {p.text}
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.10)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(255,255,255,0.18)',
          borderBottom: 'none',
          padding: '28px 24px 32px',
          animation: 'fadeSlideUp 0.5s 0.1s ease both',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 22 }}>
            Your Details
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {assessment.candidateFields.map((field) => (
              <div key={field.fieldName}>
                <label style={{
                  display: 'block', fontSize: '0.8rem', fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)', marginBottom: 7,
                  letterSpacing: '0.3px',
                }}>
                  {field.label}
                  {field.required && <span style={{ color: '#fca5a5', marginLeft: 3 }}>*</span>}
                </label>
                <input
                  className="pub-field-input"
                  type={field.fieldName === 'mobile' ? 'tel' : field.fieldName === 'email' ? 'email' : 'text'}
                  inputMode={field.fieldName === 'mobile' ? 'numeric' : 'text'}
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  value={formData[field.fieldName] || ''}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, [field.fieldName]: e.target.value }));
                    setFormErrors(prev => ({ ...prev, [field.fieldName]: '' }));
                  }}
                  style={{
                    ...inputStyle,
                    borderColor: formErrors[field.fieldName] ? '#fca5a5' : 'rgba(255,255,255,0.25)',
                  }}
                  maxLength={field.fieldName === 'mobile' ? 10 : 100}
                />
                {formErrors[field.fieldName] && (
                  <p style={{ color: '#fca5a5', fontSize: '0.78rem', marginTop: 5, fontWeight: 600 }}>
                    ⚠ {formErrors[field.fieldName]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Instructions note */}
          <div style={{
            marginTop: 24, padding: '12px 14px',
            background: 'rgba(255,255,255,0.08)', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)', fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
          }}>
            📋 This assessment has a <strong style={{ color: '#fff' }}>{Math.floor(assessment.duration / 60)}-minute</strong> timer.
            Once started, it will auto-submit when time runs out.
          </div>

          {/* Start Button */}
          <button
            className="start-btn"
            onClick={handleStart}
            disabled={submitting}
            style={{
              marginTop: 28, width: '100%', padding: '18px',
              background: '#fff', color: '#4f46e5',
              border: 'none', borderRadius: 14,
              fontSize: '1.05rem', fontWeight: 900, cursor: 'pointer',
              letterSpacing: '0.3px', transition: 'all 0.22s',
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            }}
          >
            {submitting ? 'Starting...' : '🚀 Start Assessment'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            By continuing, you agree to attempt the assessment honestly.
          </p>
        </div>
      </div>
    </div>
  );
}
