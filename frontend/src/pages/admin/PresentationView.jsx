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
  const [summaryPage, setSummaryPage] = useState(0);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const FRONTEND_ORIGIN = window.location.origin;

  const hideTimer = useRef(null);
  const autoStartTimer = useRef(null);
  const containerRef = useRef(null);
  const focusIntervalRef = useRef(null);

  // ── Auto-focus on mount (extended display / remote support) ─────────────────
  useEffect(() => {
    // Immediately claim window focus so the presentation window receives
    // keyboard events from a Logitech remote even in extended display mode.
    window.focus();
    containerRef.current?.focus();

    // Failsafe: re-claim focus every 3 seconds in case an overlay or
    // the iframe steals it while the presenter interacts on another monitor.
    focusIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && document.activeElement !== containerRef.current) {
        containerRef.current?.focus({ preventScroll: true });
      }
    }, 3000);

    return () => {
      clearInterval(focusIntervalRef.current);
    };
  }, []);

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
              setSummaryPage(0);
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
  const handleToolbarHover = useCallback(() => {
    setToolbarVisible(true);
    clearTimeout(hideTimer.current);
  }, []);

  const handleToolbarLeave = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 1200);
  }, []);

  useEffect(() => {
    // Initial show: hide after 3.5s
    setToolbarVisible(true);
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 3500);
    return () => clearTimeout(hideTimer.current);
  }, []);

  // ── Fullscreen listener + focus restore ────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Restore focus to presentation container after fullscreen transition
      // so the remote continues working immediately after going fullscreen.
      setTimeout(() => {
        window.focus();
        containerRef.current?.focus({ preventScroll: true });
      }, 150);
    };
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
    if (mode === 'summary' && activePoll) {
      const maxPages = Math.ceil((activePoll.questions.length || 0) / 5);
      if (summaryPage < maxPages - 1) {
        setSummaryPage(p => p + 1);
        return;
      }
    }
    setSlideDir(1);
    setCurrentSlide(s => Math.min(s + 1, (presentation.slides?.length || 1) - 1));
    setMode('slide');
  }, [presentation, mode, activePoll, currentQuestionIndex, summaryPage, endPollAndShowSummary]);

  const goPrev = useCallback(() => {
    if (!presentation) return;
    if (mode === 'summary') {
      if (summaryPage > 0) {
        setSummaryPage(p => p - 1);
        return;
      }
      setMode('poll');
      return;
    }
    if (mode === 'poll' && activePoll && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1); return;
    }
    setSlideDir(-1);
    setCurrentSlide(s => Math.max(s - 1, 0));
    setMode('slide');
  }, [presentation, mode, activePoll, currentQuestionIndex, summaryPage]);

  const jumpTo = (idx) => {
    setSlideDir(idx > currentSlide ? 1 : -1);
    setCurrentSlide(idx);
    setMode('slide');
    setThumbnailsOpen(false);
  };

  // ── Keyboard (window-level listener for remote / extended display) ──────────
  useEffect(() => {
    const handleSlideKeys = (e) => {
      // Navigation keys used by Logitech and other presentation remotes
      const NAV_NEXT = ['ArrowRight', 'ArrowDown', 'PageDown', ' '];
      const NAV_PREV = ['ArrowLeft', 'ArrowUp', 'PageUp'];

      if (NAV_NEXT.includes(e.key)) {
        // Prevent default scroll so Space/PageDown don't scroll the page
        e.preventDefault();
        goNext();
      } else if (NAV_PREV.includes(e.key)) {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate('/admin/presentations');
      }
    };
    window.addEventListener('keydown', handleSlideKeys);
    return () => window.removeEventListener('keydown', handleSlideKeys);
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
    <div
      ref={containerRef}
      tabIndex={0}
      onBlur={() => {
        // Re-claim focus when the container loses it (e.g. iframe click)
        setTimeout(() => containerRef.current?.focus({ preventScroll: true }), 100);
      }}
      style={{ position: 'fixed', inset: 0, background: '#f8fafc', color: '#1e293b', overflow: 'hidden', fontFamily: "'Outfit', 'Inter', sans-serif", userSelect: 'none', outline: 'none' }}
    >

      {/* Top Hover Trigger Zone (invisible area at the top to slide down the header when hovered) */}
      <div
        onMouseEnter={handleToolbarHover}
        onMouseMove={handleToolbarHover}
        onMouseLeave={handleToolbarLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '40px',
          zIndex: 199,
          background: 'transparent'
        }}
      />

      {/* ─── TOP TOOLBAR ─────────────────────────────────────────── */}
      <motion.div
        animate={{ y: toolbarVisible ? 0 : -80, opacity: toolbarVisible ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        onMouseEnter={handleToolbarHover}
        onMouseMove={handleToolbarHover}
        onMouseLeave={handleToolbarLeave}
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
                // Wrapper with a transparent overlay so the iframe never
                // captures keyboard events from the presentation remote.
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                      presentation.pptxFile.startsWith('http') ? presentation.pptxFile : API_BASE + presentation.pptxFile
                    )}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="PPTX Viewer"
                  />
                  {/* Transparent overlay — blocks iframe from stealing pointer/keyboard focus */}
                  <div
                    style={{
                      position: 'absolute', inset: 0, zIndex: 10,
                      cursor: 'default', background: 'transparent'
                    }}
                    onClick={() => containerRef.current?.focus({ preventScroll: true })}
                  />
                </div>
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
                    </div>
                  ) : activePoll?.isExpired ? (
                    <div style={{ position: 'absolute', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '0.6rem 2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>Expired Poll - Final Results</span>
                    </div>
                  ) : null}

                  {/* Question card */}
                  <div style={{ flex: 1, background: '#fff', borderRadius: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '3rem 4rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: isTimerMode ? 'none' : '1px solid #f1f5f9' }}>
                      {activePoll.questions.length > 1 && (
                        <div style={{ display: 'inline-block', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '2rem', padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: '1.5rem' }}>
                          Question {currentQuestionIndex + 1} of {activePoll.questions.length}
                        </div>
                      )}
                      <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3.2rem)', fontWeight: 800, color: '#0f172a', lineHeight: 1.3, textAlign: 'center', maxWidth: '900px' }}>
                        {currentQuestion?.text}
                      </h1>
                    </div>

                    {/* ── TIMER ACTIVE: clean corporate waiting UI ── */}
                    {isTimerMode ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
                          {/* Responses Stat */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#0ea5e9', lineHeight: 1 }}>{liveResponseCount}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: '0.5rem' }}>Responses</div>
                          </div>

                          <div style={{ width: '1px', height: '60px', background: '#e2e8f0' }} />

                          {/* Time Stat */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '3.5rem', fontWeight: 800, color: '#334155', lineHeight: 1, fontFamily: 'monospace', letterSpacing: '-2px' }}>{formatCountdown(timeLeft)}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: '0.5rem' }}>Time Remaining</div>
                          </div>
                        </div>

                        {/* Animated Progress Bar */}
                        <div style={{ width: '100%', maxWidth: '400px', height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden', marginTop: '3rem' }}>
                           <motion.div 
                             initial={{ width: '100%' }}
                             animate={{ width: `${(timeLeft / ((activePoll?.revealDelayMinutes || 1) * 60)) * 100}%` }}
                             transition={{ ease: 'linear', duration: 1 }}
                             style={{ height: '100%', background: '#0ea5e9', borderRadius: '2px' }}
                           />
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500, marginTop: '1rem' }}>Results will reveal automatically</div>

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
              <motion.div
                key={`summary-${activePoll?.code}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                style={{ width: '100%', height: '100%', background: '#f1f5f9', display: 'flex', flexDirection: 'column', padding: '1.5rem 2rem', alignItems: 'center', overflow: 'hidden' }}
              >
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.25rem', flexShrink: 0 }}>
                  <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0, color: '#1e293b' }}>Poll Summary</h1>
                  <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0.3rem 0 0' }}>Here's how your audience responded</p>
                </div>

                {/* Fixed container for 5 cards per page with consistent scale */}
                <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <div style={{ width: '100%', display: 'flex', gap: '1.25rem', justifyContent: 'center', alignItems: 'stretch' }}>
                    {(() => {
                      const visibleQuestions = activePoll?.questions.slice(summaryPage * 5, (summaryPage + 1) * 5) || [];
                      const visibleCount = visibleQuestions.length;
                      return visibleQuestions.map((q, localIndex) => {
                        const qi = summaryPage * 5 + localIndex;
                        const data = chartData[qi] || [];
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
                          <div
                            key={qi}
                            style={{
                              background: '#fff',
                              borderRadius: '1rem',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                              display: 'flex',
                              flexDirection: 'column',
                              flex: '1 1 0',
                              minWidth: 0,
                              maxWidth: visibleCount === 1 ? '450px' : `calc(${100 / visibleCount}% - 1.25rem)`,
                              height: '420px',
                              overflow: 'hidden',
                            }}
                          >
                          {/* Question text */}
                          <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid #f1f5f9', height: '80px', display: 'flex', alignItems: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.text}</p>
                          </div>

                          {/* Stats row */}
                          <div style={{ display: 'flex', gap: '0.4rem', padding: '0.75rem 1rem', height: '70px', flexShrink: 0 }}>
                            {/* Total Responses */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.2, marginBottom: '0.2rem' }}>Total{'\n'}Responses</span>
                              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>{total}</span>
                              <Users size={12} color="#cbd5e1" style={{ marginTop: '0.15rem' }} />
                            </div>
                            {/* Majority Vote */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.2, marginBottom: '0.2rem' }}>Majority{'\n'}Vote</span>
                              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8DC63F' }}>{majorityPct}%</span>
                              <PieChartIcon size={12} color="#cbd5e1" style={{ marginTop: '0.15rem' }} />
                            </div>
                            {/* Correct % if available */}
                            {q.correctAnswer && (
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.2, marginBottom: '0.2rem' }}>Correct{'\n'}%</span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: correctPct >= 70 ? '#8DC63F' : correctPct >= 40 ? '#F59E0B' : '#EF4444' }}>{correctPct}%</span>
                                <Target size={12} color="#cbd5e1" style={{ marginTop: '0.15rem' }} />
                              </div>
                            )}
                          </div>

                          {/* Answer Comparison */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0 1rem 0.75rem', height: '65px', justifyContent: 'center' }}>
                            {q.correctAnswer ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(141,198,63,0.08)', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(141,198,63,0.2)', overflow: 'hidden' }}>
                                  <CheckCircle size={12} color="#8DC63F" style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.65rem', color: '#334155', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Correct:</span>
                                  <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: q.correctAnswer.length > 12 ? 'ticker 8s linear infinite' : 'none' }}>
                                      <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700, paddingRight: '2rem' }}>{q.correctAnswer}</span>
                                      {q.correctAnswer.length > 12 && <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700, paddingRight: '2rem' }}>{q.correctAnswer}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: majorityOption === q.correctAnswer ? 'rgba(141,198,63,0.08)' : 'rgba(239,68,68,0.08)', padding: '0.3rem 0.6rem', borderRadius: '0.4rem', border: `1px solid ${majorityOption === q.correctAnswer ? 'rgba(141,198,63,0.2)' : 'rgba(239,68,68,0.2)'}`, overflow: 'hidden' }}>
                                  <Trophy size={12} color={majorityOption === q.correctAnswer ? '#8DC63F' : '#EF4444'} style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: '0.65rem', color: '#334155', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Most Voted:</span>
                                  <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: majorityOption.length > 12 ? 'ticker 8s linear infinite' : 'none' }}>
                                      <span style={{ fontSize: '0.7rem', color: majorityOption === q.correctAnswer ? '#15803d' : '#b91c1c', fontWeight: 700, paddingRight: '2rem' }}>{majorityOption}</span>
                                      {majorityOption.length > 12 && <span style={{ fontSize: '0.7rem', color: majorityOption === q.correctAnswer ? '#15803d' : '#b91c1c', fontWeight: 700, paddingRight: '2rem' }}>{majorityOption}</span>}
                                    </div>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(56,189,248,0.08)', padding: '0.4rem 0.6rem', borderRadius: '0.6rem', border: '1px solid rgba(56,189,248,0.2)', overflow: 'hidden' }}>
                                <Trophy size={12} color="#38BDF8" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.7rem', color: '#334155', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Most Voted:</span>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <div style={{ display: 'inline-block', whiteSpace: 'nowrap', animation: majorityOption.length > 12 ? 'ticker 8s linear infinite' : 'none' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, paddingRight: '2rem' }}>{majorityOption}</span>
                                    {majorityOption.length > 12 && <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, paddingRight: '2rem' }}>{majorityOption}</span>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Donut chart + legend */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem 1rem', minHeight: '120px' }}>
                            <div style={{ width: '90px', height: '90px', flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={data.length > 0 ? data : [{ name: 'No data', value: 1 }]} cx="50%" cy="50%" outerRadius="90%" innerRadius="55%" dataKey="value" stroke="none">
                                    {(data.length > 0 ? data : [{ name: 'No data', value: 1 }]).map((_, i) => (
                                      <Cell key={i} fill={data.length > 0 ? COLORS[i % COLORS.length] : '#e2e8f0'} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '11px' }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem', overflow: 'hidden' }}>
                              {data.slice(0, 4).map((opt, i) => {
                                const pct = total > 0 ? Math.round((opt.value / total) * 100) : 0;
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                                    <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e293b', flexShrink: 0, minWidth: '2rem' }}>{pct}%</span>
                                    <span style={{ fontSize: '0.68rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={opt.name}>{opt.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                  </div>
                </div>
              </motion.div>

            </>
          )}
        </AnimatePresence>
      </div>

      {/* ─── BOTTOM NAV (click zones) ────────────────────────────── */}
      {(mode === 'slide' || mode === 'summary') && (
        <>
          <div onClick={goPrev} style={{ position: 'absolute', left: thumbnailsOpen ? 220 : 0, top: 64, bottom: 0, width: '15%', cursor: mode === 'summary' || currentSlide > 0 ? 'w-resize' : 'default', zIndex: 100 }} />
          <div onClick={goNext} style={{ position: 'absolute', right: 0, top: 64, bottom: 0, width: '15%', cursor: (mode === 'summary' && summaryPage < Math.ceil((activePoll?.questions?.length || 0) / 5) - 1) || currentSlide < totalSlides - 1 ? 'e-resize' : 'default', zIndex: 100 }} />
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
