import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { motion } from 'framer-motion';

/**
 * ResultPage Component
 * Premium centered assessment completion feedback with dynamic performance tiers
 */
export default function ResultPage() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // Get result data from navigation state
  const result = state?.submission || {};
  const submissionStatus = state?.submissionStatus || result.status || (state?.forcedReason === 'violation' ? 'TERMINATED' : 'COMPLETED');
  const isTerminated = submissionStatus === 'TERMINATED' || state?.forcedReason === 'violation';
  
  const percentage = result.percentage !== undefined ? result.percentage : null;

  // Evaluate performance internally to show only dynamic title + motivational message
  let heading = "Assessment Submitted";
  let subtext = "Your responses have been recorded and evaluated.";
  let themeColor = "#0f172a"; // slate-900 default
  let accentBg = "#f1f5f9";   // slate accent default
  let iconStroke = "#475569"; // slate-600 default

  if (isTerminated) {
    heading = "Assessment Terminated";
    subtext = "This assessment was ended due to a violation of the exam guidelines. Your session has been closed.";
    themeColor = "#dc2626"; // red-600
    accentBg = "#fff5f5";
    iconStroke = "#dc2626";
  } else if (percentage !== null) {
    const pct = Number(percentage);
    themeColor = "#16a34a"; // green-600
    accentBg = "#f0fdf4";
    iconStroke = "#16a34a";

    if (pct >= 90) {
      heading = "Exceptional Performance";
      subtext = "You demonstrated outstanding subject understanding and assessment performance.";
    } else if (pct >= 80) {
      heading = "Exceptional Performance";
      subtext = "You demonstrated outstanding subject understanding and assessment performance";
    } else if (pct >= 70) {
      heading = "Excellent Performance";
      subtext = "You achieved a strong assessment result with consistent performance.";
    } else if (pct >= 60) {
      heading = "Great Effort";
      subtext = "You completed the assessment successfully with a fair performance level.";
    } else if (pct >= 50) {
      heading = "Assessment Completed";
      subtext = "Your assessment has been evaluated successfully.";
    } else {
      // Below 50%
      heading = "Assessment Submitted";
      subtext = "Your responses have been recorded and evaluated.";
      themeColor = "#0f172a"; // neutral for regular submission
      accentBg = "#f8fafc";
      iconStroke = "#475569";
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="app-layout" style={{ background: '#f8fafc', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main className="main-content" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>

        {/* --- DECORATIVE BACKGROUND GRADIENTS --- */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '-10%', left: '-5%', width: '45%', height: '45%',
            background: `radial-gradient(circle, ${isTerminated ? 'rgba(239,68,68,0.03)' : 'rgba(22,163,74,0.02)'} 0%, transparent 70%)`, 
            filter: 'blur(50px)'
          }} />
          <div style={{
            position: 'absolute', bottom: '5%', right: '0%', width: '35%', height: '35%',
            background: 'radial-gradient(circle, rgba(226,232,240,0.3) 0%, transparent 70%)', filter: 'blur(40px)'
          }} />
        </div>

        {/* --- CENTERED CARD CONTAINER --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '56px 48px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.01)',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
            zIndex: 1,
            position: 'relative'
          }}
        >
          {/* Top border accent line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: themeColor,
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px'
          }} />

          {/* Clean Graphic Circle Check/X */}
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 32px',
            border: `1.5px solid ${isTerminated ? '#fecaca' : '#bbf7d0'}`,
            boxShadow: `0 6px 16px ${isTerminated ? 'rgba(239, 68, 68, 0.02)' : 'rgba(22, 163, 74, 0.02)'}`
          }}>
            {isTerminated ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </div>

          {/* Dynamic Performance Title */}
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#0f172a', // slate-900
            lineHeight: 1.25,
            marginBottom: '16px',
            letterSpacing: '-0.02em',
            whiteSpace: 'pre-line'
          }}>
            {heading}
          </h1>

          {/* Dynamic Performance Message */}
          <p style={{
            fontSize: '1.05rem',
            color: '#475569', // slate-600
            lineHeight: 1.6,
            marginBottom: '40px',
            fontWeight: 450,
            padding: '0 8px'
          }}>
            {subtext}
          </p>

          <div style={{
            height: '1px',
            background: '#f1f5f9',
            width: '100%',
            marginBottom: '36px'
          }} />

          {/* Navigation Control */}
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileActive={{ scale: 0.985 }}
            onClick={() => navigate('/student')}
            style={{
              background: '#0f172a', // Deep slate primary
              color: '#ffffff',
              width: '100%',
              padding: '14px 28px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.1)',
              transition: 'background 0.25s ease, transform 0.15s ease',
              letterSpacing: '0.01em'
            }}
          >
            Return to Dashboard
          </motion.button>
        </motion.div>
      </main>
    </div>
  );
}
