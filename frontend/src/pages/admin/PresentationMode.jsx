import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, FlaskConical, Droplet, Users, PieChart as PieChartIcon, Trophy, Sparkles, TrendingUp, Clock, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
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
  const [mode, setMode] = useState('slide'); // 'slide' | 'poll'
  const [activePoll, setActivePoll] = useState(null);
  const [socketRef, setSocketRef] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [pollActivating, setPollActivating] = useState(false);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [transitionType, setTransitionType] = useState('slideLeft');
  const [showTransitionPicker, setShowTransitionPicker] = useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  // Presentation timer-reveal state
  const [pollTimerActive, setPollTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [pollRevealed, setPollRevealed] = useState(false);
  const [presentationResponseCount, setPresentationResponseCount] = useState(0);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const FRONTEND_ORIGIN = window.location.origin;

  const hideTimer = useRef(null);
  const autoStartTimer = useRef(null);
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

    // Clear any pending auto-starts
    clearTimeout(autoStartTimer.current);

    // Tear down previous socket
    if (socketRef) { socketRef.disconnect(); setSocketRef(null); }
    setChartData([]); setMode('slide'); setActivePoll(null); setCurrentQuestionIndex(0); setPollActivating(false);
    setPollTimerActive(false); setTimeLeft(0); setPollRevealed(false); setPresentationResponseCount(0);

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
        setActivePoll({ ...poll, isExpired: data.isExpired });
        setChartData(data.results || []);
        
        // Initialize presentationResponseCount from existing data.results if available
        if (data.results && data.results[currentQuestionIndex]) {
          const count = data.results[currentQuestionIndex].reduce((a, c) => a + c.value, 0);
          setPresentationResponseCount(count);
        }

        // Delayed start: Show slide for 2s first
        autoStartTimer.current = setTimeout(async () => {
          setMode('poll');
          if (!data.isExpired) {
            // Connect socket when entering poll view
            const socket = io(API_BASE);
            socket.emit('join_poll', `poll_admin_${poll.code}`);

            // Live mode: full chart update
            socket.on('poll_update', d => setChartData(d));

            // Delayed mode: only response count during timer
            socket.on('poll_response_count', ({ count }) => setPresentationResponseCount(count));

            // Presentation reveal: auto-switch to summary
            socket.on('poll_revealed', ({ results }) => {
              if (results) {
                setChartData(results);
                // Also update presentationResponseCount for the UI if still in timer mode transition
                if (results[currentQuestionIndex]) {
                  const count = results[currentQuestionIndex].reduce((a, c) => a + c.value, 0);
                  setPresentationResponseCount(count);
                }
              }
              setPollRevealed(true);
              setPollTimerActive(false);
              setTimeLeft(0);
              // Auto-switch to summary after a brief pause
              setTimeout(() => setMode('summary'), 800);
            });

            setSocketRef(socket);

            // If delayed mode, auto-start the presentation timer
            if (poll.revealMode === 'delayed' && !data.isExpired) {
              if (poll.revealResults) {
                setPollRevealed(true);
                setTimeout(() => setMode('summary'), 800);
              } else if (poll.startedAt) {
                const elapsedSecs = (Date.now() - new Date(poll.startedAt).getTime()) / 1000;
                const totalDelaySecs = (poll.revealDelayMinutes || 1) * 60;
                const remaining = Math.max(0, Math.floor(totalDelaySecs - elapsedSecs));
                if (remaining > 0) {
                  setPollTimerActive(true);
                  setTimeLeft(remaining);
                } else {
                  setPollRevealed(true);
                }
              } else {
                try {
                  const timerRes = await api.post(`/poll/start-presentation-timer/${poll._id}`);
                  if (timerRes.data.success) {
                    const delaySecs = (poll.revealDelayMinutes || 1) * 60;
                    setPollTimerActive(true);
                    setTimeLeft(delaySecs);
                    setActivePoll(prev => ({ ...prev, startedAt: timerRes.data.startedAt }));
                  }
                } catch (timerErr) {
                  console.error('[presentation timer start]', timerErr);
                }
              }
            }
          }
        }, 2000);

        if (data.isExpired) {
          toast('Poll has expired. Showing final results.', { icon: '⚠️', duration: 3000 });
        } else if (!data.reused) {
          toast.success(`Poll "${poll.title}" ready! (Starting in 2s)`, { icon: '📊', duration: 2500 });
        }
      } catch (err) {
        console.error('[auto-start poll]', err);
        toast.error('Could not start poll for this slide');
      } finally {
        setPollActivating(false);
      }
    })();

    return () => clearTimeout(autoStartTimer.current);
  }, [currentSlide, presentation]);

  // ── Presentation countdown tick ──────────────────────────────────────────────
  useEffect(() => {
    if (!pollTimerActive) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Fallback: If timer hits 0 and socket event hasn't fired or was missed
          if (pollTimerActive) {
             setPollTimerActive(false);
             setPollRevealed(true);
             // Ensure results are fetched before switching
             (async () => {
                try {
                  const pId = typeof activePoll?._id === 'object' ? activePoll._id._id : activePoll?._id;
                  if (pId) {
                    const { data } = await api.get(`/poll/${pId}/results`);
                    if (data.success) setChartData(data.results);
                  }
                } catch (e) { console.error('Fallback results fetch failed', e); }
                setTimeout(() => setMode('summary'), 800);
             })();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pollTimerActive]);

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
  const endPollAndShowSummary = useCallback(async () => {
    if (!activePoll) return;
    try {
      // Fetch final results from backend to ensure accuracy
      const pollId = typeof activePoll._id === 'object' ? activePoll._id : activePoll._id;
      const { data } = await api.get(`/poll/${pollId}/results`);
      if (data.success) {
        setChartData(data.results);
      }
    } catch (err) {
      console.error('Failed to fetch final results', err);
    }
    setMode('summary');
  }, [activePoll]);

  const goNext = useCallback(() => {
    if (!presentation) return;
    if (mode === 'poll' && activePoll) {
      if (currentQuestionIndex < activePoll.questions.length - 1) {
        setCurrentQuestionIndex(i => i + 1); 
        return;
      } else {
        endPollAndShowSummary();
        return;
      }
    }
    setSlideDir(1);
    setCurrentSlide(s => Math.min(s + 1, (presentation.slides?.length || 1) - 1));
    setMode('slide');
  }, [presentation, mode, activePoll, currentQuestionIndex, endPollAndShowSummary]);

  const goPrev = useCallback(() => {
    if (!presentation) return;
    if (mode === 'summary') {
      setMode('poll');
      return;
    }
    if (mode === 'poll' && activePoll && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1); return;
    }
    setSlideDir(-1);
    setCurrentSlide(s => Math.max(s - 1, 0));
    setMode('slide');
  }, [presentation, mode, activePoll, currentQuestionIndex]);

  const jumpTo = (idx) => {
    setSlideDir(idx > currentSlide ? 1 : -1);
    setCurrentSlide(idx);
    setMode('slide');
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
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#ffffff', color: '#1e293b', flexDirection: 'column', gap: '1rem' }}>
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
    // Check if current slide has a preset transition
    const preset = presentation.slideTransitions?.find(st => st.slideIndex === currentSlide);
    const type = preset ? preset.type : 'none';
    const duration = preset ? preset.duration : 0.4;

    if (type === 'none') {
      return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } };
    }

    if (type === 'slideLeft') {
      const t = TRANSITIONS.slideLeft(slideDir);
      return { initial: t.enter, animate: t.center, exit: t.exit, transition: { ...t.transition, duration } };
    }
    
    if (type === 'slideRight') {
      const t = TRANSITIONS.slideLeft(-slideDir); // Inverse of slideLeft
      return { initial: t.enter, animate: t.center, exit: t.exit, transition: { ...t.transition, duration } };
    }

    const t = TRANSITIONS[type] || TRANSITIONS.fade;
    return { initial: t.enter, animate: t.center, exit: t.exit, transition: { ...t.transition, duration } };
  };

  const slideImageSrc = (path) =>
    path?.startsWith('http') ? path : `${API_BASE}${path}`;

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#f8fafc', color: '#1e293b', overflow: 'hidden', fontFamily: "'Outfit', 'Inter', sans-serif", userSelect: 'none' }}>

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
          <span style={{ fontSize: '0.85rem', fontWeight: 700, minWidth: 60, textAlign: 'center', color: '#1e293b' }}>
            {mode === 'poll' ? '📊 Poll' : mode === 'summary' ? '📈 Summary' : `${currentSlide + 1} / ${totalSlides}`}
          </span>
          <button onClick={goNext} disabled={mode === 'slide' && currentSlide === totalSlides - 1} style={btnStyle(mode === 'slide' && currentSlide === totalSlides - 1)}>›</button>
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
                  {t === 'slideLeft' ? 'Slide' : t === 'fade' ? 'Fade' : 'Zoom'}
                  {transitionType === t && ' (Selected)'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnails toggle */}
        <button onClick={() => setThumbnailsOpen(p => !p)} style={toolBtn(thumbnailsOpen)} title="Slide panel">Slides</button>

        {/* Poll controls — auto-started, but allow manual toggle */}
        {hasLinkedPoll && mode === 'slide' && !pollActivating && (
          <button onClick={() => setMode('poll')} style={{ ...toolBtn(), background: 'rgba(141,198,63,0.2)', color: '#8DC63F', border: '1px solid rgba(141,198,63,0.4)', fontWeight: 700, padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem' }}>
            Show Poll
          </button>
        )}
        {mode === 'poll' && (
          <button onClick={endPollAndShowSummary} style={{ ...toolBtn(), background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 700, padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem' }}>
            End Poll & Summary
          </button>
        )}
        {mode === 'summary' && (
          <button onClick={() => setMode('slide')} style={{ ...toolBtn(), background: 'rgba(56, 189, 248, 0.2)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.4)', fontWeight: 700, padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem' }}>
            Back to Slide
          </button>
        )}

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} style={toolBtn()} title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
          {isFullscreen ? 'Exit Full' : 'Full Screen'}
        </button>

        {/* End */}
        <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); navigate('/admin/presentations'); }} style={{ ...toolBtn(), color: '#f87171' }} title="End presentation (Esc)">
          End
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
          {mode === 'slide' ? (
            /* ── SLIDE VIEW ─────────────────────────────────────── */
            <motion.div
              key={`slide-${currentSlide}`}
              {...getVariants()}
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
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
          ) : mode === 'poll' ? (
            /* ── POLL VIEW ──────────────────────────────────────── */
            (() => {
              const formatCountdown = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
              const isTimerMode = activePoll?.revealMode === 'delayed' && pollTimerActive && !pollRevealed;
              const liveResponseCount = isTimerMode ? presentationResponseCount : totalResponses;
              return (
                <motion.div
                  key={`poll-${activePoll?.code}-q${currentQuestionIndex}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.4 }}
                  style={{ width: '100%', height: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', padding: '5rem 4rem 2rem 4rem', position: 'relative' }}
                >
                  {/* Join bar */}
                  {activePoll && !activePoll.isExpired ? (
                    <div style={{ position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.6rem 2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                      <span style={{ color: '#64748b', fontWeight: 500 }}>Join at <strong style={{ color: '#1e293b' }}>{FRONTEND_ORIGIN.replace(/^https?:\/\//, '')}/poll</strong></span>
                      <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
                      <span style={{ color: '#64748b', fontWeight: 500 }}>Code: <strong style={{ color: '#8DC63F', fontSize: '1.1rem' }}>{activePoll.code}</strong></span>
                      {isTimerMode && (
                        <>
                          <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontWeight: 700 }}>
                            <Clock size={14} /> Reveals in {formatCountdown(timeLeft)}
                          </span>
                        </>
                      )}
                    </div>
                  ) : activePoll?.isExpired ? (
                    <div style={{ position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '0.6rem 2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>Expired Poll - Final Results</span>
                    </div>
                  ) : null}

                  {/* Question card */}
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
                        <span style={{ color: '#64748b', fontWeight: 600 }}>{liveResponseCount} response{liveResponseCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* ── TIMER ACTIVE: hide charts, show big countdown ── */}
                    {isTimerMode ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', padding: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          <Clock size={56} color="#f59e0b" strokeWidth={1.5} />
                          <div style={{ fontSize: 'clamp(3rem, 10vw, 7rem)', fontWeight: 900, color: '#1e293b', fontFamily: 'monospace', letterSpacing: '-0.05em', lineHeight: 1 }}>
                            {formatCountdown(timeLeft)}
                          </div>
                          <div style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600 }}>Results will be revealed automatically</div>
                        </div>
                        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                          <div style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 16, padding: '1.25rem 2rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#38BDF8' }}>{liveResponseCount}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Responses</div>
                          </div>
                          <div style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 16, padding: '1.25rem 2rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b' }}>{formatCountdown(timeLeft)}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Time Left</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ── LIVE / REVEALED: show pie chart ── */
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
                    )}
                  </div>

                  {/* QR Code Overlay (Fullscreen when expanded) */}
                  {activePoll && !activePoll.isExpired && (
                    <AnimatePresence>
                      {qrExpanded && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setQrExpanded(false)}
                          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
                        >
                          <motion.div
                            initial={{ scale: 0.5 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.5 }}
                            style={{ background: '#fff', padding: '3rem', borderRadius: '32px', textAlign: 'center' }}
                          >
                            <QRCodeSVG value={pollUrl} size={400} />
                            <div style={{ marginTop: '2rem', color: '#1e293b', fontWeight: 800, fontSize: '2rem' }}>SCAN TO VOTE</div>
                            <div style={{ color: '#64748b', fontSize: '1.2rem', marginTop: '0.5rem' }}>Join code: <strong style={{ color: '#8DC63F' }}>{activePoll.code}</strong></div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {/* Small QR (Bottom Right) — only when not in timer mode */}
                  {activePoll && !activePoll.isExpired && !isTimerMode && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      onClick={() => setQrExpanded(true)}
                      style={{ position: 'absolute', bottom: '2.5rem', right: '2.5rem', background: '#fff', padding: '1rem', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'zoom-in', zIndex: 100 }}
                    >
                      <QRCodeSVG value={pollUrl} size={120} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: 1 }}>CLICK TO EXPAND</span>
                    </motion.div>
                  )}

                  {/* Large QR bottom-right during timer so students can still join */}
                  {activePoll && !activePoll.isExpired && isTimerMode && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      onClick={() => setQrExpanded(true)}
                      style={{ position: 'absolute', bottom: '2.5rem', right: '2.5rem', background: '#fff', padding: '1.25rem', borderRadius: 16, border: '2px solid #f59e0b', boxShadow: '0 10px 30px rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'zoom-in', zIndex: 100 }}
                    >
                      <QRCodeSVG value={pollUrl} size={140} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', letterSpacing: 1 }}>SCAN TO VOTE</span>
                    </motion.div>
                  )}
                </motion.div>
              );
            })()

          ) : (
            /* ── SUMMARY VIEW ────────────────────────────────────── */
            <>
              <style>
                {`
                  @keyframes ticker {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                `}
              </style>
              <motion.div
              key={`summary-${activePoll?.code}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.4 }}
              style={{ width: '100%', height: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', padding: '1.5rem', alignItems: 'center', overflow: 'hidden' }}
            >
              <div style={{ textAlign: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
                {pollRevealed ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(141,198,63,0.1)', border: '1px solid rgba(141,198,63,0.3)', borderRadius: 30, padding: '6px 20px', marginBottom: '0.75rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8DC63F' }} />
                    <span style={{ color: '#65a30d', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Auto-Revealed</span>
                  </div>
                ) : null}
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.4rem', color: '#1e293b' }}>Poll Summary</h1>
                <p style={{ fontSize: '1rem', color: '#64748b' }}>Here's how your audience responded</p>
              </div>
              
              {/* Summary Metrics & Navigation */}
              <div style={{ width: '100%', maxWidth: '1200px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
                {/* Header with Nav */}
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#8DC63F', color: '#fff', width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem' }}>
                      {currentQuestionIndex + 1}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                        {activePoll?.questions[currentQuestionIndex]?.text}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Question {currentQuestionIndex + 1} of {activePoll?.questions.length}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                      style={{ ...toolBtn(false), opacity: currentQuestionIndex === 0 ? 0.4 : 1, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <ChevronLeft size={18} /> Prev
                    </button>
                    <button 
                      disabled={currentQuestionIndex === (activePoll?.questions.length || 1) - 1}
                      onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                      style={{ ...toolBtn(false), opacity: currentQuestionIndex === (activePoll?.questions.length || 1) - 1 ? 0.4 : 1, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      Next <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2.5rem' }}>
                  {(() => {
                    const q = activePoll?.questions[currentQuestionIndex];
                    if (!q) return null;
                    const data = chartData[currentQuestionIndex] || [];
                    const total = data.reduce((a, c) => a + c.value, 0);
                    let majorityOption = 'No votes yet';
                    let majorityPct = 0;
                    
                    if (total > 0) {
                      const sorted = [...data].sort((a, b) => b.value - a.value);
                      majorityOption = sorted[0].name;
                      majorityPct = Math.round((sorted[0].value / total) * 100);
                    }

                    const correctData = data.find(d => d.name === q.correctAnswer);
                    const correctPct = total > 0 && correctData ? Math.round((correctData.value / total) * 100) : 0;

                    return (
                      <>
                        {/* Stats Column */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div style={{ background: '#f8fafc', borderRadius: '1rem', padding: '1.5rem', border: '1px solid #eef2f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Participation</span>
                                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>{total}</span>
                              </div>
                              <Users size="2rem" color="#cbd5e1" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>Majority Agreement</span>
                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{majorityPct}%</span>
                              </div>
                              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${majorityPct}%`, height: '100%', background: '#38BDF8' }} />
                              </div>
                            </div>
                          </div>

                          {q.correctAnswer && (
                            <div style={{ background: correctPct >= 70 ? 'rgba(141,198,63,0.05)' : 'rgba(245,158,11,0.05)', borderRadius: '1rem', padding: '1.5rem', border: `1px solid ${correctPct >= 70 ? 'rgba(141,198,63,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: correctPct >= 70 ? '#65a30d' : '#d97706', textTransform: 'uppercase' }}>Accuracy Rate</span>
                                <Target size="1.5rem" color={correctPct >= 70 ? '#8DC63F' : '#F59E0B'} />
                              </div>
                              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: correctPct >= 70 ? '#8DC63F' : '#F59E0B' }}>{correctPct}%</span>
                              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#475569', fontWeight: 500 }}>
                                {correctPct >= 70 ? "Excellent! Most of the audience got it right." : "Some confusion detected on this topic."}
                              </p>
                            </div>
                          )}

                          <div style={{ background: '#1e293b', borderRadius: '1rem', padding: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <Trophy size="1.5rem" color="#F59E0B" />
                            <div>
                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Winning Choice</div>
                              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{majorityOption}</div>
                            </div>
                          </div>
                        </div>

                        {/* Chart Column */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ flex: 1, minHeight: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40, top: 20, bottom: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }} />
                                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={32}>
                                  {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === q.correctAnswer ? '#8DC63F' : COLORS[index % COLORS.length]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                            {data.map((opt, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem' }}>
                                <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{Math.round((opt.value/total)*100 || 0)}%</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.name}</div>
                                </div>
                                {opt.name === q.correctAnswer && <CheckCircle size="1rem" color="#8DC63F" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <button 
                onClick={() => {
                  setSlideDir(1);
                  setCurrentSlide(s => Math.min(s + 1, (presentation.slides?.length || 1) - 1));
                  setMode('slide');
                }}
                style={{ marginTop: '2rem', background: 'linear-gradient(135deg, #8DC63F 0%, #65a30d 100%)', color: '#fff', padding: '1rem 3rem', fontSize: '1rem', fontWeight: 700, borderRadius: '2.5rem', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(141, 198, 63, 0.4)', transition: 'transform 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Continue Presentation
              </button>
            </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ─── BOTTOM NAV (click zones) ────────────────────────────── */}
      {mode === 'slide' && (
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
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        :fullscreen { background: transparent !important; }
        :-webkit-full-screen { background: transparent !important; }
        :-ms-fullscreen { background: transparent !important; }
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
