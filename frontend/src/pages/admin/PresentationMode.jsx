import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#10B981', '#F43F5E'];

// ── Transition variants ─────────────────────────────────────────────────────
const TRANSITIONS = {
  fade: {
    enter: { opacity: 0 },
    center: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.4 }
  },
  slideLeft: (dir) => ({
    enter: { x: dir > 0 ? '100%' : '-100%', opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: dir > 0 ? '-100%' : '100%', opacity: 0 },
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
  }),
  zoom: {
    enter: { scale: 0.85, opacity: 0 },
    center: { scale: 1, opacity: 1 },
    exit: { scale: 1.1, opacity: 0 },
    transition: { duration: 0.4 }
  }
};

const TRANSITION_NAMES = ['fade', 'slideLeft', 'zoom'];

export default function PresentationMode() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [presentation, setPresentation] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [showPoll, setShowPoll] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [socketRef, setSocketRef] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [pollActivating, setPollActivating] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [transitionType, setTransitionType] = useState('slideLeft');
  const [showTransitionPicker, setShowTransitionPicker] = useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const FRONTEND_ORIGIN = window.location.origin;

  const hideTimer = useRef(null);
  const containerRef = useRef(null);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/presentation/${id}`);
        if (data.success) setPresentation(data.presentation);
      } catch { toast.error('Failed to load presentation'); }
      finally { setLoading(false); }
    })();
    return () => { if (socketRef) socketRef.disconnect(); };
  }, [id]);

  // ── Poll auto-start ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!presentation) return;

    // Tear down previous socket
    if (socketRef) { socketRef.disconnect(); setSocketRef(null); }
    setChartData([]); setShowPoll(false); setActivePoll(null); setCurrentQuestionIndex(0); setPollActivating(false);

    const linked = presentation.slidePolls?.find(sp => sp.slideIndex === currentSlide);
    if (!linked?.pollId) return; // no poll on this slide

    // Auto-activate: call backend to start/reuse session
    const pollId = typeof linked.pollId === 'object' ? linked.pollId._id : linked.pollId;

    (async () => {
      setPollActivating(true);
      try {
        const { data } = await api.post(`/poll/activate/${pollId}`);
        if (!data.success) return;

        const poll = data.poll;
        setActivePoll(poll);
        setChartData(data.results);
        setShowPoll(true);

        // Connect socket to the live room
        const socket = io(API_BASE);
        socket.emit('join_poll', poll.code);
        socket.on('poll_update', d => setChartData(d));
        setSocketRef(socket);

        if (!data.reused) {
          toast.success(`Poll "${poll.title}" started!`, { icon: '📊', duration: 2500 });
        }
      } catch (err) {
        console.error('[auto-start poll]', err);
        toast.error('Could not start poll for this slide');
      } finally {
        setPollActivating(false);
      }
    })();
  }, [currentSlide, presentation]);

  // ── Auto-hide toolbar ───────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setToolbarVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 3500);
  }, []);

  useEffect(() => {
    resetHideTimer();
    window.addEventListener('mousemove', resetHideTimer);
    window.addEventListener('mousedown', resetHideTimer);
    window.addEventListener('keydown', resetHideTimer);
    return () => {
      clearTimeout(hideTimer.current);
      window.removeEventListener('mousemove', resetHideTimer);
      window.removeEventListener('mousedown', resetHideTimer);
      window.removeEventListener('keydown', resetHideTimer);
    };
  }, [resetHideTimer]);

  // ── Fullscreen listener ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!presentation) return;
    if (showPoll && activePoll && currentQuestionIndex < activePoll.questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1); return;
    }
    setSlideDir(1);
    setCurrentSlide(s => Math.min(s + 1, (presentation.slides?.length || 1) - 1));
    setShowPoll(false);
  }, [presentation, showPoll, activePoll, currentQuestionIndex]);

  const goPrev = useCallback(() => {
    if (!presentation) return;
    if (showPoll && activePoll && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1); return;
    }
    setSlideDir(-1);
    setCurrentSlide(s => Math.max(s - 1, 0));
    setShowPoll(false);
  }, [presentation, showPoll, activePoll, currentQuestionIndex]);

  const jumpTo = (idx) => {
    setSlideDir(idx > currentSlide ? 1 : -1);
    setCurrentSlide(idx);
    setShowPoll(false);
    setThumbnailsOpen(false);
  };

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate('/admin/presentations');
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [goNext, goPrev, navigate]);

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      (containerRef.current || document.documentElement).requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  if (loading || !presentation) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f0f0f', color: '#fff', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, border: '4px solid rgba(141,198,63,0.3)', borderTop: '4px solid #8DC63F', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: '#94a3b8', fontSize: '1rem' }}>{loading ? 'Loading presentation...' : 'Presentation not found'}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const totalSlides = presentation.slides?.length || 0;
  const pollUrl = activePoll ? `${FRONTEND_ORIGIN}/poll/${activePoll.code}` : '';
  const currentQuestion = activePoll?.questions?.[currentQuestionIndex];
  const currentQuestionData = chartData[currentQuestionIndex] || [];
  const totalResponses = currentQuestionData.reduce((a, c) => a + c.value, 0);
  const linkedPoll = presentation.slidePolls?.find(sp => sp.slideIndex === currentSlide);
  const hasLinkedPoll = !!linkedPoll?.pollId;

  // build transition props
  const getVariants = () => {
    if (transitionType === 'slideLeft') {
      const t = TRANSITIONS.slideLeft(slideDir);
      return { initial: t.enter, animate: t.center, exit: t.exit, transition: t.transition };
    }
    const t = TRANSITIONS[transitionType];
    return { initial: t.enter, animate: t.center, exit: t.exit, transition: t.transition };
  };

  const slideImageSrc = (path) =>
    path?.startsWith('http') ? path : `${API_BASE}${path}`;

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#0f0f0f', color: '#fff', overflow: 'hidden', fontFamily: "'Outfit', 'Inter', sans-serif", userSelect: 'none' }}>

      {/* ─── TOP TOOLBAR ─────────────────────────────────────────── */}
      <motion.div
        animate={{ y: toolbarVisible ? 0 : -80, opacity: toolbarVisible ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
          padding: '0 1.5rem', height: 64,
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}
      >
        {/* Title */}
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0', marginRight: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '30%' }}>
          {presentation.title}
        </span>

        {/* Slide counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 12px' }}>
          <button onClick={goPrev} disabled={currentSlide === 0} style={btnStyle(currentSlide === 0)}>‹</button>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 60, textAlign: 'center', color: '#f1f5f9' }}>
            {showPoll ? '📊 Poll' : `${currentSlide + 1} / ${totalSlides}`}
          </span>
          <button onClick={goNext} disabled={!showPoll && currentSlide === totalSlides - 1} style={btnStyle(!showPoll && currentSlide === totalSlides - 1)}>›</button>
        </div>

        {/* Poll activating indicator */}
        {pollActivating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(141,198,63,0.15)', border: '1px solid rgba(141,198,63,0.4)', borderRadius: 8, padding: '4px 12px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8DC63F', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8DC63F' }}>Starting poll…</span>
          </div>
        )}

        {/* Transitions */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTransitionPicker(p => !p)}
            style={toolBtn()}
            title="Change transition"
          >
            ✨
          </button>
          {showTransitionPicker && (
            <div style={{ position: 'absolute', top: '110%', right: 0, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', minWidth: 140, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
              {TRANSITION_NAMES.map(t => (
                <button key={t} onClick={() => { setTransitionType(t); setShowTransitionPicker(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: transitionType === t ? 'rgba(141,198,63,0.15)' : 'none', color: transitionType === t ? '#8DC63F' : '#e2e8f0', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
                  {t === 'slideLeft' ? '↔ Slide' : t === 'fade' ? '☁ Fade' : '🔍 Zoom'}
                  {transitionType === t && ' ✓'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnails toggle */}
        <button onClick={() => setThumbnailsOpen(p => !p)} style={toolBtn(thumbnailsOpen)} title="Slide panel">⊞</button>

        {/* Poll controls — auto-started, but allow manual toggle */}
        {hasLinkedPoll && !showPoll && !pollActivating && (
          <button onClick={() => setShowPoll(true)} style={{ ...toolBtn(), background: 'rgba(141,198,63,0.2)', color: '#8DC63F', border: '1px solid rgba(141,198,63,0.4)', fontWeight: 700, padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem' }}>
            📊 Show Poll
          </button>
        )}
        {showPoll && (
          <button onClick={() => setShowPoll(false)} style={{ ...toolBtn(), background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 700, padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem' }}>
            🖼 Show Slide
          </button>
        )}

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} style={toolBtn()} title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
          {isFullscreen ? '⊠' : '⛶'}
        </button>

        {/* End */}
        <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); navigate('/admin/presentations'); }} style={{ ...toolBtn(), color: '#f87171' }} title="End presentation (Esc)">
          ✕ End
        </button>
      </motion.div>

      {/* ─── THUMBNAIL PANEL ─────────────────────────────────────── */}
      <AnimatePresence>
        {thumbnailsOpen && (
          <motion.div
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'absolute', left: 0, top: 64, bottom: 0, width: 220, zIndex: 150,
              background: 'rgba(15,15,20,0.95)', borderRight: '1px solid rgba(255,255,255,0.07)',
              overflowY: 'auto', padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 8
            }}
          >
            {presentation.slides?.map((slide, i) => (
              <div key={i} onClick={() => jumpTo(i)} style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: i === currentSlide ? '2px solid #8DC63F' : '2px solid transparent', position: 'relative', flexShrink: 0 }}>
                <img src={slideImageSrc(slide)} alt={`Slide ${i + 1}`} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block', background: '#1e293b' }} />
                <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', background: 'rgba(0,0,0,0.6)', padding: '1px 5px', borderRadius: 4 }}>
                  {i + 1}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN CONTENT AREA ──────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, paddingLeft: thumbnailsOpen ? 220 : 0, transition: 'padding-left 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait" custom={slideDir}>
          {!showPoll ? (
            /* ── SLIDE VIEW ─────────────────────────────────────── */
            <motion.div
              key={`slide-${currentSlide}`}
              {...getVariants()}
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}
            >
              {presentation.pptxFile ? (
                <iframe
                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                    presentation.pptxFile.startsWith('http') ? presentation.pptxFile : API_BASE + presentation.pptxFile
                  )}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="PPTX Viewer"
                />
              ) : (
                <img
                  src={slideImageSrc(presentation.slides[currentSlide])}
                  alt={`Slide ${currentSlide + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  draggable={false}
                />
              )}
            </motion.div>
          ) : (
            /* ── POLL VIEW ──────────────────────────────────────── */
            <motion.div
              key={`poll-${activePoll?.code}-q${currentQuestionIndex}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              style={{ width: '100%', height: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', padding: '5rem 4rem 2rem 4rem', position: 'relative' }}
            >
              {/* Join bar */}
              <div style={{ position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.6rem 2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>Join at <strong style={{ color: '#1e293b' }}>{FRONTEND_ORIGIN.replace(/^https?:\/\//, '')}/poll</strong></span>
                <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
                <span style={{ color: '#64748b', fontWeight: 500 }}>Code: <strong style={{ color: '#8DC63F', fontSize: '1.1rem' }}>{activePoll.code}</strong></span>
              </div>

              {/* Question */}
              <div style={{ flex: 1, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '2.5rem 3rem 1rem', textAlign: 'center' }}>
                  {activePoll.questions.length > 1 && (
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.75rem' }}>
                      Question {currentQuestionIndex + 1} of {activePoll.questions.length}
                    </div>
                  )}
                  <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)', fontWeight: 800, color: '#1e293b', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                    {currentQuestion?.text}
                  </h1>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8DC63F', animation: 'pulse 2s infinite' }} />
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{totalResponses} response{totalResponses !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <div style={{ flex: 1, padding: '0 3rem 2rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={currentQuestionData} cx="50%" cy="50%" outerRadius="85%" innerRadius="55%" dataKey="value" nameKey="name" paddingAngle={4} animationDuration={1200} stroke="#fff" strokeWidth={4}>
                        {currentQuestionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }} />
                      <Legend verticalAlign="bottom" height={72} formatter={(v) => {
                        const item = currentQuestionData.find(d => d.name === v);
                        const pct = totalResponses > 0 ? ((item?.value / totalResponses) * 100).toFixed(0) : 0;
                        return <span style={{ color: '#475569', fontWeight: 700 }}>{v} ({pct}%)</span>;
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* QR */}
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }} style={{ position: 'absolute', bottom: '2.5rem', right: '2.5rem', background: '#fff', padding: '1rem', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <QRCodeSVG value={pollUrl} size={120} />
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: 1 }}>SCAN TO VOTE</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── BOTTOM NAV (click zones) ────────────────────────────── */}
      {!showPoll && (
        <>
          <div onClick={goPrev} style={{ position: 'absolute', left: thumbnailsOpen ? 220 : 0, top: 64, bottom: 0, width: '15%', cursor: currentSlide > 0 ? 'w-resize' : 'default', zIndex: 100 }} />
          <div onClick={goNext} style={{ position: 'absolute', right: 0, top: 64, bottom: 0, width: '15%', cursor: currentSlide < totalSlides - 1 ? 'e-resize' : 'default', zIndex: 100 }} />
        </>
      )}

      {/* ─── BOTTOM PROGRESS BAR ─────────────────────────────────── */}
      <motion.div animate={{ opacity: toolbarVisible ? 1 : 0 }} transition={{ duration: 0.25 }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 200 }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
          <motion.div
            animate={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
            transition={{ duration: 0.4 }}
            style={{ height: '100%', background: '#8DC63F', borderRadius: 2 }}
          />
        </div>
      </motion.div>

      {/* ─── STYLES ──────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function toolBtn(active = false) {
  return {
    background: active ? 'rgba(141,198,63,0.15)' : 'rgba(255,255,255,0.06)',
    border: active ? '1px solid rgba(141,198,63,0.4)' : '1px solid rgba(255,255,255,0.08)',
    color: active ? '#8DC63F' : '#e2e8f0',
    borderRadius: 8, padding: '6px 10px',
    cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
    transition: 'all 0.15s'
  };
}
function btnStyle(disabled) {
  return {
    background: 'none', border: 'none', color: disabled ? '#334155' : '#94a3b8',
    cursor: disabled ? 'default' : 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: '0 4px'
  };
}
