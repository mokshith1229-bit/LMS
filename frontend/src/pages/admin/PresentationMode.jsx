import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#10B981', '#F43F5E'];

export default function PresentationMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [showPoll, setShowPoll] = useState(false);
  const [activePoll, setActivePoll] = useState(null);
  const [socketRef, setSocketRef] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const FRONTEND_ORIGIN = window.location.origin;

  useEffect(() => {
    fetchPresentation();
    return () => { if (socketRef) socketRef.disconnect(); };
  }, [id]);

  const fetchPresentation = async () => {
    try {
      const { data } = await api.get(`/presentation/${id}`);
      if (data.success) setPresentation(data.presentation);
    } catch (err) {
      toast.error('Failed to load presentation');
    } finally {
      setLoading(false);
    }
  };

  // When slide changes, check for poll
  useEffect(() => {
    if (!presentation) return;

    if (socketRef) {
      socketRef.disconnect();
      setSocketRef(null);
    }

    setChartData([]);
    setShowPoll(false);
    setActivePoll(null);
    setCurrentQuestionIndex(0);

    const linkedSlidePoll = presentation.slidePolls?.find(sp => sp.slideIndex === currentSlide);

    if (linkedSlidePoll?.pollId) {
      const poll = linkedSlidePoll.pollId;
      setActivePoll(poll);

      const initialChartData = (poll.questions || []).map(q =>
        q.options.map(opt => ({ name: opt, value: 0 }))
      );
      setChartData(initialChartData);
      setShowPoll(true);

      const socket = io(API_BASE);
      socket.emit('join_poll', poll.code);
      socket.on('poll_update', (data) => {
        setChartData(data);
      });
      setSocketRef(socket);

      api.get(`/poll/${poll.code}`)
        .then(({ data }) => { if (data.success) setChartData(data.results); })
        .catch(() => {});
    }
  }, [currentSlide, presentation]);

  const goNext = useCallback(() => {
    if (!presentation) return;
    // If poll has multiple questions, cycle through them before moving to next slide
    if (showPoll && activePoll && currentQuestionIndex < activePoll.questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
      return;
    }
    setCurrentSlide(s => Math.min(s + 1, presentation.slides.length - 1));
  }, [presentation, showPoll, activePoll, currentQuestionIndex]);

  const goPrev = useCallback(() => {
    if (showPoll && activePoll && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(i => i - 1);
      return;
    }
    setCurrentSlide(s => Math.max(s - 1, 0));
  }, [showPoll, activePoll, currentQuestionIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'q' || e.key === 'Q') setShowPoll(p => !p); // Toggle poll overlay manually if needed
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else navigate('/admin/presentations');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, navigate]);

  const toggleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (loading || !presentation) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#000', color: '#fff' }}>
        {loading ? 'Initializing Presentation...' : 'Presentation not found'}
      </div>
    );
  }

  const pollUrl = activePoll ? `${FRONTEND_ORIGIN}/poll/${activePoll.code}` : '';
  const currentQuestion = activePoll?.questions?.[currentQuestionIndex];
  const currentQuestionData = chartData[currentQuestionIndex] || [];
  const totalResponses = currentQuestionData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div style={{
      height: '100vh', width: '100vw', background: '#f8fafc', color: '#1e293b',
      overflow: 'hidden', position: 'relative', fontFamily: 'Outfit, sans-serif'
    }}>
      
      <AnimatePresence mode="wait">
        {!showPoll ? (
          /* SLIDE VIEW */
          <motion.div
            key={`slide-${currentSlide}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}
          >
            <img
              src={`${API_BASE}${presentation.slides[currentSlide]}`}
              alt={`Slide ${currentSlide + 1}`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </motion.div>
        ) : (
          /* FULLSCREEN POLL VIEW (Professional White Style) */
          <motion.div
            key={`poll-${activePoll?.code}-${currentQuestionIndex}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5 }}
            style={{
              height: '100%', width: '100%',
              background: '#f8fafc',
              display: 'flex', flexDirection: 'column', padding: '6rem 4rem 4rem 4rem'
            }}
          >
            {/* Top Join Instructions (Clean Boxed Style) */}
            <div style={{ position: 'absolute', top: '2.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
              <div style={{
                background: '#ffffff',
                padding: '0.8rem 2.5rem', borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: '2rem', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>Join at</span>
                  <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#334155' }}>{FRONTEND_ORIGIN.replace(/^https?:\/\//, '')}/poll</span>
                </div>
                <div style={{ height: '24px', width: '1px', background: '#e2e8f0' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>Code</span>
                  <span style={{ fontWeight: 900, fontSize: '1.6rem', color: '#8DC63F', letterSpacing: '1px' }}>{activePoll.code}</span>
                </div>
              </div>
            </div>

            {/* Content Box */}
            <div style={{ 
              flex: 1, background: '#ffffff', borderRadius: '24px', 
              border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(0,0,0,0.03)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              {/* Question Area */}
              <div style={{ padding: '3rem 4rem 1rem 4rem', textAlign: 'center' }}>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{ fontSize: '3rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', lineHeight: 1.2 }}
                >
                  {currentQuestion?.text}
                </motion.h1>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8DC63F' }}></div>
                   <span style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 600 }}>
                    {totalResponses} total response{totalResponses !== 1 ? 's' : ''}
                   </span>
                </div>
              </div>

              {/* Chart Area */}
              <div style={{ flex: 1, padding: '0 4rem 4rem 4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentQuestionData}
                      cx="50%" cy="50%"
                      outerRadius="85%"
                      innerRadius="55%"
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={4}
                      animationDuration={1200}
                      stroke="#fff"
                      strokeWidth={4}
                    >
                      {currentQuestionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={80}
                      formatter={(value, entry) => {
                        const item = currentQuestionData.find(d => d.name === value);
                        const percentage = totalResponses > 0 ? ((item?.value / totalResponses) * 100).toFixed(0) : 0;
                        return <span style={{ color: '#475569', fontSize: '1.1rem', fontWeight: 700, marginLeft: '8px' }}>{value} ({percentage}%)</span>;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Right QR Code (Professional Floating Box) */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                position: 'absolute', bottom: '3rem', right: '3rem',
                background: '#fff', padding: '1.25rem', borderRadius: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 15px 35px rgba(0,0,0,0.08)', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem'
              }}
            >
              <QRCodeSVG value={pollUrl} size={130} />
              <span style={{ color: '#64748b', fontWeight: 800, fontSize: '0.75rem', letterSpacing: '1px' }}>SCAN TO VOTE</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Overlay */}
      <div className="presentation-controls" style={{
        position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 1.8rem',
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderRadius: '100px',
        border: '1px solid #e2e8f0', opacity: 0, transition: 'all 0.3s',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)', zIndex: 100
      }}>
        <button onClick={goPrev} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, minWidth: '80px', textAlign: 'center', color: '#1e293b' }}>
          {currentSlide + 1} / {presentation.slides.length}
        </span>
        <button onClick={goNext} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>→</button>
        <div style={{ width: '1px', height: '15px', background: '#e2e8f0' }} />
        <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>⛶</button>
      </div>

      <style>{`
        .presentation-controls:hover { opacity: 1 !important; transform: translateX(-50%) translateY(-5px); }
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
      `}</style>
    </div>
  );
}
