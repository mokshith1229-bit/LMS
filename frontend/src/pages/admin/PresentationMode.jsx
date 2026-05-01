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
      height: '100vh', width: '100vw', background: '#000', color: '#fff',
      overflow: 'hidden', position: 'relative', fontFamily: 'Outfit, sans-serif'
    }}>
      
      <AnimatePresence mode="wait">
        {!showPoll ? (
          /* SLIDE VIEW */
          <motion.div
            key={`slide-${currentSlide}`}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}
          >
            <img
              src={`${API_BASE}${presentation.slides[currentSlide]}`}
              alt={`Slide ${currentSlide + 1}`}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </motion.div>
        ) : (
          /* FULLSCREEN POLL VIEW (Mentimeter Style) */
          <motion.div
            key={`poll-${activePoll?.code}-${currentQuestionIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              height: '100%', width: '100%',
              background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
              display: 'flex', flexDirection: 'column', padding: '4rem'
            }}
          >
            {/* Top Join Instructions */}
            <div style={{ position: 'absolute', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
                padding: '0.75rem 2rem', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Join at</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{FRONTEND_ORIGIN.replace(/^https?:\/\//, '')}/poll</span>
                </div>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Use code</span>
                  <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#8DC63F', letterSpacing: '2px' }}>{activePoll.code}</span>
                </div>
              </div>
            </div>

            {/* Question Header */}
            <div style={{ marginTop: '4rem', textAlign: 'center' }}>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{ fontSize: '3.5rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.1, maxWidth: '900px', margin: '0 auto' }}
              >
                {currentQuestion?.text}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}
              >
                {totalResponses} response{totalResponses !== 1 ? 's' : ''}
              </motion.p>
            </div>

            {/* Results Chart */}
            <div style={{ flex: 1, marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={currentQuestionData}
                    cx="50%" cy="50%"
                    outerRadius="75%"
                    innerRadius="45%"
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={5}
                    animationDuration={1500}
                    stroke="none"
                  >
                    {currentQuestionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={100}
                    formatter={(value, entry) => {
                      const item = currentQuestionData.find(d => d.name === value);
                      const percentage = totalResponses > 0 ? ((item?.value / totalResponses) * 100).toFixed(0) : 0;
                      return <span style={{ color: '#e2e8f0', fontSize: '1.2rem', fontWeight: 600, marginLeft: '8px' }}>{value} ({percentage}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Right QR Code */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, type: 'spring' }}
              style={{
                position: 'absolute', bottom: '3rem', right: '3rem',
                background: '#fff', padding: '1.5rem', borderRadius: '24px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
              }}
            >
              <QRCodeSVG value={pollUrl} size={150} />
              <span style={{ color: '#000', fontWeight: 800, fontSize: '0.9rem' }}>SCAN TO VOTE</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discreet Navigation Overlay (visible on bottom hover) */}
      <div className="presentation-controls" style={{
        position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1.5rem',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', borderRadius: '100px',
        border: '1px solid rgba(255,255,255,0.1)', opacity: 0, transition: 'opacity 0.3s',
        zIndex: 100
      }}>
        <button onClick={goPrev} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>←</button>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '80px', textAlign: 'center' }}>
          {currentSlide + 1} / {presentation.slides.length}
        </span>
        <button onClick={goNext} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>→</button>
        <div style={{ width: '1px', height: '15px', background: 'rgba(255,255,255,0.2)' }} />
        <button onClick={toggleFullscreen} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}>⛶</button>
      </div>

      <style>{`
        .presentation-controls:hover { opacity: 1 !important; }
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
      `}</style>
    </div>
  );
}
