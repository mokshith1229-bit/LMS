import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';

export default function PresentationSetup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presentation, setPresentation] = useState(null);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlide, setSelectedSlide] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [presRes, pollsRes] = await Promise.all([
        api.get(`/presentation/${id}`),
        api.get('/poll/admin/all')
      ]);
      if (presRes.data.success) setPresentation(presRes.data.presentation);
      if (pollsRes.data.success) setPolls(pollsRes.data.polls);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getSlidePolls = (slideIndex) =>
    presentation?.slidePolls?.find(sp => sp.slideIndex === slideIndex);

  const handleAttachPoll = async (pollId) => {
    try {
      const { data } = await api.post(`/presentation/${id}/attach-poll`, {
        slideIndex: selectedSlide,
        pollId
      });
      if (data.success) {
        setPresentation(data.presentation);
        toast.success('Poll attached to slide!');
        setShowModal(false);
      }
    } catch (err) {
      toast.error('Failed to attach poll');
    }
  };

  const handleDetachPoll = async (slideIndex) => {
    try {
      const { data } = await api.delete(`/presentation/${id}/detach-poll/${slideIndex}`);
      if (data.success) {
        setPresentation(data.presentation);
        toast.success('Poll detached');
      }
    } catch (err) {
      toast.error('Failed to detach poll');
    }
  };

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="admin-page" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </main>
    </div>
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="admin-page">
          <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{presentation?.title}</h1>
          <p>Click a slide to attach or remove a live poll from it.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/presentations')}>
            ← Back
          </button>
          <button className="btn btn-primary" onClick={() => navigate(`/admin/presentations/${id}/present`)}>
            ▶ Start Presenting
          </button>
        </div>
      </div>

      {/* Slide Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        {presentation?.slides.map((slidePath, index) => {
          const linked = getSlidePolls(index);
          return (
            <div
              key={index}
              className="card"
              style={{
                padding: '0',
                overflow: 'hidden',
                border: linked ? '2px solid var(--accent)' : '1px solid var(--border)',
                transition: 'all 0.2s'
              }}
            >
              {/* Slide Image */}
              <div style={{ position: 'relative', background: '#000' }}>
                <img
                  src={
                    slidePath.startsWith('http')
                      ? slidePath
                      : `${API_BASE}${slidePath}?t=${Date.now()}`
                  }
                  alt={`Slide ${index + 1}`}
                  style={{ width: '100%', height: '160px', objectFit: 'contain', display: 'block' }}
                />
                <div style={{
                  position: 'absolute', top: '8px', left: '8px',
                  background: 'rgba(0,0,0,0.65)', color: '#fff',
                  padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                }}>
                  Slide {index + 1}
                </div>
                {linked && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'var(--accent)', color: '#fff',
                    padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700
                  }}>
                    📊 POLL
                  </div>
                )}
              </div>

              {/* Slide Controls */}
              <div style={{ padding: '1rem' }}>
                {linked ? (
                  <div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 700, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📊 {linked.pollId?.title || linked.pollId?.questions?.[0]?.text || 'Linked Poll'}
                    </p>
                    <button
                      className="btn btn-danger"
                      style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }}
                      onClick={() => handleDetachPoll(index)}
                    >
                      ✕ Remove Poll
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    onClick={() => { setSelectedSlide(index); setShowModal(true); }}
                  >
                    + Attach Poll
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Poll Picker Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ padding: '2rem', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
              Select a Poll for Slide {selectedSlide + 1}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {polls.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No polls found. Create one first in Live Polls.</p>
              ) : polls.map(poll => (
                <button
                  key={poll._id}
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', padding: '1rem', lineHeight: 1.4 }}
                  onClick={() => handleAttachPoll(poll._id)}
                >
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                    {poll.title || 'Untitled Poll'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 700 }}>Code: {poll.code}</span>
                    <span>• {poll.questions?.length} Questions</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', marginTop: '4px', color: poll.isExpired ? '#ef4444' : '#22c55e' }}>
                    {poll.isExpired ? '⚠ Expired' : '● Active'}
                  </div>
                </button>
              ))}
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
      </div>
      </main>
    </div>
  );
}
