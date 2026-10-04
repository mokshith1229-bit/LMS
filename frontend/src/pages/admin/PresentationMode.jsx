import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, FlaskConical, Droplet, Users, PieChart as PieChartIcon, Trophy, Sparkles, TrendingUp, Clock, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#D946EF', '#6366F1', '#14B8A6', '#F472B6'];

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
  const location = useLocation();
  const isController = location.pathname.includes('controller');

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
  const [scale, setScale] = useState(1);

  // Calculate CSS scale to fit 1920x1080 canvas inside viewport
  useEffect(() => {
    const updateScale = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setScale(Math.min(scaleX, scaleY));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const FRONTEND_ORIGIN = window.location.origin;

  const hideTimer = useRef(null);
  const autoStartTimer = useRef(null);
  const containerRef = useRef(null);
  const focusIntervalRef = useRef(null);
  const syncSocket = useRef(null);

  // ── Sync Socket Setup ────────────────────────────────────────────────────────
  useEffect(() => {
    syncSocket.current = io(API_BASE);
    syncSocket.current.emit('join_presentation', id);

    if (!isController) {
      syncSocket.current.on('slide_changed', (data) => {
        if (data && typeof data === 'object') {
          const { slideIndex, questionIndex, mode: newMode, summaryPage: newSummaryPage } = data;

          setCurrentSlide((prev) => {
            if (prev !== slideIndex) {
              setSlideDir(slideIndex > prev ? 1 : -1);
            }
            return slideIndex;
          });

          if (newMode !== undefined) setMode(newMode);
          if (questionIndex !== undefined) setCurrentQuestionIndex(questionIndex);
          if (newSummaryPage !== undefined) setSummaryPage(newSummaryPage);
        } else if (typeof data === 'number') {
          // Fallback support
          setCurrentSlide((prev) => {
            if (prev !== data) {
              setSlideDir(data > prev ? 1 : -1);
              setMode('slide');
            }
            return data;
          });
        }
      });
    }

    return () => {
      if (syncSocket.current) syncSocket.current.disconnect();
    };
  }, [id, isController, API_BASE]);

  // Emit state change from controller
  useEffect(() => {
    if (isController && syncSocket.current) {
      syncSocket.current.emit('slide_change', {
        presentationId: id,
        slideIndex: currentSlide,
        questionIndex: currentQuestionIndex,
        mode,
        summaryPage
      });
    }
  }, [currentSlide, currentQuestionIndex, mode, summaryPage, id, isController]);

  // ── Auto-focus on mount (extended display / remote support) ─────────────────
  useEffect(() => {
    if (!isController) return; // Only controller needs aggressive focus for remote

    // Immediately claim window focus so the presentation window receives
    // keyboard events from a Logitech remote even in extended display mode.
    window.focus();
    containerRef.current?.focus({ preventScroll: true });

    const forceFocus = () => {
      if (!document.hidden && document.fullscreenElement) {
        window.focus();
        containerRef.current?.focus({ preventScroll: true });
      }
    };

    window.addEventListener('blur', forceFocus);
    document.addEventListener('visibilitychange', forceFocus);

    // Failsafe: re-claim focus every 2.5 seconds only if in fullscreen
    focusIntervalRef.current = setInterval(() => {
      if (!document.hidden && document.fullscreenElement) {
        window.focus();
        if (document.activeElement !== containerRef.current) {
          containerRef.current?.focus({ preventScroll: true });
        }
      }
    }, 2500);

    return () => {
      clearInterval(focusIntervalRef.current);
      window.removeEventListener('blur', forceFocus);
      document.removeEventListener('visibilitychange', forceFocus);
    };
  }, [isController]);

  // ── Auto-Fullscreen for TV View ─────────────────────────────────────────────
  useEffect(() => {
    if (!isController) {
      const attemptFullscreen = () => {
        if (!document.fullscreenElement && (containerRef.current || document.documentElement).requestFullscreen) {
          (containerRef.current || document.documentElement).requestFullscreen().then(() => {
            window.focus();
            containerRef.current?.focus({ preventScroll: true });
          }).catch(err => console.log('Auto-fullscreen requires interaction fallback:', err));
        }
      };

      attemptFullscreen();
      const timer = setTimeout(attemptFullscreen, 500);
      return () => clearTimeout(timer);
    }
  }, [isController]);

  // ── Auto-hide Cursor for TV View ────────────────────────────────────────────
  useEffect(() => {
    if (isController) return;
    let timeout;
    const hideCursor = () => { document.body.style.cursor = 'none'; };
    const showCursor = () => {
      document.body.style.cursor = 'default';
      clearTimeout(timeout);
      timeout = setTimeout(hideCursor, 3000);
    };

    window.addEventListener('mousemove', showCursor);
    showCursor(); // initial setup

    return () => {
      window.removeEventListener('mousemove', showCursor);
      document.body.style.cursor = 'default';
      clearTimeout(timeout);
    };
  }, [isController]);

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
    setChartData([]); setMode('slide'); setActivePoll(null); setCurrentQuestionIndex(-1); setPollActivating(false);
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

        // Initialize presentationResponseCount from existing responses or data.results
        if (poll.responses) {
          setPresentationResponseCount(poll.responses.length);
        } else if (data.results && data.results[0]) {
          const count = data.results[0].reduce((a, c) => a + c.value, 0);
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
    if (!isController) return;
    setToolbarVisible(true);
    clearTimeout(hideTimer.current);
  }, [isController]);

  const handleToolbarLeave = useCallback(() => {
    if (!isController) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 1200);
  }, [isController]);

  useEffect(() => {
    if (!isController) return;
    // Initial show: hide after 3.5s
    setToolbarVisible(true);
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 3500);
    return () => clearTimeout(hideTimer.current);
  }, [isController]);

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
    if (mode === 'poll' && activePoll && currentQuestionIndex > -1) {
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
    if (!isController) return; // TV view doesn't listen to keyboard

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
  }, [goNext, goPrev, navigate, isController]);

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
      {isController && (
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
      )}

      {/* ─── TOP TOOLBAR ─────────────────────────────────────────── */}
      {isController && (
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

          {/* Launch TV View */}
          <button
            onClick={() => {
              const features = [
                'fullscreen=yes',
                'toolbar=no',
                'menubar=no',
                'scrollbars=no',
                'resizable=yes',
                `width=${window.screen.width}`,
                `height=${window.screen.height}`,
                'left=0',
                'top=0',
              ].join(',');
              window.open(`/admin/presentation-view/${id}`, '_blank', features);
            }}
            style={{ ...toolBtn(), color: '#8DC63F', border: '1px solid rgba(141,198,63,0.5)', background: 'rgba(141,198,63,0.1)' }}
            title="Launch TV / Projector Display"
          >
            🖥️ Launch Display
          </button>

          {/* End */}
          <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); navigate('/admin/presentations'); }} style={{ ...toolBtn(), color: '#f87171' }} title="End presentation (Esc)">
            End
          </button>
        </motion.div>
      )}

      {/* ─── THUMBNAIL PANEL ─────────────────────────────────────── */}
      {isController && (
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
      )}

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
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  draggable={false}
                />
              )}
            </motion.div>
          ) : mode === 'poll' ? (
            /* ── POLL VIEW ──────────────────────────────────────── */
            (() => {
              const formatCountdown = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
              const isTimerMode = activePoll?.revealMode === 'delayed' && pollTimerActive && !pollRevealed;
              const liveResponseCount = isTimerMode ? presentationResponseCount : totalResponses;

              if (currentQuestionIndex === -1) {
                return (
                  <motion.div
                    key={`poll-${activePoll?.code}-onboarding`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      width: '100%',
                      height: '100%',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2rem 4rem',
                      position: 'relative',
                      color: '#0f172a',
                      fontFamily: "'Outfit', sans-serif",
                      overflow: 'hidden'
                    }}
                  >
                    {/* Minds Logo Watermark Background */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '65%',
                      height: '65%',
                      backgroundImage: "url('/assets/minds_logo.png')",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      backgroundSize: 'contain',
                      opacity: 0.04, // Subtle elegant opacity matching student side
                      pointerEvents: 'none',
                      zIndex: 0
                    }} />

                    {/* Content Wrapper to sit above the watermark */}
                    <div style={{
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      maxWidth: '1200px'
                    }}>

                      {/* Top Assessment Title */}
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                          {activePoll?.title || presentation.title || "Interactive Assessment"}
                        </h1>
                      </div>

                      {/* Main Content Row */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4rem',
                        marginTop: '2rem',
                        width: '100%',
                        maxWidth: '1200px'
                      }}>
                        {/* Left: Massive QR Code */}
                        <div style={{
                          background: '#ffffff',
                          padding: '2.5rem',
                          borderRadius: '24px',
                          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <QRCodeSVG value={pollUrl} size={420} />
                          <span style={{ marginTop: '1.2rem', fontSize: '1.1rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>
                            Scan code to join
                          </span>
                        </div>

                        {/* Right: Big Completed Stats */}
                        <div style={{
                          background: '#ffffff',
                          padding: '4rem',
                          borderRadius: '24px',
                          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '400px',
                          minHeight: '480px'
                        }}>
                          {/* Live Dot and Label */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <span style={{
                              position: 'relative',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '18px',
                              width: '18px',
                            }}>
                              <motion.span
                                animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                style={{
                                  position: 'absolute',
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '50%',
                                  backgroundColor: '#8DC63F',
                                }}
                              />
                              <span style={{
                                position: 'relative',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#8DC63F',
                                zIndex: 2,
                              }} />
                            </span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '2px' }}>
                              Completed
                            </span>
                          </div>

                          {/* Massive Number */}
                          <div style={{ fontSize: '8rem', fontWeight: 900, color: '#0f172a', lineHeight: 1, marginBottom: '1rem' }}>
                            {presentationResponseCount}
                          </div>

                          <span style={{ fontSize: '1.2rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>

                          </span>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                );
              }

              return (
                <div key={`poll-wrapper-${activePoll?.code}`} style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <motion.div
                    key={`poll-${activePoll?.code}-q${currentQuestionIndex}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      width: 1920, height: 1080, background: '#f8fafc',
                      display: 'flex', flexDirection: 'column',
                      position: 'absolute', top: '50%', left: '50%',
                      transform: `translate(-50%, -50%) scale(${scale})`,
                      boxShadow: '0 0 50px rgba(0,0,0,0.2)', overflow: 'hidden',
                      fontFamily: 'Outfit, sans-serif', boxSizing: 'border-box'
                    }}
                  >
                    {/* Main Header Container (Fixed Height) */}
                    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, boxSizing: 'border-box' }}>


                      {/* Title Row */}
                      <div style={{ padding: '15px 80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', borderBottom: '2px solid #e2e8f0', position: 'relative', boxSizing: 'border-box' }}>
                        <div style={{ position: 'absolute', left: 40, top: 15, bottom: 15, width: 4, background: '#f59e0b' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: 1 }}>LIVE POLL</span>
                          <div style={{ width: 3, height: 30, background: '#cbd5e1' }} />
                          <span style={{ fontSize: 28, fontWeight: 700, color: '#64748b', letterSpacing: 1 }}>KNOWLEDGE CHECK</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 30, flexShrink: 0 }}>
                          <span style={{ fontSize: 24, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>QUESTION {currentQuestionIndex + 1} OF {activePoll.questions.length}</span>
                          <div style={{ width: 3, height: 30, background: '#cbd5e1' }} />
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap' }}>
                            {activePoll.questions.map((_, i) => (
                              <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i === currentQuestionIndex ? '#0f172a' : 'transparent', border: '3px solid #cbd5e1', flexShrink: 0 }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Question Zone (Flexible Height, allows wrapping) */}
                    <div style={{ padding: '30px 80px', display: 'flex', alignItems: 'center', flexShrink: 1, minHeight: 180, boxSizing: 'border-box' }}>
                      <h1 style={{
                        fontSize: currentQuestion?.text?.length > 150 ? 45 : currentQuestion?.text?.length > 80 ? 55 : 65,
                        fontWeight: 800, color: '#0f172a', lineHeight: 1.3, margin: 0,
                        width: '100%', wordWrap: 'break-word', overflowWrap: 'anywhere'
                      }}>
                        {currentQuestion?.text}
                      </h1>
                    </div>

                    {/* Content 3-Column Split (Takes remaining space) */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.3fr 300px', gap: 60, padding: '0 80px 30px', minHeight: 0, boxSizing: 'border-box' }}>
                      
                      {/* Left: Chart */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0, boxSizing: 'border-box' }}>
                         {isTimerMode ? (
                           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 }}>
                              <Clock size={80} color="#0f172a" />
                              <div style={{ fontSize: 70, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{formatCountdown(timeLeft)}</div>
                              <div style={{ fontSize: 22, fontWeight: 600, color: '#64748b' }}>Time Remaining</div>
                           </div>
                         ) : (
                           <div style={{ position: 'relative', width: '100%', maxWidth: 450, aspectRatio: '1 / 1', maxHeight: '100%', flexShrink: 1, boxSizing: 'border-box' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={totalResponses === 0 ? [{name:'Empty', value:1}] : currentQuestionData} cx="50%" cy="50%" outerRadius="100%" innerRadius="70%" dataKey="value" stroke="none" animationDuration={1000}>
                                    {(totalResponses === 0 ? [{name:'Empty', value:1}] : currentQuestionData).map((_, i) => (
                                      <Cell key={i} fill={totalResponses === 0 ? '#cbd5e1' : COLORS[i % COLORS.length]} />
                                    ))}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                <span style={{ fontSize: 85, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{totalResponses}</span>
                                <span style={{ fontSize: 22, fontWeight: 600, color: '#64748b', marginTop: 10 }}>Total{'\n'}Response</span>
                              </div>
                           </div>
                         )}
                         
                         {/* Highlight text below chart */}
                         {!isTimerMode && totalResponses > 0 && (() => {
                           const maxData = [...currentQuestionData].sort((a,b) => b.value - a.value)[0];
                           const maxPct = Math.round((maxData.value / totalResponses) * 100);
                           const maxIndex = currentQuestionData.indexOf(maxData);
                           const maxColor = COLORS[maxIndex % COLORS.length];
                           const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                           return (
                             <div style={{ marginTop: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                 <div style={{ width: 16, height: 16, borderRadius: '50%', background: maxColor }} />
                                 <span style={{ fontSize: 30, fontWeight: 900, color: '#0f172a' }}>{maxPct}%</span>
                               </div>
                               <span style={{ fontSize: 20, fontWeight: 600, color: '#475569' }}>Option {letters[maxIndex]}</span>
                             </div>
                           );
                         })()}
                      </div>

                      {/* Middle: Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, height: '100%', paddingRight: 40, borderRight: '2px solid #e2e8f0', overflow: 'hidden', boxSizing: 'border-box' }}>
                         {!isTimerMode && currentQuestionData.map((opt, i) => {
                           const pct = totalResponses > 0 ? Math.round((opt.value / totalResponses) * 100) : 0;
                           const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                           const color = COLORS[i % COLORS.length];
                           const hasVotes = opt.value > 0;
                           
                           return (
                             <div key={i} style={{ 
                               display: 'flex', alignItems: 'center', gap: 20, position: 'relative', 
                               background: hasVotes ? `${color}1A` : '#f1f5f9',
                               padding: '12px 20px', borderRadius: 16, flexShrink: 1, minHeight: 0, boxSizing: 'border-box'
                             }}>
                               <div style={{ 
                                 width: 60, height: 60, borderRadius: 12, 
                                 background: hasVotes ? color : '#cbd5e1', 
                                 display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                 fontSize: 32, fontWeight: 800, color: hasVotes ? '#fff' : '#64748b', 
                                 flexShrink: 0, zIndex: 1, boxShadow: '0 4px 10px rgba(0,0,0,0.05)' 
                               }}>
                                 {letters[i]}
                               </div>
                               
                               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                                 <span style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
                                   {opt.name}
                                 </span>
                                 <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden', width: '100%', flexShrink: 0 }}>
                                   <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                 </div>
                               </div>
                               
                               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: 100, flexShrink: 0 }}>
                                 <span style={{ fontSize: 34, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{pct}%</span>
                                 <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginTop: 6 }}>{opt.value} {opt.value === 1 ? 'vote' : 'votes'}</span>
                               </div>
                             </div>
                           );
                         })}
                      </div>

                      {/* Right: QR Code */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, height: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <Users size={60} color="#475569" />
                          <span style={{ fontSize: 60, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: 10 }}>{totalResponses}</span>
                          <span style={{ fontSize: 22, fontWeight: 600, color: '#64748b' }}>Total Participants</span>
                        </div>
                        
                        {activePoll && !activePoll.isExpired && (
                          <div style={{ background: '#fff', padding: 20, borderRadius: 20, border: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, boxShadow: '0 10px 20px rgba(0,0,0,0.04)', flexShrink: 1, minHeight: 0 }}>
                            <QRCodeSVG value={pollUrl} size={150} style={{ maxWidth: '100%', height: 'auto' }} />
                            <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: 2 }}>SCAN TO VOTE</span>
                          </div>
                        )}
                        
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: 20, fontWeight: 600, lineHeight: 1.4, flexShrink: 0 }}>
                          Your Response<br/>Matters
                        </div>
                      </div>

                    </div>

                    {/* Footer (Fixed Height) */}
                    <div style={{ padding: '20px 80px', borderTop: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', flexShrink: 0, boxSizing: 'border-box' }}>
                       <span style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8', letterSpacing: 2 }}>INFRASTRUCTURE FOR A BRIGHTER TOMORROW</span>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                         <div style={{ display: 'flex', gap: 6 }}>
                           <div style={{ width: 12, height: 28, background: '#cbd5e1', transform: 'skewX(-25deg)' }} />
                           <div style={{ width: 12, height: 28, background: '#cbd5e1', transform: 'skewX(-25deg)' }} />
                           <div style={{ width: 12, height: 28, background: '#cbd5e1', transform: 'skewX(-25deg)' }} />
                         </div>
                         <span style={{ fontSize: 20, fontWeight: 700, color: '#64748b', letterSpacing: 2 }}>PLAN | BUILD | CONNECT</span>
                       </div>
                    </div>

                  </motion.div>
                </div>
              );
            })()

          ) : (
            /* ── SUMMARY VIEW ────────────────────────────────────── */
            (() => {
              // 1. Data Calculation Logic
              const totalQuestions = activePoll?.questions?.length || 0;
              const questionPerformance = [];
              let maxVotes = 0;
              let overallCorrectVotes = 0;
              let overallTotalVotes = 0;

              activePoll?.questions?.forEach((q, i) => {
                const qData = chartData[i] || [];
                const qTotalVotes = qData.reduce((sum, item) => sum + item.value, 0);
                if (qTotalVotes > maxVotes) maxVotes = qTotalVotes;
                
                let correctVotes = 0;
                if (q.correctAnswer) {
                  const correctItem = qData.find(d => d.name === q.correctAnswer);
                  if (correctItem) correctVotes = correctItem.value;
                }
                
                const accuracy = qTotalVotes > 0 ? Math.round((correctVotes / qTotalVotes) * 100) : 0;
                
                overallCorrectVotes += correctVotes;
                overallTotalVotes += qTotalVotes;
                
                questionPerformance.push({
                  index: i + 1,
                  totalVotes: qTotalVotes,
                  accuracy
                });
              });

              const participants = maxVotes;
              const avgAccuracy = overallTotalVotes > 0 ? Math.round((overallCorrectVotes / overallTotalVotes) * 100) : 0;
              const avgVotes = totalQuestions > 0 ? overallTotalVotes / totalQuestions : 0;
              const participationRate = participants > 0 ? Math.round((avgVotes / participants) * 100) : 0;
              
              // 2. Trainer Insights Logic
              const answeredQuestions = questionPerformance.filter(q => q.totalVotes > 0);
              let highestQ = null;
              let lowestQ = null;
              let recommendedAction = "No participant responses are available yet.";
              
              if (answeredQuestions.length > 0) {
                highestQ = answeredQuestions.reduce((prev, current) => (prev.accuracy > current.accuracy) ? prev : current);
                lowestQ = answeredQuestions.reduce((prev, current) => (prev.accuracy < current.accuracy) ? prev : current);
                recommendedAction = `Question ${lowestQ.index} requires additional attention before proceeding.`;
              }

              // Color helper
              const getPerformanceColor = (acc) => {
                if (acc >= 90) return '#15803d'; // Strong (Green)
                if (acc >= 70) return '#0369a1'; // Good (Blue)
                if (acc >= 50) return '#b45309'; // Needs attention (Orange)
                return '#be123c'; // Critical (Red)
              };

              return (
                <motion.div
                  key={`summary-${activePoll?.code}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.4 }}
                  style={{ width: '100%', height: '100%', background: '#f8fafc', padding: '3rem 4rem', overflowY: 'auto', fontFamily: "'Outfit', sans-serif" }}
                >
                  <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem' }}>
                      <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: 1 }}>POLL SUMMARY</h1>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#64748b' }}>Knowledge Check &middot; {activePoll?.title || 'Session'}</div>
                    </div>

                    {/* Overview Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                      {[
                        { label: 'TOTAL QUESTIONS', value: totalQuestions },
                        { label: 'PARTICIPANTS', value: participants },
                        { label: 'AVG ACCURACY', value: `${avgAccuracy}%` }
                      ].map((m, i) => (
                        <div key={i} style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{m.value}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', letterSpacing: 1 }}>{m.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Main Content Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                      
                      {/* Question Performance */}
                      <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2rem 0', letterSpacing: 1 }}>QUESTION PERFORMANCE</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {questionPerformance.map(q => (
                            <div key={q.index} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#334155', minWidth: '35px' }}>Q{q.index}</span>
                              <div style={{ flex: 1, height: '14px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden' }}>
                                {q.totalVotes > 0 ? (
                                  <div style={{ height: '100%', width: `${q.accuracy}%`, background: getPerformanceColor(q.accuracy), transition: 'width 1s ease-in-out', borderRadius: '7px' }} />
                                ) : (
                                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '10px', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>No responses</div>
                                )}
                              </div>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', minWidth: '55px', textAlign: 'right' }}>
                                {q.totalVotes > 0 ? `${q.accuracy}%` : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Trainer Insights */}
                      <div style={{ background: '#fff', borderRadius: '0.75rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: 1 }}>TRAINER INSIGHTS</h2>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Highest Performance</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                              {highestQ ? `Q${highestQ.index} — ${highestQ.accuracy}% correct` : 'No data yet'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Needs Attention</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                              {lowestQ ? `Q${lowestQ.index} — ${lowestQ.accuracy}% correct` : 'No data yet'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Overall Performance</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                              {participants > 0 ? `${avgAccuracy}%` : '0%'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '0.5rem', borderLeft: '4px solid #0ea5e9' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: 1 }}>Recommended Action</span>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', lineHeight: 1.5 }}>
                              {recommendedAction}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </motion.div>
              );
            })()
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
        @keyframes qrPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 4px 10px rgba(141, 198, 63, 0.15)); }
          50% { transform: scale(1.02); filter: drop-shadow(0 10px 25px rgba(141, 198, 63, 0.35)); }
        }
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
