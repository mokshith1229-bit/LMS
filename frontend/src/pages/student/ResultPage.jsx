import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { motion } from 'framer-motion';
import AnimatedImage from './AnimatedImage';

/**
 * ResultPage Component
 * Professional LMS Assessment Completion Screen
 */
export default function ResultPage() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // Get result data from navigation state
  // New API returns: { submission: { status, _id, quizId, submittedAt }, submissionStatus }
  // Legacy API may return: { submission: { ...stats } }
  const result = state?.submission || {};
  const submissionStatus = state?.submissionStatus || result.status || (state?.forcedReason === 'violation' ? 'TERMINATED' : 'COMPLETED');
  const isTerminated = submissionStatus === 'TERMINATED' || state?.forcedReason === 'violation';

  // Content Configuration
  const config = {
    COMPONENT: {
      heading: "ASSESSMENT\nCOMPLETED",
      subtext: "You have successfully completed the training assessment. Your submission has been recorded.",
      accent: "#8DC63F",
      muted: false
    },
    TERMINATED: {
      heading: "ASSESSMENT\nTERMINATED",
      subtext: "This assessment was ended due to a violation of the exam guidelines. Your session has been closed.",
      accent: "#ef4444",
      muted: true
    }
  };

  const { heading, subtext, accent, muted } = isTerminated ? config.TERMINATED : config.COMPONENT;

  // Image path with handled space
  const illustrationSrc = `/assets/result_page%20.png`;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="app-layout" style={{ background: '#ffffff', minHeight: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main className="main-content" style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: 0 }}>

        {/* --- DECORATIVE BACKGROUND BLOBS --- */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '-10%', left: '-5%', width: '40%', height: '40%',
            background: `radial-gradient(circle, ${isTerminated ? 'rgba(239,68,68,0.05)' : 'rgba(141,198,63,0.05)'} 0%, transparent 70%)`, 
            filter: 'blur(40px)'
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '5%', width: '30%', height: '30%',
            background: 'radial-gradient(circle, rgba(226,232,240,0.4) 0%, transparent 70%)', filter: 'blur(30px)'
          }} />
        </div>

        {/* --- MAIN SPLIT LAYOUT --- */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            display: 'flex',
            width: '100%',
            minHeight: '100vh',
            padding: '0 64px', // px-16
            gap: '48px', // gap-12
            alignItems: 'center',
            zIndex: 1
          }}
        >
          {/* --- LEFT SECTION (55%) --- */}
          <div style={{ flex: '0 0 55%', maxWidth: '650px' }}>
            {/* Dynamic Accent Line */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 60 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              style={{ height: '4px', background: accent, marginBottom: '32px' }}
            />

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              style={{
                fontSize: '3.5rem', // text-5xl
                fontWeight: 900,
                color: '#1a2f23',
                lineHeight: 1.1,
                marginBottom: '24px',
                letterSpacing: '-1px',
                whiteSpace: 'pre-line'
              }}
            >
              {heading}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.8 }}
              style={{
                fontSize: '1.2rem',
                color: '#4b5563', // text-gray-600
                lineHeight: 1.6,
                marginBottom: '40px'
              }}
            >
              {subtext}
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.8 }}
              whileHover={{ scale: 1.03 }}
              whileActive={{ scale: 0.98 }}
              onClick={() => navigate('/student')}
              style={{
                background: isTerminated ? '#ef4444' : '#1a2f23',
                color: '#fff',
                padding: '16px 40px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                transition: 'background 0.3s ease'
              }}
            >
              Go to Dashboard
            </motion.button>
          </div>

          {/* --- RIGHT SECTION (45%) --- */}
          <div style={{ 
            flex: '0 0 45%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            filter: muted ? 'grayscale(0.4) opacity(0.8)' : 'none'
          }}>
            <div style={{ width: '100%', maxWidth: '550px' }}>
              <AnimatedImage src={illustrationSrc} gridSize={5} />
            </div>
          </div>

        </motion.div>
      </main>

      <style>{`
        /* Responsive Overrides */
        @media (max-width: 1024px) {
          .main-content > div {
            flex-direction: column;
            padding: 80px 24px;
            gap: 60px;
          }
          .main-content > div > div {
            flex: 1 1 100% !important;
            max-width: 100% !important;
            text-align: center;
          }
          .main-content > div > div div {
            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>
    </div>
  );
}
