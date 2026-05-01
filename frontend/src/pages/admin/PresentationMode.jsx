import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function PresentationMode() {
  const { id } = useParams();
  const [presentation, setPresentation] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [showPoll, setShowPoll] = useState(false);
  const [activePollCode, setActivePollCode] = useState(null);
  const [activePollQuestions, setActivePollQuestions] = useState([]);
  const [socketRef, setSocketRef] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQR, setShowQR] = useState(true);

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

  // When slide changes, check if it has an attached poll
  useEffect(() => {
    if (!presentation) return;

    // Disconnect previous socket room
    if (socketRef) {
      socketRef.disconnect();
      setSocketRef(null);
    }

    setChartData([]);
    setShowPoll(false);
    setActivePollCode(null);

    const linkedSlidePoll = presentation.slidePolls?.find(sp => sp.slideIndex === currentSlide);

    if (linkedSlidePoll?.pollId) {
      const poll = linkedSlidePoll.pollId;
      setActivePollCode(poll.code);
      setActivePollQuestions(poll.questions || []);

      // Initialize empty chart data
      const initialChartData = (poll.questions || []).map(q =>
        q.options.map(opt => ({ name: opt, value: 0 }))
      );
      setChartData(initialChartData);
      setShowPoll(true);

      // Connect socket for live updates
      const socket = io(API_BASE);
      socket.emit('join_poll', poll.code);
      socket.on('poll_update', (data) => {
        setChartData(data);
      });
      setSocketRef(socket);

      // Fetch current results immediately
      api.get(`/poll/${poll.code}`)
        .then(({ data }) => { if (data.success) setChartData(data.results); })
        .catch(() => {});
    }
  }, [currentSlide, presentation]);

  const goNext = useCallback(() => {
    if (!presentation) return;
    setCurrentSlide(s => Math.min(s + 1, presentation.slides.length - 1));
  }, [presentation]);

  const goPrev = useCallback(() => {
    setCurrentSlide(s => Math.max(s - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape') document.exitFullscreen?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

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

  const downloadQR = () => {
    const svg = document.getElementById('present-qr');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `poll-qr-${activePollCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#fff' }}>
        Loading Presentation...
      </div>
    );
  }

  if (!presentation) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: '#ef4444' }}>
        Presentation not found.
      </div>
    );
  }

  const pollUrl = activePollCode ? `${FRONTEND_ORIGIN}/poll/${activePollCode}` : '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#000', color: '#fff', fontFamily: 'Inter, sans-serif', overflow: 'hidden'
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1.5rem',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/assets/minds_logo.png" alt="Logo" style={{ height: '32px', filter: 'brightness(0) invert(1)' }} />
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{presentation.title}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Slide {currentSlide + 1} / {presentation.slides.length}
          </span>
          <button onClick={goPrev} disabled={currentSlide === 0} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>◀ Prev</button>
          <button onClick={goNext} disabled={currentSlide === presentation.slides.length - 1} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Next ▶</button>
          <button onClick={toggleFullscreen} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>⛶ Fullscreen</button>
        </div>
      </div>

      {/* Main Stage */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Slide Viewer */}
        <div style={{
          flex: showPoll ? '1 1 60%' : '1 1 100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#111',
          transition: 'flex 0.4s ease'
        }}>
          <img
            key={currentSlide}
            src={`${API_BASE}${presentation.slides[currentSlide]}`}
            alt={`Slide ${currentSlide + 1}`}
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain',
              animation: 'fadeSlide 0.3s ease-in-out'
            }}
          />
        </div>

        {/* Live Poll Panel (right side) */}
        {showPoll && activePollCode && (
          <div style={{
            flex: '0 0 38%',
            display: 'flex',
            flexDirection: 'column',
            background: '#1e293b',
            borderLeft: '1px solid #334155',
            overflow: 'auto',
            padding: '1.5rem'
          }}>
            {/* Poll Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8', marginBottom: '4px' }}>Live Poll</h2>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '6px', color: '#8DC63F' }}>{activePollCode}</span>
              </div>
              <button
                onClick={() => setShowQR(s => !s)}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                {showQR ? 'Hide QR' : 'Show QR'}
              </button>
            </div>

            {/* QR Code */}
            {showQR && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
                  <QRCodeSVG id="present-qr" value={pollUrl} size={140} />
                </div>
                <button onClick={downloadQR} className="btn btn-secondary" style={{ marginTop: '10px', fontSize: '0.75rem', padding: '4px 12px' }}>
                  📥 Download QR
                </button>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '6px', textAlign: 'center' }}>
                  Scan to join at {pollUrl}
                </p>
              </div>
            )}

            {/* Live Pie Charts — one per question */}
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Live Results</h3>
              {activePollQuestions.map((q, qIndex) => (
                <div key={qIndex} style={{ marginBottom: '2.5rem' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                    {qIndex + 1}. {q.text}
                  </p>
                  <div style={{ height: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData[qIndex] || []}
                          cx="50%" cy="50%"
                          outerRadius={80} innerRadius={40}
                          dataKey="value" nameKey="name"
                          labelLine={false}
                          label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                          animationBegin={0} animationDuration={600}
                        >
                          {(chartData[qIndex] || []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#94a3b8', fontSize: '0.75rem' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Slide Navigator */}
      <div style={{
        padding: '0.5rem 1.5rem',
        background: 'rgba(255,255,255,0.03)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto'
      }}>
        {presentation.slides.map((_, i) => {
          const hasLinkedPoll = presentation.slidePolls?.some(sp => sp.slideIndex === i);
          return (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                flex: '0 0 auto',
                width: '40px', height: '28px',
                borderRadius: '4px',
                border: i === currentSlide ? '2px solid #8DC63F' : '1px solid #334155',
                background: i === currentSlide ? 'rgba(141,198,63,0.15)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: i === currentSlide ? 700 : 400,
                position: 'relative'
              }}
            >
              {i + 1}
              {hasLinkedPoll && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: '#8DC63F', borderRadius: '50%' }} />
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
